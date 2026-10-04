<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { feedbackApi } from './api.ts'

import type { FeedbackSettings } from './types.ts'

const props = defineProps<{ settings: FeedbackSettings }>()
const emit = defineEmits<{ saved: [settings: FeedbackSettings] }>()

const subject = ref(props.settings.subject)
const template = ref(props.settings.template)
const previewSubject = ref('')
const previewBody = ref('')
const previewError = ref('')
const isSaving = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)
const editor = ref<HTMLTextAreaElement | null>(null)

let previewTimer: ReturnType<typeof setTimeout> | undefined

const refreshPreview = async () => {
  try {
    const result = await feedbackApi.preview(subject.value, template.value)
    previewSubject.value = result.subject
    previewBody.value = result.body
    previewError.value = ''
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
  }
}

watch([subject, template], () => {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(refreshPreview, 400)
})

const placeholderLabel = (name: string) => `{{${name}}}`

const insertPlaceholder = (name: string) => {
  const placeholder = placeholderLabel(name)
  const element = editor.value
  if (!element) {
    template.value += placeholder
    return
  }
  const start = element.selectionStart ?? template.value.length
  const end = element.selectionEnd ?? start
  template.value = template.value.slice(0, start) + placeholder + template.value.slice(end)
  requestAnimationFrame(() => {
    element.focus()
    element.setSelectionRange(start + placeholder.length, start + placeholder.length)
  })
}

const resetToDefault = () => {
  template.value = props.settings.default_template
}

const save = async () => {
  isSaving.value = true
  message.value = null
  try {
    const result = await feedbackApi.saveSettings({ subject: subject.value, template: template.value })
    emit('saved', result)
    message.value = { kind: 'success', text: __('Template saved.') }
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isSaving.value = false
  }
}

onMounted(refreshPreview)
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-4">
      <label for="feedback-subject" class="flex flex-col gap-1.5 text-sm font-semibold">
        {{ $t('Subject') }}
        <input
id="feedback-subject"
          v-model="subject"
          type="text"
          maxlength="250"
          class="h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>

      <div class="flex flex-col gap-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span id="feedback-template-label" class="text-sm font-semibold">{{ $t('HTML template') }}</span>
          <button
            type="button"
            class="cursor-pointer text-sm font-semibold text-blue-800 underline underline-offset-2 dark:text-blue-300"
            @click="resetToDefault"
          >
            {{ $t('Reset to the default template') }}
          </button>
        </div>
        <textarea
          ref="editor"
          v-model="template"
          aria-labelledby="feedback-template-label"
          spellcheck="false"
          class="min-h-[420px] w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm font-semibold">{{ $t('Placeholders') }}</span>
        <p class="text-xs text-slate-600 dark:text-slate-400">
          {{ $t('Click to insert at the cursor. link_1 to link_5 open the feedback page with that many stars selected.') }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="name in settings.placeholders"
            :key="name"
            type="button"
            class="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-700 hover:border-blue-800 hover:text-blue-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            @click="insertPlaceholder(name)"
            v-text="placeholderLabel(name)"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          :disabled="isSaving"
          class="h-10 cursor-pointer rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
          @click="save"
        >
          {{ isSaving ? $t('Saving…') : $t('Save template') }}
        </button>
        <span
          v-if="message"
          role="status"
          class="text-sm font-medium"
          :class="message.kind === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
        >
          {{ message.text }}
        </span>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <span class="text-sm font-semibold">{{ $t('Preview with sample values') }}</span>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700">
        <div class="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
          <span class="text-slate-600 dark:text-slate-400">{{ $t('Subject') }}:</span>
          <strong class="text-slate-800 dark:text-slate-100"> {{ previewSubject }}</strong>
        </div>
        <p v-if="previewError" role="alert" class="px-4 py-3 text-sm text-rose-700">{{ previewError }}</p>
        <iframe
          v-else
          :title="$t('Email preview')"
          sandbox=""
          :srcdoc="previewBody"
          class="block h-[560px] w-full bg-white"
        />
      </div>
    </div>
  </div>
</template>
