<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { i18n } from '#shared/i18n/index.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import CommonLoader from '#mobile/components/CommonLoader/CommonLoader.vue'
import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'
import type {
  KnowledgeBaseSearchResult,
  KnowledgeBaseTopic,
} from '#mobile/entities/knowledge-base/types.ts'

import { knowledgeBaseTopicIcon } from '../utils/knowledgeBaseTopicIcon.ts'

// Student Hub: Help articles in the mobile app (design 1 "Topics", .dev/DECISIONS.md): the top
// topics, or one topic with its sub-topics and answers. Searching covers every published answer.

const props = defineProps<{
  categoryId?: string
}>()

const MIN_SEARCH_LENGTH = 2

const topic = ref<KnowledgeBaseTopic | null>(null)
const loading = ref(true)
const loadError = ref(false)

const load = async () => {
  loading.value = true
  const path = props.categoryId
    ? `/api/v1/studenthub/mobile_app/knowledge_base/categories/${props.categoryId}`
    : '/api/v1/studenthub/mobile_app/knowledge_base'

  try {
    topic.value = await studenthubApi<KnowledgeBaseTopic>(path)
    loadError.value = false
  } catch {
    topic.value = null
    loadError.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.categoryId, load, { immediate: true })

const search = ref('')
const query = refDebounced(
  computed(() => search.value.trim()),
  300,
)
const results = ref<KnowledgeBaseSearchResult[] | null>(null)

watch(query, async (words) => {
  if (words.length < MIN_SEARCH_LENGTH) {
    results.value = null
    return
  }

  try {
    const found = await studenthubApi<KnowledgeBaseSearchResult[]>(
      `/api/v1/studenthub/mobile_app/knowledge_base/search?query=${encodeURIComponent(words)}`,
    )
    // A slower reply to earlier words must not replace the latest.
    if (words === query.value) results.value = found
  } catch {
    results.value = []
  }
})

const title = computed(() => topic.value?.topic?.title ?? i18n.t('Help articles'))

const context = computed(() => {
  const current = topic.value?.topic
  if (!current) return undefined

  return [i18n.t('Help articles'), ...current.path.map((step) => step.title)].join(' › ')
})

const back = computed(() => {
  const current = topic.value?.topic
  if (!current && !props.categoryId) return { link: '/', label: __('Back to Home') }

  const parent = current?.path.at(-1)
  if (parent)
    return { link: `/knowledge-base/${parent.id}`, label: __('Back to %s'), title: parent.title }

  return { link: '/knowledge-base', label: __('Back to Help articles') }
})

const answerCount = (count: number) =>
  i18n.t(count === 1 ? __('%s answer') : __('%s answers'), count)
</script>

<template>
  <div>
    <StudenthubAppHeader
      :title="title"
      :context="context"
      :back-link="back.link"
      :back-label="$t(back.label, back.title)"
    />
    <div class="-mt-7 flex flex-col gap-4.5 px-5 pb-5">
      <div
        class="flex h-14 items-center gap-2.5 rounded-2xl bg-gray-500 px-4 shadow-[0_6px_18px_rgb(20_35_75/12%)]"
      >
        <CommonIcon name="search" size="small" class="text-gray" decorative />
        <input
          v-model="search"
          type="search"
          class="grow bg-transparent text-base outline-none placeholder:text-gray"
          :placeholder="$t('Search help articles…')"
          :aria-label="$t('Search help articles')"
        />
      </div>

      <section v-if="results" aria-labelledby="studenthub-kb-results" class="flex flex-col gap-2">
        <h2 id="studenthub-kb-results" class="text-lg font-extrabold">
          {{ $t('Search results') }}
        </h2>
        <ul v-if="results.length" class="flex flex-col gap-2.5">
          <li v-for="result in results" :key="result.id">
            <CommonLink
              :link="`/knowledge-base/answers/${result.id}`"
              class="flex flex-col gap-1 rounded-2xl bg-gray-500 px-4 py-3.5"
            >
              <span class="text-sm text-gray">{{ result.topic }}</span>
              <span class="text-base font-bold">{{ result.title }}</span>
              <span class="line-clamp-2 text-sm text-gray-100">{{ result.snippet }}</span>
            </CommonLink>
          </li>
        </ul>
        <p v-else class="rounded-2xl bg-gray-500 px-4 py-3.5 text-gray">
          {{ $t('No help articles match your search.') }}
        </p>
      </section>

      <CommonLoader v-else :loading="loading">
        <p v-if="loadError" class="rounded-2xl bg-gray-500 px-4 py-3.5 text-gray">
          {{ $t('These help articles are not available.') }}
        </p>
        <template v-else-if="topic">
          <section
            v-if="topic.topics.length"
            aria-labelledby="studenthub-kb-topics"
            class="flex flex-col gap-2"
          >
            <h2 id="studenthub-kb-topics" class="text-lg font-extrabold">{{ $t('Topics') }}</h2>
            <ul class="grid grid-cols-2 gap-2.5">
              <li v-for="tile in topic.topics" :key="tile.id">
                <CommonLink
                  :link="`/knowledge-base/${tile.id}`"
                  class="flex h-full flex-col gap-2.5 rounded-2xl bg-gray-500 p-3.5"
                >
                  <span
                    class="flex size-9 items-center justify-center rounded-[10px] bg-blue-highlight text-blue"
                  >
                    <CommonIcon :name="knowledgeBaseTopicIcon(tile.icon)" size="small" decorative />
                  </span>
                  <span class="flex flex-col gap-0.5">
                    <span class="text-base leading-tight font-bold">{{ tile.title }}</span>
                    <span class="text-sm text-gray">{{ answerCount(tile.answer_count) }}</span>
                  </span>
                </CommonLink>
              </li>
            </ul>
          </section>

          <section
            v-if="topic.answers.length"
            aria-labelledby="studenthub-kb-answers"
            class="flex flex-col gap-2"
          >
            <h2 id="studenthub-kb-answers" class="text-lg font-extrabold">{{ $t('Answers') }}</h2>
            <ul class="overflow-hidden rounded-2xl bg-gray-500">
              <li
                v-for="answer in topic.answers"
                :key="answer.id"
                class="border-b border-gray-400 last:border-0"
              >
                <CommonLink
                  :link="`/knowledge-base/answers/${answer.id}`"
                  class="flex items-center gap-3 px-4 py-3.5"
                >
                  <CommonIcon name="book" size="small" class="shrink-0 text-blue" decorative />
                  <span class="grow text-base font-medium">{{ answer.title }}</span>
                  <CommonIcon name="chevron-right" size="small" class="text-gray" decorative />
                </CommonLink>
              </li>
            </ul>
          </section>

          <p
            v-if="!topic.topics.length && !topic.answers.length"
            class="rounded-2xl bg-gray-500 px-4 py-3.5 text-gray"
          >
            {{ $t('There are no help articles yet.') }}
          </p>
        </template>
      </CommonLoader>
    </div>
  </div>
</template>
