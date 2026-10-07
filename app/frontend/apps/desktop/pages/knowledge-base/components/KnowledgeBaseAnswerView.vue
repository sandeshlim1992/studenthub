<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { i18n } from '#shared/i18n/index.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseBreadcrumbs from './KnowledgeBaseBreadcrumbs.vue'
import KnowledgeBaseStateBadge from './KnowledgeBaseStateBadge.vue'

import type { KnowledgeBaseAnswerDetail, KnowledgeBasePublishingEvent } from '../types.ts'

// One answer: its text, attachments and tags. Editors can edit, publish, archive and delete it.

const props = defineProps<{ answerId: number }>()

const router = useRouter()
const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()
const { localeId, primaryLocaleId, knowledgeBase, loadAnswer, changeAnswerState, deleteAnswer, uploadAttachment, deleteAttachment } =
  useStudenthubKnowledgeBase()

const answer = ref<KnowledgeBaseAnswerDetail | null>(null)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

const load = async () => {
  try {
    answer.value = await loadAnswer(props.answerId)
    loadError.value = null
  } catch (error) {
    answer.value = null
    loadError.value = (error as Error).message
  }
}

watch(() => props.answerId, load, { immediate: true })

defineExpose({ load })

const translation = computed(
  () =>
    answer.value?.translations.find((item) => item.kb_locale_id === localeId.value) ??
    answer.value?.translations.find((item) => item.kb_locale_id === primaryLocaleId.value) ??
    answer.value?.translations[0],
)
const isOtherLanguage = computed(() => !!translation.value && translation.value.kb_locale_id !== localeId.value)
const otherLanguageName = computed(
  () => knowledgeBase.value?.locales.find((locale) => locale.id === translation.value?.kb_locale_id)?.name ?? '',
)

const publishingActions = computed<{ event: KnowledgeBasePublishingEvent; label: string }[]>(() => {
  switch (answer.value?.state) {
    case 'draft':
      return [
        { event: 'internal', label: __('Make internal') },
        { event: 'publish', label: __('Publish') },
      ]
    case 'internal':
      return [
        { event: 'publish', label: __('Publish') },
        { event: 'archive', label: __('Archive') },
      ]
    case 'published':
      return [{ event: 'archive', label: __('Archive') }]
    case 'archived':
      return [{ event: 'unarchive', label: __('Unarchive') }]
    default:
      return []
  }
})

const run = async (action: () => Promise<unknown>, successMessage: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'kb-answer-saved', type: NotificationTypes.Success, message: successMessage })
    return true
  } catch (error) {
    notify({ id: 'kb-answer-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const changeState = async (event: KnowledgeBasePublishingEvent) => {
  if (await run(() => changeAnswerState(props.answerId, event), __('The answer has been updated.'))) await load()
}

const remove = async () => {
  if (!(await waitForVariantConfirmation('delete'))) return

  const categoryId = answer.value?.category_id
  if (await run(() => deleteAnswer(props.answerId), __('Answer deleted.'))) {
    await router.push(categoryId ? knowledgeBasePaths.category(categoryId) : knowledgeBasePaths.home())
  }
}

const fileInput = useTemplateRef('file-input')

const upload = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return

  const ok = await run(
    () => Promise.all(files.map((file) => uploadAttachment(props.answerId, file))),
    i18n.t('%s file(s) added.', files.length),
  )
  if (fileInput.value) fileInput.value.value = ''
  if (ok) await load()
}

const removeAttachment = async (attachmentId: number) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  if (await run(() => deleteAttachment(props.answerId, attachmentId), __('File removed.'))) await load()
}

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
</script>

