<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import {
  EXCHANGE_DEFAULT_ATTRIBUTES,
  EXCHANGE_ONLINE_ENDPOINT,
  exchangeResultMessage,
  fromAttributeRows,
  newAttributeRow,
  toAttributeRows,
  type AttributeRow,
  type ExchangeConfig,
  type ExchangeJob,
  type ExchangeSettings,
} from '../components/Exchange/exchange.ts'

// Student Hub: Exchange contact import, moved from the classic admin: sign in (Microsoft 365 app or
// a password for Exchange on site), pick address-book folders, map fields to user fields, try it
// without changing anything, save, and sync. Uses Zammad's Exchange API.

const route = useRoute()
const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Integrations'), to: '/manage/system/integrations' },
  { label: __('Exchange') },
]

const data = ref<ExchangeSettings | null>(null)
const lastSync = ref<ExchangeJob | null>(null)
const loadError = ref<string | null>(null)
const stepError = ref<string | null>(null)
const isBusy = ref(false)

const authType = ref<'oauth' | 'basic'>('oauth')
const endpoint = ref(EXCHANGE_ONLINE_ENDPOINT)
const user = ref('')
const password = ref('')
const disableSslVerify = ref(false)

const clientId = ref('')
const clientSecret = ref('')
const clientTenant = ref('')
const isEditingApp = ref(false)

const availableFolders = ref<Record<string, string> | null>(null)
const selectedFolders = ref<string[]>([])
const availableAttributes = ref<Record<string, string> | null>(null)
const attributeRows = ref<AttributeRow[]>([])
const testJob = ref<ExchangeJob | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const resultMessage = computed(() => exchangeResultMessage(route.query.result))

const load = async () => {
  try {
    const [settings, job] = await Promise.all([
      studenthubApi<ExchangeSettings>('/api/v1/studenthub/integrations/exchange'),
      studenthubApi<ExchangeJob | null>('/api/v1/integration/exchange/job_start'),
    ])
    data.value = settings
    lastSync.value = job && Object.keys(job).length ? job : null
    const {config} = settings
    authType.value = config.auth_type === 'basic' ? 'basic' : 'oauth'
    endpoint.value = config.endpoint || EXCHANGE_ONLINE_ENDPOINT
    user.value = config.user ?? ''
    password.value = config.password ?? ''
    disableSslVerify.value = Boolean(config.disable_ssl_verify)
    selectedFolders.value = [...(config.folders ?? [])]
    attributeRows.value = toAttributeRows(config.attributes)
    clientId.value = settings.app?.client_id ?? ''
    clientTenant.value = settings.app?.client_tenant ?? ''
    clientSecret.value = ''
    isEditingApp.value = !settings.app
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (data.value) void load()
})
onBeforeUnmount(() => clearTimeout(pollTimer))

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  stepError.value = null
  try {
    await action()
    notify({ id: 'exchange-saved', type: NotificationTypes.Success, message })
    return true
  } catch (error) {
    stepError.value = (error as Error).message
    return false
  } finally {
    isBusy.value = false
  }
}

const toggleEnabled = async () => {
  if (await run(
    () => studenthubApi('/api/v1/studenthub/integrations/exchange', { method: 'PUT', body: { enabled: !data.value?.enabled } }),
    data.value?.enabled ? __('Exchange switched off.') : __('Exchange switched on.'),
  ))
    await load()
}

// Microsoft 365 app (an app registration in Entra ID with the callback address below)
const saveApp = async () => {
  const ok = await run(async () => {
    const verified = await studenthubApi<{ attributes?: Record<string, unknown>; error?: string }>(
      '/api/v1/external_credentials/exchange/app_verify',
      { method: 'POST', body: { client_id: clientId.value.trim(), client_secret: clientSecret.value, client_tenant: clientTenant.value.trim() } },
    )
    if (verified.error || !verified.attributes) throw new Error(verified.error || __('The app could not be checked.'))

    const body = { name: 'exchange', credentials: verified.attributes }
    if (data.value?.app) await studenthubApi(`/api/v1/external_credentials/${data.value.app.id}`, { method: 'PUT', body })
    else await studenthubApi('/api/v1/external_credentials', { method: 'POST', body })
  }, __('The app has been saved.'))
  if (ok) await load()
}

