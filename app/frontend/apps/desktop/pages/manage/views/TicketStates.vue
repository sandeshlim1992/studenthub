<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Ticket States, moved from the classic admin. Each state has a type that decides how
// Zammad treats it (open, waiting, closed…); states in use can be switched off but not deleted.

interface TicketState {
  id: number
  name: string
  state_type_id: number
  state_type: string | null
  next_state_id: number | null
  ignore_escalation: boolean
  default_create: boolean
  default_follow_up: boolean
  active: boolean
  note: string | null
  ticket_count: number
}

interface StatesData {
  states: TicketState[]
  state_types: { id: number; name: string }[]
}

const TYPE_LABELS: Record<string, string> = {
  new: __('New'),
  open: __('Open'),
  'pending reminder': __('Pending reminder (waits, then reminds the owner)'),
  'pending action': __('Pending action (waits, then changes to another state)'),
  closed: __('Closed'),
  merged: __('Merged'),
  removed: __('Removed'),
}

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Ticket States') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const data = ref<StatesData | null>(null)
const loadError = ref<string | null>(null)
const isBusy = ref(false)
const editing = ref<TicketState | null>(null)
const problems = ref<string[]>([])

const load = async () => {
  try {
    data.value = await studenthubApi<StatesData>('/api/v1/studenthub/ticket_states')
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (data.value) void load()
})