<template>
  <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>

  <article v-else-if="answer && translation" class="flex flex-col gap-5" :aria-label="translation.title">
    <header class="flex flex-col gap-2">
      <KnowledgeBaseBreadcrumbs :category-id="answer.category_id" link-last />
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1.5">
          <h1 class="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
            {{ translation.title }}
            <KnowledgeBaseStateBadge :state="answer.state" />
          </h1>
          <p class="flex flex-wrap items-center gap-x-1 text-sm text-[var(--sh-muted)]">
            <span>{{ $t('Changed') }}</span>
            <CommonDateTime :date-time="translation.updated_at" type="relative" />
            <span v-if="translation.updated_by">{{ $t('by %s', translation.updated_by) }}</span>
          </p>
        </div>
        <div v-if="answer.editable" class="flex flex-wrap gap-2">
          <CommonButton
            variant="primary"
            size="medium"
            prefix-icon="pencil"
            class="bg-app! text-on-app! hover:bg-app-hover!"
            :disabled="isBusy"
            @click="router.push(knowledgeBasePaths.editAnswer(answer.id))"
          >
            {{ $t('Edit') }}
          </CommonButton>
          <CommonButton
            v-for="action in publishingActions"
            :key="action.event"
            variant="secondary"
            size="medium"
            :disabled="isBusy"
            @click="changeState(action.event)"
          >
            {{ $t(action.label) }}
          </CommonButton>
          <CommonButton variant="danger" size="medium" prefix-icon="trash3" :disabled="isBusy" @click="remove">
            {{ $t('Delete') }}
          </CommonButton>
        </div>
      </div>
    </header>

    <CommonAlert v-if="isOtherLanguage" variant="warning">
      {{ $t('This answer has no text in the chosen language yet; showing %s.', otherLanguageName) }}
    </CommonAlert>

    <!-- eslint-disable vue/no-v-html -- the server cleans the answer text when it is saved (HasRichText) -->
    <div
      class="kb-answer-body rounded-xl border border-[var(--sh-line)] bg-white px-6 py-5 text-[var(--sh-ink)]"
      v-html="translation.body"
    />
    <!-- eslint-enable vue/no-v-html -->

    <section
      v-if="answer.attachments.length || answer.editable"
      aria-labelledby="kb-answer-files"
      class="flex flex-col gap-2"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 id="kb-answer-files" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
          {{ $t('Attachments') }}
        </h2>
        <label
          v-if="answer.editable"
          for="studenthub-kb-files"
          class="cursor-pointer text-sm font-semibold text-[var(--sh-app)] hover:underline focus-within:outline-2 focus-within:outline-[var(--sh-app)]"
        >
          {{ $t('Add files') }}
          <input id="studenthub-kb-files" ref="file-input" type="file" multiple class="sr-only" :disabled="isBusy" @change="upload" />
        </label>
      </div>
      <ul v-if="answer.attachments.length" class="flex flex-wrap gap-2">
        <li
          v-for="file in answer.attachments"
          :key="file.id"
          class="flex items-center gap-2 rounded-lg border border-[var(--sh-line)] bg-white px-3 py-1.5 text-sm"
        >
          <CommonIcon name="paperclip" size="xs" class="text-[var(--sh-muted)]" decorative />
          <a
            :href="`/api/v1/attachments/${file.id}?disposition=attachment`"
            class="font-semibold text-[var(--sh-app)] hover:underline"
            download
          >
            {{ file.filename }}
          </a>
          <span class="text-xs text-[var(--sh-muted)]">{{ fileSize(file.size) }}</span>
          <button
            v-if="answer.editable"
            type="button"
            class="rounded p-0.5 text-[var(--sh-muted)] hover:text-red-600"
            :aria-label="$t('Remove %s', file.filename)"
            :disabled="isBusy"
            @click="removeAttachment(file.id)"
          >
            <CommonIcon name="x-lg" size="xs" decorative />
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-[var(--sh-muted)]">{{ $t('No files.') }}</p>
    </section>

    <section v-if="answer.tags.length" aria-labelledby="kb-answer-tags" class="flex flex-col gap-2">
      <h2 id="kb-answer-tags" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('Tags') }}</h2>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="tag in answer.tags"
          :key="tag"
          class="rounded-md bg-[var(--sh-app-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-app)]"
        >
          {{ tag }}
        </li>
      </ul>
    </section>
  </article>

  <p v-else class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
</template>

<style scoped>
.kb-answer-body {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.kb-answer-body :deep(h1),
.kb-answer-body :deep(h2),
.kb-answer-body :deep(h3) {
  margin: 1.1em 0 0.5em;
  font-weight: 700;
  line-height: 1.3;
}

.kb-answer-body :deep(h1) {
  font-size: 1.375rem;
}

.kb-answer-body :deep(h2) {
  font-size: 1.2rem;
}

.kb-answer-body :deep(h3) {
  font-size: 1.05rem;
}

.kb-answer-body :deep(p),
.kb-answer-body :deep(ul),
.kb-answer-body :deep(ol),
.kb-answer-body :deep(table),
.kb-answer-body :deep(blockquote),
.kb-answer-body :deep(pre) {
  margin: 0 0 0.85em;
}

.kb-answer-body :deep(ul) {
  list-style: disc;
  padding-inline-start: 1.5em;
}

.kb-answer-body :deep(ol) {
  list-style: decimal;
  padding-inline-start: 1.5em;
}

.kb-answer-body :deep(a) {
  color: var(--sh-app);
  text-decoration: underline;
}

.kb-answer-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
}

.kb-answer-body :deep(blockquote) {
  border-inline-start: 3px solid var(--sh-line);
  padding-inline-start: 1em;
  color: var(--sh-muted);
}

.kb-answer-body :deep(pre),
.kb-answer-body :deep(code) {
  font-family: var(--sh-mono, monospace);
  font-size: 0.875em;
}

.kb-answer-body :deep(pre) {
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--sh-page);
  padding: 0.75em 1em;
}

.kb-answer-body :deep(table) {
  border-collapse: collapse;
}

.kb-answer-body :deep(td),
.kb-answer-body :deep(th) {
  border: 1px solid var(--sh-line);
  padding: 0.35em 0.6em;
}

.kb-answer-body > :deep(:first-child) {
  margin-top: 0;
}
</style>
