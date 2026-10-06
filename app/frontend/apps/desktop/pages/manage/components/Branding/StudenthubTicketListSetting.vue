<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { i18n } from '#shared/i18n.ts'
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import {
  escalationWarningMinutes,
  formatEscalationDuration,
  isStateTone,
  STUDENTHUB_DEFAULT_ESCALATION_WARNING_MINUTES,
  STUDENTHUB_STATE_TONE_KEYS,
  STUDENTHUB_STATE_TONES,
  stateTypeTone,
  type StudenthubStateTone,
} from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: lets admins choose the colour of each ticket state and the "due soon" point
// of the escalation label in the new UI's ticket lists (settings "studenthub_ticket_state_colors"
// and "studenthub_escalation_warning_minutes", validated on the server as well).

interface TicketState {
  id: number
  name: string
  active: boolean
  state_type?: string
}

interface SettingEntry {
  id: number
  name: string
  state_current?: { value?: unknown }
}

const WARNING_PRESETS = [15, 30, 60, 120, 240, 480]

const colorsSettingId = ref<number | null>(null)
const warningSettingId = ref<number | null>(null)
const states = ref<TicketState[]>([])
const savedColors = ref<Record<string, StudenthubStateTone>>({})
const colors = ref<Record<string, StudenthubStateTone>>({})
const savedWarning = ref(STUDENTHUB_DEFAULT_ESCALATION_WARNING_MINUTES)
const warning = ref(STUDENTHUB_DEFAULT_ESCALATION_WARNING_MINUTES)
const isLoading = ref(true)
const isLocked = ref(false)
const isSaving = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const toneOf = (state: TicketState) => colors.value[String(state.id)] ?? stateTypeTone(state.state_type)

const choose = (state: TicketState, tone: StudenthubStateTone) => {
  colors.value = { ...colors.value, [String(state.id)]: tone }
  message.value = null
}

const warningOptions = computed(() =>
  [...new Set([...WARNING_PRESETS, warning.value])].sort((a, b) => a - b),
)

const durationLabel = (minutes: number) =>
  formatEscalationDuration(minutes, (text, ...args) => i18n.t(text, ...args))

const colorsChanged = computed(() =>
  states.value.some((state) => toneOf(state) !== (savedColors.value[String(state.id)] ?? stateTypeTone(state.state_type))),
)
const warningChanged = computed(() => warning.value !== savedWarning.value)

const requestHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const token = getCSRFToken()
  if (token) headers['X-CSRF-Token'] = token
  return headers
}

const getJson = async (url: string) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

const load = async () => {
  try {
    const [settings, ticketStates] = (await Promise.all([
      getJson('/api/v1/settings'),
      getJson('/api/v1/ticket_states?expand=true'),
    ])) as [SettingEntry[], TicketState[]]

    const colorsSetting = settings.find((entry) => entry.name === 'studenthub_ticket_state_colors')
    const warningSetting = settings.find((entry) => entry.name === 'studenthub_escalation_warning_minutes')
    colorsSettingId.value = colorsSetting?.id ?? null
    warningSettingId.value = warningSetting?.id ?? null

    // The settings API only lists settings the user may change (permission admin.branding).
    if (!colorsSetting || !warningSetting) {
      isLocked.value = true
      message.value = { kind: 'error', text: __('Changing the ticket list colours needs the "admin.branding" permission.') }
    }

    const stored = colorsSetting?.state_current?.value
    savedColors.value = Object.fromEntries(
      Object.entries(stored && typeof stored === 'object' ? stored : {}).filter(([, tone]) => isStateTone(tone)),
    ) as Record<string, StudenthubStateTone>
    colors.value = { ...savedColors.value }

    savedWarning.value = escalationWarningMinutes(warningSetting?.state_current?.value)
    warning.value = savedWarning.value

    states.value = ticketStates
      .filter((state) => state.active)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  } catch {
    message.value = { kind: 'error', text: __('The ticket list colours could not be loaded.') }
  } finally {
    isLoading.value = false
  }
}

