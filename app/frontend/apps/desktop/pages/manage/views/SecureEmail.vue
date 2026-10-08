<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: S/MIME and PGP, moved from the classic admin (one page, two kinds): on/off, signing of
// system notifications, certificates or keys, and per team whether new emails are signed and
// encrypted by default. Certificates and keys use Zammad's own API.

type Kind = 'smime' | 'pgp'

const props = defineProps<{ kind: Kind }>()

interface GroupDefault {
  id: number
  name: string
  sign: boolean
  encryption: boolean
}

interface Settings {
  enabled: boolean
  sign_system_notifications: boolean
  recipient_alias: boolean
  groups: GroupDefault[]
}

interface SmimeCertificate {
  id: number
  subject: string
  fingerprint: string
  not_before_at: string
  not_after_at: string
  private_key: string | null
  subject_alternative_name: string
  usage: string[]
}

interface PgpKey {
  id: number
  name: string
  email_addresses: string[]
  fingerprint: string
  expires_at: string | null
  secret: boolean
  domain_alias: string | null
}

interface Entry {
  id: number
  title: string
  detail: string
  fingerprint: string
  expiresAt: string | null
  usage: string[]
  hasPrivate: boolean
}

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const isSmime = computed(() => props.kind === 'smime')
const title = computed(() => (isSmime.value ? __('S/MIME') : __('PGP')))
const breadcrumbItems = computed(() => [
  { label: __('Administration'), to: '/manage' },
  { label: __('Integrations'), to: '/manage/system/integrations' },
  { label: title.value },
])

const settings = ref<Settings | null>(null)
const entries = ref<Entry[]>([])
const gpgProblem = ref<string | null>(null)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

// Adding a certificate / key / private key
const addMode = ref<'certificate' | 'private_key' | 'key' | null>(null)
const pasted = ref('')
const secret = ref('')
const domainAlias = ref('')
const addError = ref<string | null>(null)

const base = computed(() => `/api/v1/integration/${props.kind}`)

const toEntry = (item: SmimeCertificate | PgpKey): Entry =>
  isSmime.value
    ? {
        id: item.id,
        title: (item as SmimeCertificate).subject_alternative_name || (item as SmimeCertificate).subject,
        detail: (item as SmimeCertificate).subject,
        fingerprint: item.fingerprint,
        expiresAt: (item as SmimeCertificate).not_after_at,
        usage: (item as SmimeCertificate).usage ?? [],
        hasPrivate: Boolean((item as SmimeCertificate).private_key),
      }
    : {
        id: item.id,
        title: (item as PgpKey).email_addresses?.join(', ') || (item as PgpKey).name,
        detail: [(item as PgpKey).name, (item as PgpKey).domain_alias && `alias ${(item as PgpKey).domain_alias}`]
          .filter(Boolean)
          .join(' · '),
        fingerprint: item.fingerprint,
        expiresAt: (item as PgpKey).expires_at,
        usage: [],
        hasPrivate: (item as PgpKey).secret,
      }

