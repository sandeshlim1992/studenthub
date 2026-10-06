<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import {
  applyStudenthubAppColor,
  contrastWithWhite,
  isHexColor,
  STUDENTHUB_APP_COLOR_PRESETS,
  STUDENTHUB_DEFAULT_APP_COLOR,
  STUDENTHUB_MIN_APP_COLOR_CONTRAST,
} from '#desktop/utils/studenthubAppColor.ts'

// Student Hub: lets admins choose the application colour of the new UI
// (setting "studenthub_app_color", validated on the server as well).

const settingId = ref<number | null>(null)
const savedColor = ref(STUDENTHUB_DEFAULT_APP_COLOR)
const color = ref(STUDENTHUB_DEFAULT_APP_COLOR)
const hexInput = ref(STUDENTHUB_DEFAULT_APP_COLOR)
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const contrast = computed(() => (isHexColor(color.value) ? contrastWithWhite(color.value) : 0))
const isReadable = computed(() => contrast.value >= STUDENTHUB_MIN_APP_COLOR_CONTRAST)
const isChanged = computed(() => color.value.toLowerCase() !== savedColor.value.toLowerCase())

const choose = (value: string) => {
  color.value = value
  hexInput.value = value
  message.value = null
}

const onHexInput = () => {
  const value = hexInput.value.trim().startsWith('#') ? hexInput.value.trim() : `#${hexInput.value.trim()}`
  if (isHexColor(value)) choose(value.toLowerCase())
}

const load = async () => {
  try {
    const response = await fetch('/api/v1/settings', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    })
    const settings = (await response.json()) as { id: number; name: string; state_current?: { value?: string } }[]
    const setting = settings.find((entry) => entry.name === 'studenthub_app_color')
    if (!setting) return
    settingId.value = setting.id
    const value = setting.state_current?.value
    if (isHexColor(value)) {
      savedColor.value = value
      choose(value)
    }
  } catch {
    message.value = { kind: 'error', text: __('The application colour could not be loaded.') }
  } finally {
    isLoading.value = false
  }
}

const save = async () => {
  if (!settingId.value || !isReadable.value) return
  isSaving.value = true
  message.value = null
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token

    const response = await fetch(`/api/v1/settings/${settingId.value}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify({ state_current: { value: color.value } }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error_human || data.error || __('The colour could not be saved.'))

    savedColor.value = color.value
    applyStudenthubAppColor(color.value)
    message.value = { kind: 'success', text: __('Application colour saved. Everyone sees it after their next page load.') }
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
    aria-labelledby="studenthub-app-color-title"
    :aria-busy="isLoading"
  >
    <div class="space-y-1">
      <h2 id="studenthub-app-color-title" class="text-base font-semibold text-slate-800 dark:text-slate-100">
        {{ $t('Application colour') }}
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ $t('Used for the navigation panel, the sign-in page and the main buttons of the new UI.') }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="$t('Preset colours')">
      <button
        v-for="preset in STUDENTHUB_APP_COLOR_PRESETS"
        :key="preset.value"
        type="button"
        role="radio"
        :aria-checked="color.toLowerCase() === preset.value"
        :title="$t(preset.note)"
        :disabled="isLoading"
        class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
        :class="
          color.toLowerCase() === preset.value
            ? 'border-slate-800 ring-1 ring-slate-800 dark:border-slate-100 dark:ring-slate-100'
            : 'border-slate-300 hover:border-slate-500 dark:border-slate-600'
        "
        @click="choose(preset.value)"
      >
        <span class="h-5 w-5 rounded-full" :style="{ backgroundColor: preset.value }" aria-hidden="true" />
        {{ $t(preset.name) }}
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <label for="studenthub-app-color-picker" class="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {{ $t('Custom colour') }}
        <input
          id="studenthub-app-color-picker"
          type="color"
          class="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-600"
          :value="color"
          :disabled="isLoading"
          @input="choose(($event.target as HTMLInputElement).value)"
        />
      </label>
      <label for="studenthub-app-color-hex" class="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {{ $t('Hex code') }}
        <input
          id="studenthub-app-color-hex"
          v-model="hexInput"
          type="text"
          maxlength="7"
          :disabled="isLoading"
          spellcheck="false"
          class="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          @input="onHexInput"
        />
      </label>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700" aria-hidden="true">
      <div class="flex">
        <div class="flex w-40 flex-col gap-1.5 p-3" :style="{ backgroundColor: color }">
          <span class="text-sm font-bold text-white">Student Hub</span>
          <span class="rounded-md bg-white/20 px-2 py-1 text-xs font-semibold text-white">{{ $t('Overviews') }}</span>
          <span class="px-2 py-1 text-xs text-white/75">{{ $t('Dashboard') }}</span>
        </div>
        <div class="flex flex-1 items-center justify-center gap-3 bg-slate-50 p-4 dark:bg-slate-800">
          <span class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" :style="{ backgroundColor: color }">
            {{ $t('New ticket') }}
          </span>
          <span class="text-sm font-semibold underline underline-offset-2" :style="{ color }">{{ $t('Link') }}</span>
        </div>
      </div>
    </div>

    <p
      class="text-sm font-medium"
      :class="isReadable ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
      role="status"
    >
      {{
        isReadable
          ? $t('White text on this colour: %s:1, easy to read.', contrast.toFixed(1))
          : $t('White text on this colour: %s:1. Choose a darker colour (at least 4.5:1).', contrast.toFixed(1))
      }}
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="h-10 cursor-pointer rounded-lg px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        :style="{ backgroundColor: isReadable ? color : '#64748b' }"
        :disabled="!isChanged || !isReadable || isSaving || !settingId"
        @click="save"
      >
        {{ isSaving ? $t('Saving…') : $t('Save colour') }}
      </button>
      <button
        v-if="color.toLowerCase() !== STUDENTHUB_DEFAULT_APP_COLOR"
        type="button"
        class="cursor-pointer text-sm font-semibold text-slate-700 underline underline-offset-2 dark:text-slate-300"
        @click="choose(STUDENTHUB_DEFAULT_APP_COLOR)"
      >
        {{ $t('Use the default navy') }}
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
