<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ApprovalSettings {
  enabled: boolean
  role: { id: number; name: string; active: boolean; groups: Record<string, string[]> } | null
  managers: { id: number; name: string; email: string }[]
  overviews: { name: string; link: string; active: boolean }[]
  pending: number
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Ticket Approvals') },
]

const settings = ref<ApprovalSettings | null>(null)
const isSaving = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const roleGroups = computed(() => Object.entries(settings.value?.role?.groups ?? {}))

const request = async (init: RequestInit = {}) => {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  if (init.body) {
    headers['Content-Type'] = 'application/json'
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token
  }
  const response = await fetch('/api/v1/ticket_approval/settings', { credentials: 'same-origin', ...init, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.error_human || `Request failed (${response.status})`)
  return data as ApprovalSettings
}

const load = async () => {
  try {
    settings.value = await request()
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  }
}

const toggle = async (enabled: boolean) => {
  isSaving.value = true
  message.value = null
  try {
    settings.value = await request({ method: 'PUT', body: JSON.stringify({ enabled }) })
    message.value = {
      kind: 'success',
      text: enabled ? __('Ticket approvals are on.') : __('Ticket approvals are off.'),
    }
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-4xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <header class="mb-6">
        <div class="mb-2 flex items-center gap-3">
          <button
            type="button"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            :title="$t('Back to Administration')"
            :aria-label="$t('Back to Administration')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="h-4 w-4" />
          </button>
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CommonIcon name="check2-circle" class="h-4 w-4" />
          </div>
          <h1 class="text-2xl font-bold">{{ $t('Ticket Approvals') }}</h1>
        </div>
        <p class="text-sm text-slate-600 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
          {{
            $t(
              'Agents send a ticket to a manager from the Approval tab in the ticket sidebar. The manager approves or denies it, and the agent gets the result.',
            )
          }}
        </p>
      </header>

      <p
        v-if="message"
        role="status"
        class="mb-4 rounded-lg px-4 py-3 text-sm font-medium"
        :class="
          message.kind === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
            : 'bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
        "
      >
        {{ message.text }}
      </p>

      <div v-if="settings" class="flex flex-col gap-5">
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <label for="ticket-approval-enabled" class="flex cursor-pointer items-start gap-3">
            <input
              id="ticket-approval-enabled"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-blue-800"
              :checked="settings.enabled"
              :disabled="isSaving"
              @change="toggle(($event.target as HTMLInputElement).checked)"
            />
            <span>
              <span class="block text-sm font-bold">{{ $t('Allow agents to send tickets for approval') }}</span>
              <span class="text-xs text-slate-600 dark:text-slate-400">
                {{ $t('When off, the Approval tab and both overviews are hidden. Existing approvals are kept.') }}
              </span>
            </span>
          </label>
          <p v-if="settings.pending > 0" class="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {{ $t('%s ticket(s) are waiting for a decision.', settings.pending) }}
          </p>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="mb-1 text-sm font-bold">{{ $t('Managers') }}</h2>
          <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">
            {{ $t('Everyone with the Managers role. Add or remove people under Users.') }}
          </p>
          <p v-if="settings.managers.length === 0" class="text-sm text-amber-800 dark:text-amber-300">
            {{ $t('Nobody has the Managers role yet, so agents have no one to send tickets to.') }}
          </p>
          <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <li v-for="manager in settings.managers" :key="manager.id" class="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span class="font-medium">{{ manager.name }}</span>
              <span class="text-slate-600 dark:text-slate-400">{{ manager.email }}</span>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="mb-1 text-sm font-bold">{{ $t('Group access of the Managers role') }}</h2>
          <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">
            {{
              $t(
                'Managers can only open tickets in groups their roles can read. Read access is enough to approve or deny. Change it under Roles → Managers.',
              )
            }}
          </p>
          <p v-if="roleGroups.length === 0" class="text-sm text-amber-800 dark:text-amber-300">
            {{ $t('The Managers role has no group access. Managers who have no other agent role cannot open tickets sent to them.') }}
          </p>
          <ul v-else class="flex flex-wrap gap-2">
            <li
              v-for="[group, access] in roleGroups"
              :key="group"
              class="rounded-md border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700"
            >
              <span class="font-semibold">{{ group }}</span>
              <span class="text-slate-600 dark:text-slate-400"> · {{ access.join(', ') }}</span>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h2 class="mb-3 text-sm font-bold">{{ $t('Overviews') }}</h2>
          <ul class="flex flex-col gap-2 text-sm">
            <li v-for="overview in settings.overviews" :key="overview.link" class="flex items-center justify-between gap-3">
              <span>
                <span class="font-medium">{{ $t(overview.name) }}</span>
                <span class="text-slate-600 dark:text-slate-400">
                  ·
                  {{
                    overview.link === 'awaiting_my_approval'
                      ? $t('for managers: tickets sent to them')
                      : $t('for agents: answers to their requests, until the ticket is closed')
                  }}
                </span>
              </span>
              <span class="text-xs font-semibold" :class="overview.active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500'">
                {{ overview.active ? $t('Shown') : $t('Hidden') }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </LayoutContent>
</template>
