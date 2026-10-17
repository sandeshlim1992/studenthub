<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { QueryHandler } from '#shared/server/apollo/handler/index.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'
import type { KnowledgeBaseSearchResult } from '#mobile/entities/knowledge-base/types.ts'
import StudenthubTicketItem from '#mobile/entities/ticket/components/StudenthubTicketItem.vue'
import {
  studenthubSubCategoryMatches,
  type RequestCategories,
} from '#mobile/entities/ticket/helpers/studenthubSubCategoryMatches.ts'

import { useStudenthubTicketSearchQuery } from '../graphql/queries/studenthubTicketSearch.api.ts'

// Student Hub: the students' search from Home. What answers the question comes first: help
// articles, then the request types to raise (each opens the request chat with it chosen), then
// the student's own tickets (as on the Tickets tab, not others' in a shared organisation).
// Sections without matches stay hidden, and the later ones wait for the articles, so nothing moves
// under the student's finger when they arrive.

const MIN_SEARCH_LENGTH = 2
const FIRST_ARTICLES = 5
const MAX_REQUEST_TYPES = 5

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const application = useApplicationStore()
const { ticketCreateEnabled } = useTicketCreateView()

const searchInput = useTemplateRef<HTMLInputElement>('search-input')
const search = ref(String(route.query.search ?? ''))
const words = refDebounced(
  computed(() => search.value.trim()),
  300,
)
const canSearch = computed(() => words.value.length >= MIN_SEARCH_LENGTH)

// Keeps the words in the address, so coming back from a result shows the same results.
watch(words, (current) => router.replace({ query: current ? { search: current } : {} }))

const articles = ref<KnowledgeBaseSearchResult[]>([])
const articlesLoading = ref(false)
const showAllArticles = ref(false)

watch(
  words,
  async (current) => {
    showAllArticles.value = false
    if (!canSearch.value || !application.config.kb_active) {
      articles.value = []
      return
    }

    articlesLoading.value = true
    try {
      const found = await studenthubApi<KnowledgeBaseSearchResult[]>(
        `/api/v1/studenthub/mobile_app/knowledge_base/search?query=${encodeURIComponent(current)}`,
      )
      // A slower reply to earlier words must not replace the latest.
      if (current === words.value) articles.value = found
    } catch {
      articles.value = []
    } finally {
      if (current === words.value) articlesLoading.value = false
    }
  },
  { immediate: true },
)

const shownArticles = computed(() =>
  showAllArticles.value ? articles.value : articles.value.slice(0, FIRST_ARTICLES),
)

const requestChoices = ref<RequestCategories | null>(null)

onMounted(async () => {
  searchInput.value?.focus()
  if (!ticketCreateEnabled.value) return

  try {
    requestChoices.value = await studenthubApi<RequestCategories>(
      '/api/v1/studenthub/ticket_wizard_metadata',
    )
  } catch {
    // The search works without the request types.
  }
})

const requestTypes = computed(() => {
  if (!canSearch.value || !requestChoices.value) return []

  return studenthubSubCategoryMatches(requestChoices.value, words.value, {
    limit: MAX_REQUEST_TYPES,
  })
})

const requestLink = (category: string, subCategory: string) =>
  `/tickets/request?${new URLSearchParams({ category, sub_category: subCategory })}`

const ticketsQuery = new QueryHandler(
  useStudenthubTicketSearchQuery(
    () => ({ search: words.value }),
    () => ({ enabled: canSearch.value }),
  ),
)
const ticketsResult = ticketsQuery.result()
const ticketsLoading = ticketsQuery.loadingWithoutCachedResult()

const tickets = computed(() => {
  if (!canSearch.value) return []

  return (ticketsResult.value?.search.items ?? []).flatMap((item) =>
    item.__typename === 'Ticket' && item.customer.internalId === session.user?.internalId
      ? [item]
      : [],
  )
})

const isLoading = computed(() => articlesLoading.value || ticketsLoading.value)

const nothingFound = computed(
  () =>
    canSearch.value &&
    !isLoading.value &&
    !articles.value.length &&
    !requestTypes.value.length &&
    !tickets.value.length,
)
</script>