const states = computed(() =>
  [...(data.value?.states ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
)
// Merged and removed states belong to Zammad itself.
const selectableTypes = computed(() => (data.value?.state_types ?? []).filter((type) => !['merged', 'removed'].includes(type.name)))
const typeName = (id?: number | null) => data.value?.state_types.find((type) => type.id === id)?.name ?? ''
const typeLabel = (name?: string | null) => (name ? (TYPE_LABELS[name] ?? name) : '')
const isLocked = (state: TicketState) => ['merged', 'removed'].includes(state.state_type ?? '')
const stateName = (id: number | null) => data.value?.states.find((state) => state.id === id)?.name ?? ''

const startNew = () => {
  problems.value = []
  editing.value = {
    id: 0,
    name: '',
    state_type_id: data.value?.state_types.find((type) => type.name === 'open')?.id ?? 0,
    state_type: 'open',
    next_state_id: null,
    ignore_escalation: false,
    default_create: false,
    default_follow_up: false,
    active: true,
    note: '',
    ticket_count: 0,
  }
}

const startEdit = (state: TicketState) => {
  problems.value = []
  editing.value = { ...state, note: state.note ?? '' }
}

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'ticket-state-saved', type: NotificationTypes.Success, message })
    await load()
    return true
  } catch (error) {
    notify({ id: 'ticket-state-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const save = async () => {
  const state = editing.value
  if (!state) return

  const isPendingAction = typeName(state.state_type_id) === 'pending action'
  const found: string[] = []
  if (!state.name.trim()) found.push(__('Enter a name.'))
  if (isPendingAction && !state.next_state_id) found.push(__('Choose the state it changes to.'))
  problems.value = found
  if (found.length) return

  const payload = {
    name: state.name.trim(),
    state_type_id: state.state_type_id,
    next_state_id: isPendingAction ? state.next_state_id : null,
    ignore_escalation: state.ignore_escalation,
    default_create: state.default_create,
    default_follow_up: state.default_follow_up,
    active: state.active,
    note: state.note?.trim() || null,
  }

  const ok = await run(
    () =>
      state.id
        ? studenthubApi(`/api/v1/ticket_states/${state.id}`, { method: 'PUT', body: payload })
        : studenthubApi('/api/v1/ticket_states', { method: 'POST', body: payload }),
    __('The state has been saved.'),
  )
  if (ok) editing.value = null
}

const remove = async (state: TicketState) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(() => studenthubApi(`/api/v1/ticket_states/${state.id}`, { method: 'DELETE' }), __('State deleted.'))
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Ticket States') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('The states a ticket can be in. Colours for the ticket lists are set under Branding.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          :disabled="Boolean(editing) || !data"
          @click="startNew"
        >
          {{ $t('New state') }}
        </CommonButton>
      </header>

      <form
        v-if="editing"
        class="flex flex-col gap-3 rounded-xl border border-[var(--sh-app)] bg-white p-5"
        :aria-label="editing.id ? $t('Edit state') : $t('New state')"
        novalidate
        @submit.prevent="save"
      >
        <h2 class="font-semibold text-[var(--sh-ink)]">{{ editing.id ? $t('Edit state') : $t('New state') }}</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label for="ticket-state-name" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Name') }}
            <input id="ticket-state-name" v-model="editing.name" type="text" :class="inputClass" />
          </label>
          <label for="ticket-state-type" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Type') }}
            <select id="ticket-state-type" v-model.number="editing.state_type_id" :class="inputClass">
              <option v-for="type in selectableTypes" :key="type.id" :value="type.id">{{ $t(typeLabel(type.name)) }}</option>
            </select>
          </label>
        </div>
        <label
          v-if="typeName(editing.state_type_id) === 'pending action'"
          for="ticket-state-next"
          class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]"
        >
          {{ $t('Changes to, when the pending time is reached') }}
          <select id="ticket-state-next" v-model.number="editing.next_state_id" :class="inputClass">
            <option :value="null" disabled>{{ $t('Choose…') }}</option>
            <option v-for="state in states.filter((item) => item.id !== editing?.id && !isLocked(item))" :key="state.id" :value="state.id">
              {{ state.name }}
            </option>
          </select>
        </label>
        <div class="flex flex-wrap gap-x-5 gap-y-2">
          <label for="ticket-state-escalation" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-state-escalation" v-model="editing.ignore_escalation" type="checkbox" />
            {{ $t('Pause SLA escalation in this state') }}
          </label>
          <label for="ticket-state-default-create" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-state-default-create" v-model="editing.default_create" type="checkbox" />
            {{ $t('Default for new tickets') }}
          </label>
          <label for="ticket-state-default-follow-up" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-state-default-follow-up" v-model="editing.default_follow_up" type="checkbox" />
            {{ $t('Default when a customer replies to a closed ticket') }}
          </label>
          <label for="ticket-state-active" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="ticket-state-active" v-model="editing.active" type="checkbox" />
            {{ $t('Active') }}
          </label>
        </div>
        <label for="ticket-state-note" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
          {{ $t('Note') }}
          <input id="ticket-state-note" v-model="editing.note" type="text" maxlength="250" :class="inputClass" />
        </label>
        <CommonAlert v-if="problems.length" variant="danger" role="alert">
          <ul class="list-disc ps-4">
            <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>
        <div class="flex justify-end gap-2">
          <CommonButton variant="secondary" size="medium" @click="editing = null">{{ $t('Cancel') }}</CommonButton>
          <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy">
            {{ $t('Save state') }}
          </CommonButton>
        </div>
      </form>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!data" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <div v-else class="overflow-x-auto rounded-xl border border-[var(--sh-line)] bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="px-4 py-2.5 text-start">{{ $t('Name') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Type') }}</th>
              <th class="px-4 py-2.5 text-end">{{ $t('Tickets') }}</th>
              <th class="px-4 py-2.5"><span class="sr-only">{{ $t('Actions') }}</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--sh-line)]">
            <tr v-for="state in states" :key="state.id" :class="{ 'opacity-60': !state.active }">
              <td class="px-4 py-3">
                <span class="font-semibold text-[var(--sh-ink)]">{{ state.name }}</span>
                <span v-if="!state.active" class="ms-2 text-xs text-[var(--sh-muted)]">{{ $t('inactive') }}</span>
                <span class="mt-1 flex flex-wrap gap-1">
                  <span v-if="state.default_create" class="rounded-md bg-[var(--sh-app-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--sh-app)]">
                    {{ $t('New tickets') }}
                  </span>
                  <span v-if="state.default_follow_up" class="rounded-md bg-[var(--sh-app-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--sh-app)]">
                    {{ $t('Customer replies') }}
                  </span>
                  <span v-if="state.ignore_escalation" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                    {{ $t('SLA paused') }}
                  </span>
                  <span v-if="state.next_state_id" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                    {{ $t('then %s', stateName(state.next_state_id)) }}
                  </span>
                </span>
              </td>
              <td class="px-4 py-3 text-[var(--sh-ink-2)]">{{ $t(typeLabel(state.state_type).split(' (')[0]) }}</td>
              <td class="px-4 py-3 text-end tabular-nums">{{ state.ticket_count }}</td>
              <td class="px-4 py-3">
                <div v-if="!isLocked(state)" class="flex justify-end gap-1">
                  <CommonButton variant="neutral" size="small" icon="pencil" :aria-label="$t('Edit %s', state.name)" :disabled="Boolean(editing)" @click="startEdit(state)" />
                  <CommonButton
                    v-if="!state.ticket_count && !state.default_create && !state.default_follow_up"
                    variant="remove"
                    size="small"
                    icon="trash3"
                    :aria-label="$t('Delete %s', state.name)"
                    :disabled="isBusy"
                    @click="remove(state)"
                  />
                </div>
                <span v-else class="block text-end text-xs text-[var(--sh-muted)]">{{ $t('Built in') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>
</template>
