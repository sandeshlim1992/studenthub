<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { i18n } from '#shared/i18n/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { humanizeFileSize } from '#shared/utils/files.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import CommonLoader from '#mobile/components/CommonLoader/CommonLoader.vue'
import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'

import type { KnowledgeBaseAnswer } from '../types.ts'

// Student Hub: one help article in the mobile app (design 1 "Topics"): its text and files, "Was
// this helpful?" for students (StudenthubAnswerFeedback; staff see the counts in the new UI), and
// a way to raise a request when it was not.

const props = defineProps<{
  answerId: string
}>()

const router = useRouter()
const session = useSessionStore()
const { ticketCreateEnabled } = useTicketCreateView()

const answer = ref<KnowledgeBaseAnswer | null>(null)
const loading = ref(true)
const loadError = ref(false)

const load = async () => {
  loading.value = true

  try {
    answer.value = await studenthubApi<KnowledgeBaseAnswer>(
      `/api/v1/studenthub/mobile_app/knowledge_base/answers/${props.answerId}`,
    )
    loadError.value = false
  } catch {
    answer.value = null
    loadError.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.answerId, load, { immediate: true })

const topic = computed(() => answer.value?.path.at(-1))

const context = computed(() =>
  [i18n.t('Help articles'), ...(answer.value?.path ?? []).map((step) => step.title)].join(' › '),
)

const isStudent = computed(() => session.hasPermission('ticket.customer'))

const voting = ref(false)
const voted = ref(false)

const vote = async (helpful: boolean) => {
  if (!answer.value || voting.value) return

  voting.value = true
  try {
    const result = await studenthubApi<{ helpful: boolean }>(
      `/api/v1/studenthub/mobile_app/knowledge_base/answers/${answer.value.id}/feedback`,
      { method: 'PUT', body: { helpful } },
    )
    answer.value.helpful = result.helpful
    voted.value = true
  } catch {
    // The vote stays as it was; the buttons show which one counts.
  } finally {
    voting.value = false
  }
}

// Links to other help articles open in the app, not by loading it again.
const openAppLink = (event: MouseEvent) => {
  const link = (event.target as HTMLElement).closest('a')
  const href = link?.getAttribute('href')
  if (!href?.startsWith('/mobile/')) return

  event.preventDefault()
  router.push(href.slice('/mobile'.length))
}
</script>

<template>
  <div>
    <StudenthubAppHeader
      :title="answer?.title ?? $t('Help articles')"
      :context="answer ? context : undefined"
      :back-link="topic ? `/knowledge-base/${topic.id}` : '/knowledge-base'"
      :back-label="topic ? $t('Back to %s', topic.title) : $t('Back to Help articles')"
    >
      <CommonDateTime
        v-if="answer"
        class="text-sm text-white/80"
        :date-time="answer.updated_at"
        type="relative"
      >
        <template #prefix>{{ $t('Updated') }}</template>
      </CommonDateTime>
    </StudenthubAppHeader>
    <div class="-mt-7 flex flex-col gap-3 px-5 pb-5">
      <CommonLoader :loading="loading">
        <p v-if="loadError" class="rounded-2xl bg-gray-500 px-4 py-3.5 text-gray">
          {{ $t('This help article is not available.') }}
        </p>
        <template v-else-if="answer">
          <!-- eslint-disable vue/no-v-html, vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -- the server cleans the answer text when it is saved (HasRichText); the click only catches its links, which Enter clicks too -->
          <article
            class="studenthub-kb-body rounded-2xl bg-gray-500 px-4 py-4 text-base"
            :aria-label="answer.title"
            @click="openAppLink"
            v-html="answer.body"
          />
          <!-- eslint-enable vue/no-v-html, vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->

          <section
            v-if="answer.attachments.length"
            aria-labelledby="studenthub-kb-files"
            class="flex flex-col gap-2"
          >
            <h2 id="studenthub-kb-files" class="text-lg font-extrabold">{{ $t('Attachments') }}</h2>
            <ul class="overflow-hidden rounded-2xl bg-gray-500">
              <li
                v-for="file in answer.attachments"
                :key="file.id"
                class="border-b border-gray-400 last:border-0"
              >
                <a
                  :href="`/api/v1/attachments/${file.id}?disposition=attachment`"
                  class="flex items-center gap-3 px-4 py-3.5"
                  download
                >
                  <CommonIcon
                    name="attachment"
                    size="small"
                    class="shrink-0 text-blue"
                    decorative
                  />
                  <span class="grow text-base font-medium break-all">{{ file.filename }}</span>
                  <span class="shrink-0 text-sm text-gray">{{ humanizeFileSize(file.size) }}</span>
                </a>
              </li>
            </ul>
          </section>

          <section
            v-if="isStudent"
            aria-labelledby="studenthub-kb-helpful"
            class="flex flex-col gap-2 rounded-2xl bg-gray-500 px-4 py-3.5"
          >
            <div class="flex items-center justify-between gap-3">
              <h2 id="studenthub-kb-helpful" class="text-base font-bold">
                {{ $t('Was this helpful?') }}
              </h2>
              <div class="flex gap-2">
                <button
                  v-for="choice in [true, false]"
                  :key="String(choice)"
                  type="button"
                  class="h-11 rounded-full border px-4.5 font-semibold"
                  :class="answer.helpful === choice ? 'border-blue bg-blue' : 'border-gray-300'"
                  :aria-pressed="answer.helpful === choice"
                  :disabled="voting"
                  @click="vote(choice)"
                >
                  {{ choice ? $t('Yes') : $t('No') }}
                </button>
              </div>
            </div>
            <p v-if="voted" role="status" class="text-sm text-gray">
              {{ $t('Thank you for telling us.') }}
            </p>
          </section>

          <CommonLink
            v-if="isStudent && ticketCreateEnabled"
            link="/tickets/request"
            class="flex items-center gap-3 rounded-2xl bg-gray-500 px-4 py-3.5"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue">
              <CommonIcon name="add" size="small" decorative />
            </span>
            <span class="flex grow flex-col">
              <span class="text-base font-bold">{{ $t('Still need help?') }}</span>
              <span class="text-sm text-gray">{{ $t('Raise a request') }}</span>
            </span>
            <CommonIcon name="chevron-right" size="small" class="text-gray" decorative />
          </CommonLink>
        </template>
      </CommonLoader>
    </div>
  </div>
</template>

<style scoped>
.studenthub-kb-body {
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.studenthub-kb-body :deep(h1),
.studenthub-kb-body :deep(h2),
.studenthub-kb-body :deep(h3) {
  margin: 1em 0 0.5em;
  font-weight: 800;
  line-height: 1.3;
}

.studenthub-kb-body :deep(h1) {
  font-size: 1.25rem;
}

.studenthub-kb-body :deep(h2) {
  font-size: 1.125rem;
}

.studenthub-kb-body :deep(p),
.studenthub-kb-body :deep(ul),
.studenthub-kb-body :deep(ol),
.studenthub-kb-body :deep(blockquote),
.studenthub-kb-body :deep(pre) {
  margin: 0 0 0.85em;
}

.studenthub-kb-body :deep(ul) {
  list-style: disc;
  padding-inline-start: 1.4em;
}

.studenthub-kb-body :deep(ol) {
  list-style: decimal;
  padding-inline-start: 1.4em;
}

.studenthub-kb-body :deep(a) {
  color: var(--color-blue);
  text-decoration: underline;
}

.studenthub-kb-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

.studenthub-kb-body :deep(blockquote) {
  border-inline-start: 3px solid var(--color-gray-300);
  padding-inline-start: 1em;
  color: var(--color-gray-100);
}

.studenthub-kb-body :deep(pre),
.studenthub-kb-body :deep(table) {
  display: block;
  overflow-x: auto;
}

.studenthub-kb-body :deep(td),
.studenthub-kb-body :deep(th) {
  border: 1px solid var(--color-gray-300);
  padding: 0.35em 0.6em;
}

.studenthub-kb-body :deep(.videoWrapper iframe) {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 0.5rem;
}

.studenthub-kb-body > :deep(:first-child) {
  margin-top: 0;
}

.studenthub-kb-body > :deep(:last-child) {
  margin-bottom: 0;
}
</style>