<template>
  <div>
    <StudenthubAppHeader :title="$t('Search')" back-link="/" :back-label="$t('Back to Home')" />
    <div class="-mt-7 flex flex-col gap-4.5 px-5 pb-5">
      <div
        class="flex h-14 items-center gap-2.5 rounded-2xl bg-gray-500 px-4 shadow-[0_6px_18px_rgb(20_35_75/12%)]"
      >
        <CommonIcon name="search" size="small" class="text-gray" decorative />
        <input
          ref="search-input"
          v-model="search"
          type="search"
          class="grow bg-transparent text-base outline-none placeholder:text-gray"
          :placeholder="$t('Search…')"
          :aria-label="$t('Search help articles, requests and your tickets')"
        />
      </div>

      <p v-if="!canSearch" class="px-1 text-base text-gray">
        {{ $t('Find help articles, the request to raise and your tickets.') }}
      </p>

      <section
        v-if="articles.length"
        aria-labelledby="studenthub-search-articles"
        class="flex flex-col gap-2"
      >
        <h2 id="studenthub-search-articles" class="text-lg font-extrabold">
          {{ $t('Help articles') }}
        </h2>
        <ul class="flex flex-col gap-2.5">
          <li v-for="article in shownArticles" :key="article.id">
            <CommonLink
              :link="`/knowledge-base/answers/${article.id}`"
              class="flex flex-col gap-1 rounded-2xl bg-gray-500 px-4 py-3.5"
            >
              <span class="text-sm text-gray">{{ article.topic }}</span>
              <span class="text-base font-bold">{{ article.title }}</span>
              <span class="line-clamp-2 text-sm text-gray-100">{{ article.snippet }}</span>
            </CommonLink>
          </li>
        </ul>
        <button
          v-if="!showAllArticles && articles.length > FIRST_ARTICLES"
          type="button"
          class="h-11 rounded-2xl bg-gray-500 text-base font-semibold"
          @click="showAllArticles = true"
        >
          {{ $t('Show all %s', articles.length) }}
        </button>
      </section>

      <section
        v-if="requestTypes.length && !articlesLoading"
        aria-labelledby="studenthub-search-requests"
        class="flex flex-col gap-2"
      >
        <h2 id="studenthub-search-requests" class="text-lg font-extrabold">
          {{ $t('Raise a request') }}
        </h2>
        <ul class="overflow-hidden rounded-2xl bg-gray-500">
          <li
            v-for="{ category, subCategory } in requestTypes"
            :key="`${category.value}::${subCategory.value}`"
            class="border-b border-gray-400 last:border-0"
          >
            <CommonLink
              :link="requestLink(category.value, subCategory.value)"
              class="flex items-center gap-3 px-4 py-3"
            >
              <CommonIcon name="add" size="small" class="shrink-0 text-blue" decorative />
              <span class="flex grow flex-col">
                <span class="text-base font-semibold">{{ subCategory.name }}</span>
                <span class="text-sm text-gray">{{ category.name }}</span>
              </span>
              <CommonIcon name="chevron-right" size="small" class="text-gray" decorative />
            </CommonLink>
          </li>
        </ul>
      </section>

      <section
        v-if="tickets.length && !articlesLoading"
        aria-labelledby="studenthub-search-tickets"
        class="flex flex-col gap-2"
      >
        <h2 id="studenthub-search-tickets" class="text-lg font-extrabold">
          {{ $t('Your tickets') }}
        </h2>
        <StudenthubTicketItem v-for="ticket in tickets" :key="ticket.id" :ticket="ticket" />
      </section>

      <div v-if="nothingFound" class="flex flex-col gap-3 rounded-2xl bg-gray-500 px-4 py-3.5">
        <p class="text-base text-gray">{{ $t('Nothing matches “%s”.', words) }}</p>
        <CommonLink
          v-if="ticketCreateEnabled"
          link="/tickets/request"
          class="text-base font-semibold text-blue"
        >
          {{ $t('Raise a request') }}
        </CommonLink>
      </div>

      <div v-if="canSearch && isLoading" role="status" class="flex justify-center py-2">
        <CommonIcon name="loading" animation="spin" :label="$t('Searching…')" />
      </div>
    </div>
  </div>
</template>