const load = async () => {
  try {
    const [loadedSettings, list] = await Promise.all([
      studenthubApi<Settings>(`/api/v1/studenthub/integrations/${props.kind}`),
      studenthubApi<(SmimeCertificate | PgpKey)[]>(isSmime.value ? `${base.value}/certificate` : `${base.value}/key`),
    ])
    settings.value = loadedSettings
    entries.value = list.map(toEntry)
    if (!isSmime.value) gpgProblem.value = (await studenthubApi<{ error?: string }>(`${base.value}/status`)).error ?? null
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (settings.value) void load()
})

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'secure-email-saved', type: NotificationTypes.Success, message })
    await load()
    return true
  } catch (error) {
    notify({ id: 'secure-email-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const saveSettings = (changes: Partial<Settings>, message: string) =>
  run(() => studenthubApi(`/api/v1/studenthub/integrations/${props.kind}`, { method: 'PUT', body: changes }), message)

const toggleEnabled = () =>
  saveSettings(
    { enabled: !settings.value?.enabled },
    settings.value?.enabled ? __('Switched off.') : __('Switched on.'),
  )

const toggleSystemSigning = () =>
  saveSettings(
    { sign_system_notifications: !settings.value?.sign_system_notifications },
    __('The setting has been saved.'),
  )

const saveDefaults = () => saveSettings({ groups: settings.value?.groups ?? [] }, __('The team defaults have been saved.'))

const startAdd = (mode: 'certificate' | 'private_key' | 'key') => {
  addMode.value = mode
  pasted.value = ''
  secret.value = ''
  domainAlias.value = ''
  addError.value = null
}

const readFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) pasted.value = await file.text()
}

const add = async () => {
  if (!pasted.value.trim()) {
    addError.value = __('Paste the text or choose a file.')
    return
  }
  const request = (() => {
    if (addMode.value === 'certificate')
      return () => studenthubApi(`${base.value}/certificate`, { method: 'POST', body: { certificate: pasted.value } })
    if (addMode.value === 'private_key')
      return () =>
        studenthubApi(`${base.value}/private_key`, { method: 'POST', body: { private_key: pasted.value, secret: secret.value } })
    return () =>
      studenthubApi(`${base.value}/key`, {
        method: 'POST',
        body: {
          private_key: pasted.value,
          passphrase: secret.value,
          ...(domainAlias.value.trim() ? { domain_alias: domainAlias.value.trim() } : {}),
        },
      })
  })()

  isBusy.value = true
  try {
    await request()
    notify({ id: 'secure-email-saved', type: NotificationTypes.Success, message: __('Added.') })
    addMode.value = null
    await load()
  } catch (error) {
    addError.value = (error as Error).message
  } finally {
    isBusy.value = false
  }
}

const remove = async (entry: Entry) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(
    () =>
      isSmime.value
        ? studenthubApi(`${base.value}/certificate`, { method: 'DELETE', body: { id: entry.id } })
        : studenthubApi(`${base.value}/key/${entry.id}`, { method: 'DELETE' }),
    __('Deleted.'),
  )
}

const removePrivateKey = async (entry: Entry) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(
    () => studenthubApi(`${base.value}/private_key`, { method: 'DELETE', body: { id: entry.id } }),
    __('Private key removed.'),
  )
}

const downloads = (entry: Entry) =>
  isSmime.value
    ? [
        { label: __('Certificate'), href: `${base.value}/certificate_download/${entry.id}` },
        ...(entry.hasPrivate ? [{ label: __('Private key'), href: `${base.value}/private_key_download/${entry.id}` }] : []),
      ]
    : [
        { label: __('Public key'), href: `${base.value}/key_download/${entry.id}` },
        ...(entry.hasPrivate ? [{ label: __('Private key'), href: `${base.value}/key_download/${entry.id}?secret=1` }] : []),
      ]

const isExpired = (date: string | null) => Boolean(date) && new Date(date as string).getTime() < Date.now()