const connectAccount = () => {
  window.location.href = '/api/v1/external_credentials/exchange/link_account'
}

const disconnectAccount = async () => {
  if (!(await waitForConfirmation(__('Disconnect the Microsoft 365 account? The import stops until you connect again.')))) return
  if (await run(() => studenthubApi('/api/v1/integration/exchange/oauth', { method: 'DELETE' }), __('Account disconnected.'))) await load()
}

const connection = computed<ExchangeConfig>(() => ({
  auth_type: authType.value,
  endpoint: endpoint.value.trim(),
  ...(authType.value === 'basic' ? { user: user.value.trim(), password: password.value } : {}),
  disable_ssl_verify: disableSslVerify.value,
}))

const findServer = () =>
  run(async () => {
    const answer = await studenthubApi<{ result: string; endpoint?: string; message?: string }>(
      '/api/v1/integration/exchange/autodiscover',
      { method: 'POST', body: { user: user.value.trim(), password: password.value, disable_ssl_verify: disableSslVerify.value } },
    )
    if (!answer.endpoint) throw new Error(answer.message || __('The server could not be found. Enter its EWS address.'))
    endpoint.value = answer.endpoint
  }, __('Server found.'))

const loadFolders = () =>
  run(async () => {
    const answer = await studenthubApi<{ result: string; message?: string; folders?: Record<string, string> }>(
      '/api/v1/integration/exchange/folders',
      { method: 'POST', body: connection.value },
    )
    if (answer.result !== 'ok' || !answer.folders) throw new Error(answer.message || __('No folders were found.'))
    availableFolders.value = answer.folders
    selectedFolders.value = selectedFolders.value.filter((id) => id in (answer.folders ?? {}))
  }, __('Folders loaded.'))

const loadAttributes = () =>
  run(async () => {
    if (!selectedFolders.value.length) throw new Error(__('Please select at least one folder.'))
    const answer = await studenthubApi<{ result: string; message?: string; attributes?: Record<string, string> }>(
      '/api/v1/integration/exchange/mapping',
      { method: 'POST', body: { ...connection.value, folders: selectedFolders.value } },
    )
    if (answer.result !== 'ok' || !answer.attributes) throw new Error(answer.message || __('No entries were found in the selected folder(s).'))
    availableAttributes.value = answer.attributes
    if (!attributeRows.value.length) attributeRows.value = toAttributeRows(EXCHANGE_DEFAULT_ATTRIBUTES)
  }, __('Fields loaded.'))

const fullConfig = computed<ExchangeConfig>(() => ({
  ...connection.value,
  folders: selectedFolders.value,
  attributes: fromAttributeRows(attributeRows.value),
}))

const pollTest = async () => {
  const job = await studenthubApi<ExchangeJob>('/api/v1/integration/exchange/job_try?finished=true')
  testJob.value = job
  if (!job?.finished_at && !job?.result?.error) pollTimer = setTimeout(() => void pollTest(), 4000)
}

const startTest = () =>
  run(async () => {
    testJob.value = null
    await studenthubApi('/api/v1/integration/exchange/job_try', { method: 'POST', body: fullConfig.value })
    await pollTest()
  }, __('Trial run started.'))

const save = async () => {
  if (await run(
    () => studenthubApi('/api/v1/studenthub/integrations/exchange', { method: 'PUT', body: { config: fullConfig.value } }),
    __('The Exchange settings have been saved.'),
  ))
    await load()
}

const syncNow = async () => {
  if (await run(() => studenthubApi('/api/v1/integration/exchange/job_start', { method: 'POST' }), __('The import has started.'))) await load()
}

