<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import { sslLabel, type LdapJob, type LdapOptions, type LdapSource } from '../components/Ldap/ldap.ts'

// Student Hub: LDAP (Active Directory) user sync, moved from the classic admin: switch it on, set up
// servers, and see or start the sync (Zammad syncs every hour while it is on).

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Integrations'), to: '/manage/system/integrations' },
  { label: __('LDAP') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const options = ref<LdapOptions | null>(null)
const sources = ref<LdapSource[]>([])
const lastSync = ref<LdapJob | null>(null)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

const load = async () => {
  try {
    const [loadedOptions, loadedSources, job] = await Promise.all([
      studenthubApi<LdapOptions>('/api/v1/studenthub/ldap'),
      studenthubApi<LdapSource[]>('/api/v1/ldap_sources'),
      studenthubApi<LdapJob | null>('/api/v1/integration/ldap/job_start'),
    ])
    options.value = loadedOptions
    sources.value = [...loadedSources].sort((a, b) => (a.prio ?? 0) - (b.prio ?? 0))
    lastSync.value = job && Object.keys(job).length ? job : null
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (options.value) void load()
})

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'ldap-saved', type: NotificationTypes.Success, message })
    await load()
  } catch (error) {
    notify({ id: 'ldap-error', type: NotificationTypes.Error, message: (error as Error).message })
  } finally {
    isBusy.value = false
  }
}

const toggleEnabled = () =>
  run(
    () => studenthubApi('/api/v1/studenthub/ldap', { method: 'PUT', body: { enabled: !options.value?.enabled } }),
    options.value?.enabled ? __('LDAP sync switched off.') : __('LDAP sync switched on.'),
  )

const syncNow = () =>
  run(() => studenthubApi('/api/v1/integration/ldap/job_start', { method: 'POST' }), __('The sync has started.'))

const remove = async (source: LdapSource) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(() => studenthubApi(`/api/v1/ldap_sources/${source.id}`, { method: 'DELETE' }), __('LDAP server removed.'))
}

const resultLine = (job: LdapJob) => {
  const result = job.result ?? {}
  return [
    [__('created'), result.created],
    [__('updated'), result.updated],
    [__('unchanged'), result.unchanged],
    [__('skipped'), result.skipped],
    [__('deactivated'), result.deactivated],
    [__('failed'), result.failed],
  ].filter(([, count]) => count !== undefined) as [string, number][]
}
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('LDAP') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('Users, their details and roles come from your directory (e.g. Active Directory), synced every hour.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          @click="$router.push('/manage/system/integrations/ldap/new')"
        >
          {{ $t('Add LDAP server') }}
        </CommonButton>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!options" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <section aria-labelledby="ldap-state" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <div>
            <h2 id="ldap-state" class="font-semibold text-[var(--sh-ink)]">{{ $t('LDAP sync') }}</h2>
            <p class="text-sm text-[var(--sh-muted)]">
              {{ options.enabled ? $t('On: users are synced every hour.') : $t('Off: nothing is synced.') }}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            :class="options.enabled ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
            :aria-checked="options.enabled"
            :aria-label="$t('LDAP sync')"
            :disabled="isBusy"
            @click="toggleEnabled"
          >
            <span
              class="inline-block size-5 rounded-full bg-white shadow transition-transform"
              :class="options.enabled ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'"
            />
          </button>
        </section>

        <section aria-labelledby="ldap-sources" class="flex flex-col gap-3">
          <h2 id="ldap-sources" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('Servers') }}</h2>
          <p v-if="!sources.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No LDAP server yet.') }}</p>
          <ul v-else class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
            <li v-for="source in sources" :key="source.id" class="flex flex-wrap items-center gap-3 px-4 py-3" :class="{ 'opacity-60': !source.active }">
              <div class="flex min-w-0 grow flex-col">
                <RouterLink
                  :to="`/manage/system/integrations/ldap/${source.id}`"
                  class="font-semibold text-[var(--sh-ink)]! hover:text-[var(--sh-app)]! hover:underline"
                >
                  {{ source.name }}
                </RouterLink>
                <span class="truncate text-xs text-[var(--sh-muted)]">
                  {{ source.preferences.host }} · {{ $t(sslLabel(source.preferences.ssl)) }} · {{ source.preferences.base_dn }}
                </span>
              </div>
              <span class="text-xs font-semibold" :class="source.active ? 'text-emerald-700' : 'text-slate-500'">
                {{ source.active ? $t('Active') : $t('Inactive') }}
              </span>
              <CommonButton variant="remove" size="small" icon="trash3" :aria-label="$t('Remove %s', source.name)" :disabled="isBusy" @click="remove(source)" />
            </li>
          </ul>
        </section>

        <section aria-labelledby="ldap-sync" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ldap-sync" class="font-semibold text-[var(--sh-ink)]">{{ $t('Last sync') }}</h2>
            <CommonButton variant="secondary" size="medium" prefix-icon="arrow-repeat" :disabled="isBusy || !sources.length" @click="syncNow">
              {{ $t('Sync now') }}
            </CommonButton>
          </div>
          <p v-if="!lastSync" class="text-sm text-[var(--sh-muted)]">{{ $t('No sync yet.') }}</p>
          <template v-else>
            <p class="text-sm text-[var(--sh-ink-2)]">
              <template v-if="lastSync.finished_at">
                {{ $t('Finished') }} <CommonDateTime :date-time="lastSync.finished_at" type="relative" />
              </template>
              <template v-else-if="lastSync.started_at">
                {{ $t('Running since') }} <CommonDateTime :date-time="lastSync.started_at" type="relative" />
              </template>
              <template v-else>{{ $t('Waiting to start.') }}</template>
            </p>
            <CommonAlert v-if="lastSync.result?.error || lastSync.result?.info" variant="warning">
              {{ lastSync.result?.error || lastSync.result?.info }}
            </CommonAlert>
            <ul v-else class="flex flex-wrap gap-2 text-sm">
              <li v-for="[label, count] in resultLine(lastSync)" :key="label" class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1">
                <span class="font-semibold tabular-nums">{{ count }}</span> {{ $t(label) }}
              </li>
            </ul>
          </template>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