const switchClass = (on?: boolean) => (on ? 'bg-[var(--sh-app)]' : 'bg-slate-300')
const knobClass = (on?: boolean) => (on ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5')
const inputClass =
  'w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t(title) }}</h1>
        <p class="mt-1 text-sm text-[var(--sh-muted)]">
          {{
            isSmime
              ? $t('Sign and encrypt emails with S/MIME certificates, and check signed emails that come in.')
              : $t('Sign and encrypt emails with PGP keys, and check signed emails that come in.')
          }}
        </p>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!settings" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <CommonAlert v-if="gpgProblem" variant="warning">{{ $t(gpgProblem) }}</CommonAlert>

        <section aria-labelledby="secure-state" class="flex flex-col gap-4 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="secure-state" class="sr-only">{{ $t('Settings') }}</h2>
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-[var(--sh-ink)]">{{ $t('%s on', $t(title)) }}</p>
              <p class="text-sm text-[var(--sh-muted)]">{{ $t('Agents can sign and encrypt their replies; incoming emails are checked.') }}</p>
            </div>
            <button
              type="button"
              role="switch"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              :class="switchClass(settings.enabled)"
              :aria-checked="settings.enabled"
              :aria-label="$t('%s on', $t(title))"
              :disabled="isBusy"
              @click="toggleEnabled"
            >
              <span class="inline-block size-5 rounded-full bg-white shadow transition-transform" :class="knobClass(settings.enabled)" />
            </button>
          </div>
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-[var(--sh-ink)]">{{ $t('Sign system notifications') }}</p>
              <p class="text-sm text-[var(--sh-muted)]">{{ $t('Emails Zammad sends to agents are signed with the sender address\'s certificate or key.') }}</p>
            </div>
            <button
              type="button"
              role="switch"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              :class="switchClass(settings.sign_system_notifications)"
              :aria-checked="settings.sign_system_notifications"
              :aria-label="$t('Sign system notifications')"
              :disabled="isBusy"
              @click="toggleSystemSigning"
            >
              <span class="inline-block size-5 rounded-full bg-white shadow transition-transform" :class="knobClass(settings.sign_system_notifications)" />
            </button>
          </div>
        </section>

        <section aria-labelledby="secure-entries" class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="secure-entries" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
              {{ isSmime ? $t('Certificates') : $t('Keys') }}
            </h2>
            <div class="flex flex-wrap gap-2">
              <template v-if="isSmime">
                <CommonButton variant="secondary" size="small" prefix-icon="plus" @click="startAdd('certificate')">{{ $t('Add certificate') }}</CommonButton>
                <CommonButton variant="secondary" size="small" prefix-icon="key" @click="startAdd('private_key')">{{ $t('Add private key') }}</CommonButton>
              </template>
              <CommonButton v-else variant="secondary" size="small" prefix-icon="plus" @click="startAdd('key')">{{ $t('Add key') }}</CommonButton>
            </div>
          </div>

          <form
            v-if="addMode"
            class="flex flex-col gap-3 rounded-xl border border-[var(--sh-app)] bg-white p-5"
            :aria-label="$t('Add')"
            novalidate
            @submit.prevent="add"
          >
            <p class="text-sm text-[var(--sh-muted)]">
              <template v-if="addMode === 'certificate'">{{ $t('Paste a certificate (PEM, "-----BEGIN CERTIFICATE-----") or choose the file.') }}</template>
              <template v-else-if="addMode === 'private_key'">{{ $t('Paste the private key (PEM) of a certificate added here, or choose the file. Its certificate is added too if it is in the file.') }}</template>
              <template v-else>{{ $t('Paste a public or private PGP key (armored, "-----BEGIN PGP …") or choose the file.') }}</template>
            </p>
            <label for="secure-file" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('File') }}
              <input id="secure-file" type="file" accept=".pem,.crt,.cer,.key,.asc,.txt" class="text-sm" @change="readFile" />
            </label>
            <label for="secure-text" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Text') }}
              <textarea id="secure-text" v-model="pasted" :class="[inputClass, 'min-h-32 py-2 font-mono text-xs']" />
            </label>
            <label v-if="addMode !== 'certificate'" for="secure-secret" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ addMode === 'key' ? $t('Passphrase (private keys only)') : $t('Password of the private key (if it has one)') }}
              <input id="secure-secret" v-model="secret" type="password" autocomplete="new-password" :class="[inputClass, 'h-9']" />
            </label>
            <label v-if="addMode === 'key' && settings.recipient_alias" for="secure-alias" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Domain alias (optional)') }}
              <input id="secure-alias" v-model="domainAlias" type="text" :class="[inputClass, 'h-9']" />
            </label>
            <CommonAlert v-if="addError" variant="danger" role="alert">{{ addError }}</CommonAlert>
            <div class="flex justify-end gap-2">
              <CommonButton variant="secondary" size="medium" @click="addMode = null">{{ $t('Cancel') }}</CommonButton>
              <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy">
                {{ $t('Add') }}
              </CommonButton>
            </div>
          </form>

          <p v-if="!entries.length" class="text-sm text-[var(--sh-muted)]">
            {{ isSmime ? $t('No certificates yet.') : $t('No keys yet.') }}
          </p>
          <ul v-else class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
            <li v-for="entry in entries" :key="entry.id" class="flex flex-wrap items-start gap-3 px-4 py-3" :aria-label="entry.title">
              <div class="flex min-w-0 grow flex-col gap-0.5">
                <span class="font-semibold break-all text-[var(--sh-ink)]">{{ entry.title }}</span>
                <span class="text-xs break-all text-[var(--sh-muted)]">{{ entry.detail }}</span>
                <span class="font-mono text-xs break-all text-[var(--sh-muted)]">{{ entry.fingerprint }}</span>
                <span class="mt-1 flex flex-wrap gap-1 text-xs">
                  <span
                    v-if="entry.expiresAt"
                    class="rounded-md px-1.5 py-0.5 font-semibold"
                    :class="isExpired(entry.expiresAt) ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'"
                  >
                    {{ isExpired(entry.expiresAt) ? $t('Expired') : $t('Valid until') }}
                    <CommonDateTime :date-time="entry.expiresAt" type="absolute" absolute-format="date" />
                  </span>
                  <span v-for="usage in entry.usage" :key="usage" class="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{{ $t(usage) }}</span>
                  <span
                    class="rounded-md px-1.5 py-0.5 font-semibold"
                    :class="entry.hasPrivate ? 'bg-[var(--sh-app-soft)] text-[var(--sh-app)]' : 'bg-slate-100 text-slate-500'"
                  >
                    {{ entry.hasPrivate ? $t('With private key (can sign / decrypt)') : $t('Public only (can encrypt / verify)') }}
                  </span>
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <a
                  v-for="download in downloads(entry)"
                  :key="download.href"
                  :href="download.href"
                  class="font-semibold text-[var(--sh-app)] hover:underline"
                  download
                >
                  {{ $t('Download %s', $t(download.label).toLowerCase()) }}
                </a>
                <CommonButton
                  v-if="isSmime && entry.hasPrivate"
                  variant="neutral"
                  size="small"
                  :disabled="isBusy"
                  @click="removePrivateKey(entry)"
                >
                  {{ $t('Remove private key') }}
                </CommonButton>
                <CommonButton variant="remove" size="small" icon="trash3" :aria-label="$t('Delete %s', entry.title)" :disabled="isBusy" @click="remove(entry)" />
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="secure-defaults" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="secure-defaults" class="font-semibold text-[var(--sh-ink)]">{{ $t('Defaults for new emails per team') }}</h2>
          <p class="text-sm text-[var(--sh-muted)]">{{ $t('Agents can still change it for each email.') }}</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-start">{{ $t('Team') }}</th>
                  <th class="px-3 py-2 text-center">{{ $t('Sign') }}</th>
                  <th class="px-3 py-2 text-center">{{ $t('Encrypt') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--sh-line)]">
                <tr v-for="group in settings.groups" :key="group.id">
                  <td class="px-3 py-2 font-semibold text-[var(--sh-ink)]">{{ group.name }}</td>
                  <td class="px-3 py-2 text-center">
                    <input v-model="group.sign" type="checkbox" :aria-label="$t('%s: sign', group.name)" />
                  </td>
                  <td class="px-3 py-2 text-center">
                    <input v-model="group.encryption" type="checkbox" :aria-label="$t('%s: encrypt', group.name)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <CommonButton class="self-end" variant="primary" size="medium" :class="'bg-app! text-on-app! hover:bg-app-hover!'" :disabled="isBusy" @click="saveDefaults">
            {{ $t('Save defaults') }}
          </CommonButton>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
