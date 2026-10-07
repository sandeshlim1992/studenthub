<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

// Student Hub: sites (organisations) assigned to managers (Studenthub::ManagerSites). A manager can
// read the tickets of their sites, sees each one's open tickets under Sites and its numbers on
// their dashboard. Each change is saved at once.

interface Site {
  id: number
  name: string
}

interface ManagerSites {
  user_id: number
  name: string
  organization_ids: number[]
}

const sites = ref<Site[]>([])
const managers = ref<ManagerSites[]>([])
const isLoaded = ref(false)
const savingUserId = ref<number | null>(null)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const request = async (path: string, init: RequestInit = {}) => {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  if (init.body) {
    headers['Content-Type'] = 'application/json'
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token
  }
  const response = await fetch(path, { credentials: 'same-origin', ...init, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.error_human || `Request failed (${response.status})`)
  return data
}

const load = async () => {
  try {
    const data = await request('/api/v1/studenthub/manager_sites')
    sites.value = data.organizations
    managers.value = data.managers
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isLoaded.value = true
  }
}

const toggle = async (manager: ManagerSites, site: Site, checked: boolean) => {
  const wanted = checked
    ? [...manager.organization_ids, site.id]
    : manager.organization_ids.filter((id) => id !== site.id)

  savingUserId.value = manager.user_id
  message.value = null
  try {
    const data = await request(`/api/v1/studenthub/manager_sites/${manager.user_id}`, {
      method: 'PUT',
      body: JSON.stringify({ organization_ids: wanted }),
    })
    manager.organization_ids = data.organization_ids
    message.value = { kind: 'success', text: __('Sites of %s saved.').replace('%s', manager.name) }
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    savingUserId.value = null
  }
}

onMounted(load)
</script>

<template>
  <section
    class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
    aria-labelledby="studenthub-manager-sites"
  >
    <h2 id="studenthub-manager-sites" class="mb-1 text-sm font-bold">{{ $t('Manager sites') }}</h2>
    <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">
      {{
        $t(
          'A manager can read the tickets of their sites (customers of that organization), sees each site\'s open tickets under Sites and its numbers on their dashboard. Their teams do not change.',
        )
      }}
    </p>

    <p
      v-if="message"
      role="status"
      class="mb-3 rounded-lg px-3 py-2 text-xs font-medium"
      :class="
        message.kind === 'success'
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
          : 'bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
      "
    >
      {{ message.text }}
    </p>

    <p v-if="!isLoaded" class="text-sm text-slate-600">{{ $t('Loading…') }}</p>
    <p v-else-if="!managers.length" class="text-sm text-slate-600 dark:text-slate-400">
      {{ $t('Nobody has the Managers role yet.') }}
    </p>
    <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="manager in managers" :key="manager.user_id" class="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
        <span class="w-48 shrink-0 text-sm font-medium">{{ manager.name }}</span>
        <fieldset class="flex flex-wrap gap-2" :disabled="savingUserId === manager.user_id">
          <legend class="sr-only">{{ $t('Sites of %s', manager.name) }}</legend>
          <label
            v-for="site in sites"
            :key="site.id"
            :for="`manager-${manager.user_id}-site-${site.id}`"
            class="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
            :class="
              manager.organization_ids.includes(site.id)
                ? 'border-[var(--sh-app)] bg-[var(--sh-app-soft)] font-semibold text-[var(--sh-app)]'
                : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
            "
          >
            <input
              :id="`manager-${manager.user_id}-site-${site.id}`"
              type="checkbox"
              class="h-3.5 w-3.5 accent-blue-800"
              :checked="manager.organization_ids.includes(site.id)"
              @change="toggle(manager, site, ($event.target as HTMLInputElement).checked)"
            />
            {{ site.name }}
          </label>
        </fieldset>
      </li>
    </ul>
  </section>
</template>
