<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Ticket Priorities, moved from the classic admin. Priorities in use can be switched off
// but not deleted.

interface TicketPriority {
  id: number
  name: string
  ui_color: string | null
  ui_icon: string | null
  default_create: boolean
  active: boolean
  note: string | null
  ticket_count: number
}

const HIGHLIGHTS: { value: string | null; label: string }[] = [
  { value: null, label: __('None') },
  { value: 'high-priority', label: __('High (highlighted)') },
  { value: 'low-priority', label: __('Low (muted)') },
]

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Ticket Priorities') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const priorities = ref<TicketPriority[] | null>(null)
const loadError = ref<string | null>(null)
const isBusy = ref(false)
const editing = ref<TicketPriority | null>(null)
const problems = ref<string[]>([])

const load = async () => {
  try {
    priorities.value = (await studenthubApi<{ priorities: TicketPriority[] }>('/api/v1/studenthub/ticket_priorities')).priorities
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (priorities.value) void load()
})

const sorted = computed(() =>
  [...(priorities.value ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
)
const highlightLabel = (value: string | null) => HIGHLIGHTS.find((item) => item.value === value)?.label ?? value ?? ''

const startNew = () => {
  problems.value = []
  editing.value = { id: 0, name: '', ui_color: null, ui_icon: null, default_create: false, active: true, note: '', ticket_count: 0 }
}

const startEdit = (priority: TicketPriority) => {
  problems.value = []
  editing.value = { ...priority, note: priority.note ?? '' }
}

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'ticket-priority-saved', type: NotificationTypes.Success, message })
    await load()
    return true
  } catch (error) {
    notify({ id: 'ticket-priority-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const save = async () => {
  const priority = editing.value
  if (!priority) return

  problems.value = priority.name.trim() ? [] : [__('Enter a name.')]
  if (problems.value.length) return

  const payload = {
    name: priority.name.trim(),
    ui_color: priority.ui_color,
    default_create: priority.default_create,
    active: priority.active,
    note: priority.note?.trim() || null,
  }

  const ok = await run(
    () =>
      priority.id
        ? studenthubApi(`/api/v1/ticket_priorities/${priority.id}`, { method: 'PUT', body: payload })
        : studenthubApi('/api/v1/ticket_priorities', { method: 'POST', body: payload }),
    __('The priority has been saved.'),
  )
  if (ok) editing.value = null
}

const remove = async (priority: TicketPriority) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(() => studenthubApi(`/api/v1/ticket_priorities/${priority.id}`, { method: 'DELETE' }), __('Priority deleted.'))
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Ticket Priorities') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('The ticket lists draw priority bars from names starting with P1 to P4.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          :disabled="Boolean(editing) || !priorities"
          @click="startNew"
        >
          {{ $t('New priority') }}
        </CommonButton>
      </header>

      <form
        v-if="editing"
        class="flex flex-col gap-3 rounded-xl border border-[var(--sh-app)] bg-white p-5"
        :aria-label="editing.id ? $t('Edit priority') : $t('New priority')"
        novalidate
        @submit.prevent="save"
      >
        <h2 class="font-semibold text-[var(--sh-ink)]">{{ editing.id ? $t('Edit priority') : $t('New priority') }}</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label for="ticket-priority-name" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Name') }}
            <input id="ticket-priority-name" v-model="editing.name" type="text" :class="inputClass" />
          </label>
          <label for="ticket-priority-highlight" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Highlight') }}
            <select id="ticket-priority-highlight" v-model="editing.ui_color" :class="inputClass">
              <option v-for="highlight in HIGHLIGHTS" :key="String(highlight.value)" :value="highlight.value">
                {{ $t(highlight.label) }}
              </option>
            </select>
          </label>
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-2">
          <label for="ticket-priority-default" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-priority-default" v-model="editing.default_create" type="checkbox" />
            {{ $t('Default for new tickets') }}
          </label>
          <label for="ticket-priority-active" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-priority-active" v-model="editing.active" type="checkbox" />
            {{ $t('Active') }}
          </label>
        </div>
        <label for="ticket-priority-note" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
          {{ $t('Note') }}
          <input id="ticket-priority-note" v-model="editing.note" type="text" maxlength="250" :class="inputClass" />
        </label>
        <CommonAlert v-if="problems.length" variant="danger" role="alert">
          <ul class="list-disc ps-4">
            <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>
        <div class="flex justify-end gap-2">
          <CommonButton variant="secondary" size="medium" @click="editing = null">{{ $t('Cancel') }}</CommonButton>
          <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy">
            {{ $t('Save priority') }}
          </CommonButton>
        </div>
      </form>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!priorities" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <div v-else class="overflow-x-auto rounded-xl border border-[var(--sh-line)] bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="px-4 py-2.5 text-start">{{ $t('Name') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Highlight') }}</th>
              <th class="px-4 py-2.5 text-end">{{ $t('Tickets') }}</th>
              <th class="px-4 py-2.5"><span class="sr-only">{{ $t('Actions') }}</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--sh-line)]">
            <tr v-for="priority in sorted" :key="priority.id" :class="{ 'opacity-60': !priority.active }">
              <td class="px-4 py-3">
                <span class="font-semibold text-[var(--sh-ink)]">{{ priority.name }}</span>
                <span v-if="!priority.active" class="ms-2 text-xs text-[var(--sh-muted)]">{{ $t('inactive') }}</span>
                <span v-if="priority.default_create" class="ms-2 rounded-md bg-[var(--sh-app-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--sh-app)]">
                  {{ $t('New tickets') }}
                </span>
              </td>
              <td class="px-4 py-3 text-[var(--sh-ink-2)]">{{ $t(highlightLabel(priority.ui_color)) }}</td>
              <td class="px-4 py-3 text-end tabular-nums">{{ priority.ticket_count }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <CommonButton variant="neutral" size="small" icon="pencil" :aria-label="$t('Edit %s', priority.name)" :disabled="Boolean(editing)" @click="startEdit(priority)" />
                  <CommonButton
                    v-if="!priority.ticket_count && !priority.default_create"
                    variant="remove"
                    size="small"
                    icon="trash3"
                    :aria-label="$t('Delete %s', priority.name)"
                    :disabled="isBusy"
                    @click="remove(priority)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>
</template>
