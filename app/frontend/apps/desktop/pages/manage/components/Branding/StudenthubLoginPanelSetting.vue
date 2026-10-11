<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'
import {
  readStudenthubLoginPanel,
  STUDENTHUB_LOGIN_PANEL_DEFAULTS,
  STUDENTHUB_LOGIN_PANEL_FIELDS,
  STUDENTHUB_LOGIN_PANEL_MAX_LENGTHS,
  type StudenthubLoginPanelField,
  type StudenthubLoginPanelTexts,
} from '#desktop/utils/studenthubLoginPanel.ts'

// Student Hub: lets admins write the heading, tagline and description of the sign-in page
// (setting "studenthub_login_panel", validated on the server as well).

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: unknown }
}

const FIELD_LABELS: Record<StudenthubLoginPanelField, string> = {
  heading: __('Heading'),
  tagline: __('Tagline'),
  description: __('Description'),
}

const settingId = ref<number | null>(null)
const saved = ref<StudenthubLoginPanelTexts>({ ...STUDENTHUB_LOGIN_PANEL_DEFAULTS })
const texts = reactive<StudenthubLoginPanelTexts>({ ...STUDENTHUB_LOGIN_PANEL_DEFAULTS })
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const trimmed = computed(
  () =>
    Object.fromEntries(
      STUDENTHUB_LOGIN_PANEL_FIELDS.map((field) => [field, texts[field].trim()]),
    ) as StudenthubLoginPanelTexts,
)

const isChanged = computed(() =>
  STUDENTHUB_LOGIN_PANEL_FIELDS.some((field) => trimmed.value[field] !== saved.value[field]),
)

const isDefault = computed(() =>
  STUDENTHUB_LOGIN_PANEL_FIELDS.every((field) => trimmed.value[field] === STUDENTHUB_LOGIN_PANEL_DEFAULTS[field]),
)

const useDefaults = () => {
  Object.assign(texts, STUDENTHUB_LOGIN_PANEL_DEFAULTS)
  message.value = null
}

const load = async () => {
  try {
    const settings = await studenthubApi<SettingRecord[]>('/api/v1/settings')
    const setting = settings.find((entry) => entry.name === 'studenthub_login_panel')
    if (!setting) return
    settingId.value = setting.id
    saved.value = readStudenthubLoginPanel(setting.state_current?.value)
    Object.assign(texts, saved.value)
  } catch {
    message.value = { kind: 'error', text: __('The sign-in page texts could not be loaded.') }
  } finally {
    isLoading.value = false
  }
}

const save = async () => {
  if (!settingId.value) return
  isSaving.value = true
  message.value = null
  try {
    const value = { ...trimmed.value }
    await studenthubApi(`/api/v1/settings/${settingId.value}`, {
      method: 'PUT',
      body: { state_current: { value } },
    })
    saved.value = value
    Object.assign(texts, value)
    message.value = { kind: 'success', text: __('Sign-in page texts saved.') }
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section
    class="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-900/40"
    aria-labelledby="studenthub-login-panel-title"
    :aria-busy="isLoading"
  >
    <div class="space-y-1">
      <h2 id="studenthub-login-panel-title" class="text-base font-semibold text-slate-800 dark:text-slate-100">
        {{ $t('Sign-in page') }}
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ $t('Texts in the coloured panel of the sign-in page. Leave a text empty to hide that line.') }}
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div class="space-y-4">
        <div v-for="field in STUDENTHUB_LOGIN_PANEL_FIELDS" :key="field" class="relative">
          <label
            :for="`studenthub-login-panel-${field}`"
            class="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            {{ $t(FIELD_LABELS[field]) }}
            <textarea
              v-if="field === 'description'"
              :id="`studenthub-login-panel-${field}`"
              v-model="texts[field]"
              rows="3"
              :maxlength="STUDENTHUB_LOGIN_PANEL_MAX_LENGTHS[field]"
              :disabled="isLoading"
              class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @input="message = null"
            />
            <input
              v-else
              :id="`studenthub-login-panel-${field}`"
              v-model="texts[field]"
              type="text"
              :maxlength="STUDENTHUB_LOGIN_PANEL_MAX_LENGTHS[field]"
              :disabled="isLoading"
              class="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              @input="message = null"
            />
          </label>
          <span
            class="absolute top-0 text-xs text-slate-500 tabular-nums ltr:right-0 rtl:left-0 dark:text-slate-400"
            aria-hidden="true"
          >
            {{ texts[field].length }} / {{ STUDENTHUB_LOGIN_PANEL_MAX_LENGTHS[field] }}
          </span>
        </div>
      </div>

      <!-- Preview of the sign-in page's brand panel, in the application colour -->
      <div
        class="flex flex-col items-center justify-center gap-2 rounded-xl bg-app px-6 py-8 text-center text-on-app"
        aria-hidden="true"
      >
        <span v-if="trimmed.heading" class="text-xl leading-tight font-bold tracking-tight">{{ trimmed.heading }}</span>
        <span v-if="trimmed.tagline" class="text-sm text-white/90">{{ trimmed.tagline }}</span>
        <span v-if="trimmed.description" class="max-w-[36ch] text-xs text-white/80">{{ trimmed.description }}</span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="h-10 cursor-pointer rounded-lg bg-app px-5 text-sm font-semibold text-on-app disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!isChanged || isSaving || !settingId"
        @click="save"
      >
        {{ isSaving ? $t('Saving…') : $t('Save texts') }}
      </button>
      <button
        v-if="!isDefault"
        type="button"
        class="cursor-pointer text-sm font-semibold text-slate-700 underline underline-offset-2 dark:text-slate-300"
        @click="useDefaults"
      >
        {{ $t('Use the default texts') }}
      </button>
      <span
        v-if="message"
        class="text-sm font-medium"
        :class="message.kind === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
        role="status"
      >
        {{ message.text }}
      </span>
    </div>
  </section>
</template>