const saveSetting = async (id: number, value: unknown) => {
  const response = await fetch(`/api/v1/settings/${id}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: requestHeaders(),
    body: JSON.stringify({ state_current: { value } }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error_human || data.error || __('The settings could not be saved.'))
}

const save = async () => {
  isSaving.value = true
  message.value = null
  try {
    if (colorsChanged.value && colorsSettingId.value) {
      // Every listed state gets an entry, so a later change of its type doesn't change its colour.
      const value = { ...colors.value }
      states.value.forEach((state) => {
        value[String(state.id)] = toneOf(state)
      })
      await saveSetting(colorsSettingId.value, value)
      savedColors.value = value
      colors.value = { ...value }
    }
    if (warningChanged.value && warningSettingId.value) {
      await saveSetting(warningSettingId.value, warning.value)
      savedWarning.value = warning.value
    }
    message.value = { kind: 'success', text: __('Ticket list colours saved.') }
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
    aria-labelledby="studenthub-ticket-list-title"
    :aria-busy="isLoading"
  >
    <div class="space-y-1">
      <h2 id="studenthub-ticket-list-title" class="text-base font-semibold text-slate-800 dark:text-slate-100">
        {{ $t('Ticket list colours') }}
      </h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ $t('How ticket states and SLA deadlines look in the ticket lists of the new UI. Every colour keeps its text readable.') }}
      </p>
    </div>

    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ $t('State colours') }}</h3>
      <p v-if="isLoading" class="text-sm text-slate-500">{{ $t('Loading…') }}</p>
      <ul v-else class="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        <li
          v-for="state in states"
          :key="state.id"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
        >
          <span
            class="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
            :style="{ backgroundColor: STUDENTHUB_STATE_TONES[toneOf(state)].background, color: STUDENTHUB_STATE_TONES[toneOf(state)].text }"
          >
            {{ $t(state.name) }}
          </span>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" :aria-label="$t('Colour of %s', $t(state.name))">
            <button
              v-for="tone in STUDENTHUB_STATE_TONE_KEYS"
              :key="tone"
              type="button"
              role="radio"
              :aria-checked="toneOf(state) === tone"
              :aria-label="$t(STUDENTHUB_STATE_TONES[tone].label)"
              :title="$t(STUDENTHUB_STATE_TONES[tone].label)"
              :disabled="isSaving || isLocked"
              class="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-shadow disabled:cursor-not-allowed disabled:opacity-60"
              :class="toneOf(state) === tone ? 'ring-2 ring-slate-800 ring-offset-1 dark:ring-slate-100' : 'hover:ring-1 hover:ring-slate-400'"
              :style="{ backgroundColor: STUDENTHUB_STATE_TONES[tone].background, borderColor: STUDENTHUB_STATE_TONES[tone].text }"
              @click="choose(state, tone)"
            >
              <CommonIcon
                v-if="toneOf(state) === tone"
                name="check2"
                size="xs"
                decorative
                :style="{ color: STUDENTHUB_STATE_TONES[tone].text }"
              />
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="space-y-1.5">
      <label
        for="studenthub-escalation-warning"
        class="flex flex-col items-start gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
      >
        {{ $t('Show "due soon" before the SLA deadline') }}
        <select
          id="studenthub-escalation-warning"
          v-model.number="warning"
          :disabled="isLoading || isSaving || isLocked"
          class="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          @change="message = null"
        >
          <option v-for="minutes in warningOptions" :key="minutes" :value="minutes">
            {{ durationLabel(minutes) }}
          </option>
        </select>
      </label>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ $t('The label turns amber this long before the deadline and red once it has passed. Zammad itself warns agents 15 minutes before.') }}
      </p>
      <div class="flex flex-wrap items-center gap-2 pt-1" aria-hidden="true">
        <span
          class="rounded px-2 py-0.5 text-xs font-semibold"
          :style="{ backgroundColor: STUDENTHUB_STATE_TONES.red.background, color: STUDENTHUB_STATE_TONES.red.text }"
        >
          {{ $t('overdue %s', durationLabel(45)) }}
        </span>
        <span
          class="rounded px-2 py-0.5 text-xs font-semibold"
          :style="{ backgroundColor: STUDENTHUB_STATE_TONES.amber.background, color: STUDENTHUB_STATE_TONES.amber.text }"
        >
          {{ $t('due in %s', durationLabel(Math.max(1, Math.round(warning / 2)))) }}
        </span>
        <span class="text-xs text-slate-600 dark:text-slate-400">{{ $t('due in %s', durationLabel(warning * 3)) }}</span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="h-10 cursor-pointer rounded-lg bg-app px-5 text-sm font-semibold text-white hover:bg-app-hover disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isLoading || isSaving || isLocked || (!colorsChanged && !warningChanged)"
        @click="save"
      >
        {{ isSaving ? $t('Saving…') : $t('Save ticket list colours') }}
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