const counts = (job: ExchangeJob) =>
  (['created', 'updated', 'unchanged', 'skipped', 'failed'] as const)
    .filter((key) => job.result?.[key] !== undefined)
    .map((key) => [key, job.result?.[key] as number] as const)

const isConnected = computed(() => (authType.value === 'oauth' ? Boolean(data.value?.account) : Boolean(user.value && password.value)))

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const smallInput = 'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)]'
const primaryClass = 'bg-app! text-on-app! hover:bg-app-hover!'
const sectionClass = 'flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Exchange') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('Imports contacts from Exchange address books as users, so people exist before they first write in.') }}
          </p>
        </div>
        <button
          v-if="data"
          type="button"
          role="switch"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
          :class="data.enabled ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
          :aria-checked="data.enabled"
          :aria-label="$t('Exchange import')"
          :disabled="isBusy"
          @click="toggleEnabled"
        >
          <span
            class="inline-block size-5 rounded-full bg-white shadow transition-transform"
            :class="data.enabled ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'"
          />
        </button>
      </header>

      <CommonAlert v-if="resultMessage" :variant="resultMessage.ok ? 'success' : 'danger'">{{ $t(resultMessage.text) }}</CommonAlert>
      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!data" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <CommonAlert v-if="stepError" variant="danger" role="alert">{{ $t(stepError) }}</CommonAlert>

        <!-- 1. Sign-in -->
        <section aria-labelledby="exchange-signin" :class="sectionClass">
          <h2 id="exchange-signin" class="font-semibold text-[var(--sh-ink)]">{{ $t('1. Sign-in') }}</h2>
          <fieldset class="flex flex-wrap gap-4 text-sm text-[var(--sh-ink)]">
            <legend class="sr-only">{{ $t('How Zammad signs in') }}</legend>
            <label for="exchange-auth-oauth" class="flex items-center gap-2">
              <input id="exchange-auth-oauth" v-model="authType" type="radio" value="oauth" />
              {{ $t('Microsoft 365 (recommended)') }}
            </label>
            <label for="exchange-auth-basic" class="flex items-center gap-2">
              <input id="exchange-auth-basic" v-model="authType" type="radio" value="basic" />
              {{ $t('User and password (Exchange on site)') }}
            </label>
          </fieldset>

          <template v-if="authType === 'oauth'">
            <div v-if="data.app && !isEditingApp" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--sh-page)] px-3 py-2 text-sm">
              <span>{{ $t('App: %s', data.app.client_id) }}<template v-if="data.app.client_tenant"> · {{ $t('tenant %s', data.app.client_tenant) }}</template></span>
              <CommonButton variant="neutral" size="small" @click="isEditingApp = true">{{ $t('Change app') }}</CommonButton>
            </div>
            <form v-else class="flex flex-col gap-3" novalidate @submit.prevent="saveApp">
              <p class="text-sm text-[var(--sh-muted)]">
                {{ $t('Register an app in Microsoft Entra ID with this redirect address, and give it the EWS.AccessAsUser.All permission:') }}
              </p>
              <code class="rounded-lg bg-[var(--sh-page)] px-3 py-2 text-xs break-all select-all">{{ data.callback_url }}</code>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label for="exchange-client-id" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
                  {{ $t('Client ID') }}
                  <input id="exchange-client-id" v-model="clientId" type="text" :class="inputClass" />
                </label>
                <label for="exchange-client-secret" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
                  {{ $t('Client secret') }}
                  <input id="exchange-client-secret" v-model="clientSecret" type="password" autocomplete="new-password" :class="inputClass" />
                </label>
                <label for="exchange-client-tenant" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
                  {{ $t('Tenant ID (optional)') }}
                  <input id="exchange-client-tenant" v-model="clientTenant" type="text" :class="inputClass" />
                </label>
              </div>
              <div class="flex justify-end gap-2">
                <CommonButton v-if="data.app" variant="secondary" size="medium" @click="isEditingApp = false">{{ $t('Cancel') }}</CommonButton>
                <CommonButton variant="primary" type="submit" size="medium" :class="primaryClass" :disabled="isBusy || !clientId || !clientSecret">
                  {{ $t('Save app') }}
                </CommonButton>
              </div>
            </form>

            <div v-if="data.app" class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span v-if="data.account">{{ $t('Connected as %s', data.account.user) }}</span>
              <span v-else class="text-[var(--sh-muted)]">{{ $t('No account connected yet.') }}</span>
              <div class="flex gap-2">
                <CommonButton v-if="data.account" variant="secondary" size="small" :disabled="isBusy" @click="disconnectAccount">{{ $t('Disconnect') }}</CommonButton>
                <CommonButton variant="primary" size="small" :class="primaryClass" @click="connectAccount">
                  {{ data.account ? $t('Connect again') : $t('Connect account') }}
                </CommonButton>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label for="exchange-user" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
                {{ $t('User') }}
                <input id="exchange-user" v-model="user" type="text" autocomplete="off" :class="inputClass" />
              </label>
              <label for="exchange-password" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
                {{ $t('Password') }}
                <input id="exchange-password" v-model="password" type="password" autocomplete="new-password" :class="inputClass" />
              </label>
            </div>
          </template>

          <div class="flex flex-wrap items-end gap-2">
            <label for="exchange-endpoint" class="flex grow flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('EWS address') }}
              <input id="exchange-endpoint" v-model="endpoint" type="url" :class="inputClass" />
            </label>
            <CommonButton v-if="authType === 'basic'" variant="secondary" size="medium" :disabled="isBusy || !user || !password" @click="findServer">
              {{ $t('Find it') }}
            </CommonButton>
          </div>
          <label for="exchange-ssl" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input id="exchange-ssl" v-model="disableSslVerify" type="checkbox" />
            {{ $t("Don't check the server certificate") }}
          </label>
        </section>

        <!-- 2. Folders -->
        <section aria-labelledby="exchange-folders" :class="sectionClass">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="exchange-folders" class="font-semibold text-[var(--sh-ink)]">{{ $t('2. Address book folders') }}</h2>
            <CommonButton variant="secondary" size="small" :disabled="isBusy || !isConnected" @click="loadFolders">{{ $t('Load folders') }}</CommonButton>
          </div>
          <p v-if="!availableFolders" class="text-sm text-[var(--sh-muted)]">
            {{ selectedFolders.length ? $t('%s folder(s) chosen. Load the folders to change them.', selectedFolders.length) : $t('Load the folders after signing in.') }}
          </p>
          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="(path, id) in availableFolders" :key="id">
              <label :for="`exchange-folder-${id}`" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
                <input :id="`exchange-folder-${id}`" v-model="selectedFolders" type="checkbox" :value="id" />
                {{ path }}
              </label>
            </li>
          </ul>
        </section>

        <!-- 3. Fields -->
        <section aria-labelledby="exchange-fields" :class="sectionClass">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="exchange-fields" class="font-semibold text-[var(--sh-ink)]">{{ $t('3. Fields') }}</h2>
            <CommonButton variant="secondary" size="small" :disabled="isBusy || !selectedFolders.length" @click="loadAttributes">{{ $t('Load fields') }}</CommonButton>
          </div>
          <p class="text-sm text-[var(--sh-muted)]">{{ $t('Which Exchange field fills which user field.') }}</p>
          <ul class="flex flex-col gap-2">
            <li v-for="row in attributeRows" :key="row.uid" class="flex flex-wrap items-center gap-2">
              <label :for="`exchange-source-${row.uid}`">
                <span class="sr-only">{{ $t('Exchange field') }}</span>
                <select :id="`exchange-source-${row.uid}`" v-model="row.source" :class="smallInput">
                  <option value="" disabled>{{ $t('Exchange field…') }}</option>
                  <option v-if="row.source && !availableAttributes?.[row.source]" :value="row.source">{{ row.source }}</option>
                  <option v-for="(example, key) in availableAttributes ?? {}" :key="key" :value="key">{{ key }} ({{ example }})</option>
                </select>
              </label>
              <CommonIcon name="arrow-right" size="xs" class="text-[var(--sh-muted)]" decorative />
              <label :for="`exchange-dest-${row.uid}`">
                <span class="sr-only">{{ $t('User field') }}</span>
                <select :id="`exchange-dest-${row.uid}`" v-model="row.dest" :class="smallInput">
                  <option value="" disabled>{{ $t('User field…') }}</option>
                  <option v-for="field in data.user_attributes" :key="field.name" :value="field.name">{{ $t(field.display) }}</option>
                </select>
              </label>
              <button
                type="button"
                class="rounded p-1.5 text-[var(--sh-muted)] hover:text-red-600"
                :aria-label="$t('Remove mapping')"
                @click="attributeRows = attributeRows.filter((item) => item.uid !== row.uid)"
              >
                <CommonIcon name="trash3" size="xs" decorative />
              </button>
            </li>
          </ul>
          <CommonButton class="self-start" variant="secondary" size="small" prefix-icon="plus" @click="attributeRows = [...attributeRows, newAttributeRow()]">
            {{ $t('Add a field') }}
          </CommonButton>
        </section>

        <!-- 4. Try and save -->
        <section aria-labelledby="exchange-try" :class="sectionClass">
          <h2 id="exchange-try" class="font-semibold text-[var(--sh-ink)]">{{ $t('4. Try and save') }}</h2>
          <p v-if="testJob && !testJob.finished_at && !testJob.result?.error" class="text-sm text-[var(--sh-muted)]" role="status">
            {{ $t('Reading the address books…') }}
          </p>
          <CommonAlert v-else-if="testJob?.result?.error" variant="danger">{{ testJob.result.error }}</CommonAlert>
          <ul v-else-if="testJob?.finished_at" class="flex flex-wrap gap-2 text-sm" role="status">
            <li v-for="[key, count] in counts(testJob)" :key="key" class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1">
              <b class="tabular-nums">{{ count }}</b> {{ $t(key) }}
            </li>
          </ul>
          <div class="flex flex-wrap justify-end gap-2">
            <CommonButton variant="secondary" size="medium" :disabled="isBusy || !selectedFolders.length" @click="startTest">
              {{ $t('Try it (changes nothing)') }}
            </CommonButton>
            <CommonButton variant="primary" size="medium" :class="primaryClass" :disabled="isBusy || !selectedFolders.length" @click="save">
              {{ $t('Save') }}
            </CommonButton>
          </div>
        </section>

        <section aria-labelledby="exchange-sync" :class="sectionClass">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="exchange-sync" class="font-semibold text-[var(--sh-ink)]">{{ $t('Last import') }}</h2>
            <CommonButton variant="secondary" size="medium" prefix-icon="arrow-repeat" :disabled="isBusy || !data.enabled" @click="syncNow">
              {{ $t('Import now') }}
            </CommonButton>
          </div>
          <p v-if="!lastSync" class="text-sm text-[var(--sh-muted)]">{{ $t('No import yet.') }}</p>
          <template v-else>
            <p class="text-sm text-[var(--sh-ink-2)]">
              <template v-if="lastSync.finished_at">{{ $t('Finished') }} <CommonDateTime :date-time="lastSync.finished_at" type="relative" /></template>
              <template v-else>{{ $t('Running.') }}</template>
            </p>
            <CommonAlert v-if="lastSync.result?.error" variant="warning">{{ lastSync.result.error }}</CommonAlert>
            <ul v-else class="flex flex-wrap gap-2 text-sm">
              <li v-for="[key, count] in counts(lastSync)" :key="key" class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1">
                <b class="tabular-nums">{{ count }}</b> {{ $t(key) }}
              </li>
            </ul>
          </template>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
