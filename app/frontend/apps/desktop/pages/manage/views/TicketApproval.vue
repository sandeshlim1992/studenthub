<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ApprovalSettings {
  enabled: boolean
  pause_sla: boolean
  group: { id: number; name: string } | null
  role: { id: number; name: string; active: boolean } | null
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

const save = async (changes: Partial<Pick<ApprovalSettings, 'enabled' | 'pause_sla'>>, successText: string) => {
  isSaving.value = true
  message.value = null
  try {
    settings.value = await request({ method: 'PUT', body: JSON.stringify(changes) })
    message.value = { kind: 'success', text: successText }
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
              @change="
                save(
                  { enabled: ($event.target as HTMLInputElement).checked },
                  ($event.target as HTMLInputElement).checked ? __('Ticket approvals are on.') : __('Ticket approvals are off.'),
                )
              "
            />
            <span>
              <span class="block text-sm font-bold">{{ $t('Allow agents to send tickets for approval') }}</span>
              <span class="text-xs text-slate-600 dark:text-slate-400">
                {{
                  $t(
                    'When off, the Approval tab and both overviews are hidden, and tickets waiting for a decision go back to their teams. Earlier decisions are kept.',
                  )
                }}
              </span>
            </span>
          </label>
          <p v-if="settings.pending > 0" class="mt-3 text-xs text-slate-600 dark:text-slate-400">
            {{ $t('%s ticket(s) are waiting for a decision.', settings.pending) }}
          </p>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <label for="ticket-approval-pause-sla" class="flex cursor-pointer items-start gap-3">
            <input
              id="ticket-approval-pause-sla"
              type="checkbox"
              class="mt-1 h-4 w-4 accent-blue-800"
              :checked="settings.pause_sla"
              :disabled="isSaving"
              @change="
                save(
                  { pause_sla: ($event.target as HTMLInputElement).checked },
                  ($event.target as HTMLInputElement).checked
                    ? __('The SLA pauses while a ticket waits for approval.')
                    : __('The SLA keeps running while a ticket waits for approval.'),
                )
              "
            />
            <span>
              <span class="block text-sm font-bold">{{ $t('Pause the SLA while a ticket waits for approval') }}</span>
              <span class="text-xs text-slate-600 dark:text-slate-400">
                {{
                  $t(
                    'The deadlines stop when a ticket is sent to a manager. After the decision they are worked out again, without the waiting time. Applies to requests sent from now on.',
                  )
                }}
              </span>
            </span>
          </label>
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
          <h2 class="mb-1 text-sm font-bold">{{ $t('Where tickets wait') }}</h2>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            {{
              $t(
                'While a ticket waits for a decision, it is in the group "%s". Only the chosen manager and the agent who asked can open it, and nobody can pick that group as a team. The decision sends the ticket back to its team and owner. Do not give anyone access to this group.',
                settings.group?.name || $t('Managers'),
              )
            }}
          </p>
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
                      : $t('for agents: their requests that wait for a decision')
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
