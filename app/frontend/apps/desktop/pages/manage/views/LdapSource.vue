<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import {
  fromGroupRoleRows,
  fromUserAttributeRows,
  mappingProblems,
  newGroupRoleRow,
  newUserAttributeRow,
  splitLdapHost,
  suggestedBaseDn,
  toGroupRoleRows,
  toUserAttributeRows,
  type GroupRoleRow,
  type LdapBindAnswer,
  type LdapDiscoverAnswer,
  type LdapJob,
  type LdapOptions,
  type LdapPreferences,
  type LdapSource,
  type LdapSsl,
  type UserAttributeRow,
} from '../components/Ldap/ldap.ts'

// Student Hub: setting up one LDAP server, the way the classic wizard does: connect, sign in with
// the service account, map user fields and groups to roles, try it without changing anything, save.

type Step = 'connect' | 'bind' | 'mapping' | 'test'

const route = useRoute()
const router = useRouter()
const { notify } = useNotifications()

const sourceId = computed(() => {
  const id = Number(route.params.sourceId)
  return Number.isInteger(id) && id > 0 ? id : null
})

const breadcrumbItems = computed(() => [
  { label: __('Administration'), to: '/manage' },
  { label: __('LDAP'), to: '/manage/system/integrations/ldap' },
  { label: sourceId.value ? name.value || __('LDAP server') : __('Add LDAP server') },
])

const options = ref<LdapOptions | null>(null)
const loadError = ref<string | null>(null)
const stepError = ref<string | null>(null)
const isBusy = ref(false)
const step = ref<Step>('connect')

const name = ref('')
const active = ref(true)
const host = ref('')
const ssl = ref<LdapSsl>('ssl')
const sslVerify = ref(true)
const baseDn = ref('')
const bindUser = ref('')
const bindPw = ref('')
const userFilter = ref('')
const unassignedUsers = ref<'sigup_roles' | 'skip_sync'>('sigup_roles')
const userRows = ref<UserAttributeRow[]>([])
const groupRows = ref<GroupRoleRow[]>([])
// Settings found while connecting and signing in (uid attributes, group filter, …)
const extra = ref<LdapPreferences>({})

const namingContexts = ref<string[]>([])
const ldapAttributes = ref<Record<string, string>>({})
const ldapGroups = ref<string[]>([])
const testJob = ref<LdapJob | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const reset = () => {
  loadError.value = null
  stepError.value = null
  step.value = 'connect'
  name.value = ''
  active.value = true
  host.value = ''
  ssl.value = 'ssl'
  sslVerify.value = true
  baseDn.value = ''
  bindUser.value = ''
  bindPw.value = ''
  userFilter.value = ''
  unassignedUsers.value = 'sigup_roles'
  userRows.value = []
  groupRows.value = []
  extra.value = {}
  testJob.value = null
}

const load = async () => {
  reset()
  try {
    options.value = await studenthubApi<LdapOptions>('/api/v1/studenthub/ldap')
    if (!sourceId.value) return

    const source = await studenthubApi<LdapSource>(`/api/v1/ldap_sources/${sourceId.value}`)
    const preferences = source.preferences ?? {}
    name.value = source.name
    active.value = source.active
    host.value = preferences.host ?? ''
    ssl.value = preferences.ssl ?? 'ssl'
    sslVerify.value = preferences.ssl_verify !== false
    baseDn.value = preferences.base_dn ?? ''
    bindUser.value = preferences.bind_user ?? ''
    bindPw.value = preferences.bind_pw ?? ''
    userFilter.value = preferences.user_filter ?? ''
    unassignedUsers.value = preferences.unassigned_users ?? 'sigup_roles'
    userRows.value = toUserAttributeRows(preferences.user_attributes)
    groupRows.value = toGroupRoleRows(preferences.group_role_map, preferences.group_role_recursive)
    extra.value = preferences
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

// The page is kept alive: start again from the server each time it is shown.
let skipNextActivation = false
onMounted(() => {
  skipNextActivation = true
  void load()
})
onActivated(() => {
  if (skipNextActivation) {
    skipNextActivation = false
    return
  }
  void load()
})
watch(sourceId, () => load())
onBeforeUnmount(() => clearTimeout(pollTimer))

const connection = () => ({ host: host.value.trim(), ssl: ssl.value, ssl_verify: ssl.value === 'off' ? false : sslVerify.value })

const normalizeHost = () => {
  const split = splitLdapHost(host.value)
  host.value = split.host
  if (split.ssl) ssl.value = split.ssl
}

const discover = async () => {
  normalizeHost()
  if (!name.value.trim() || !host.value.trim()) {
    stepError.value = __('Enter a name and the server address.')
    return
  }
  isBusy.value = true
  stepError.value = null
  try {
    const answer = await studenthubApi<LdapDiscoverAnswer>('/api/v1/integration/ldap/discover', {
      method: 'POST',
      body: connection(),
    })
    if (answer.result !== 'ok') {
      stepError.value = answer.message || __('The server could not be reached.')
      return
    }
    namingContexts.value = answer.attributes?.namingcontexts ?? []
    if (!baseDn.value) baseDn.value = suggestedBaseDn(namingContexts.value)
    step.value = 'bind'
  } catch (error) {
    stepError.value = (error as Error).message
  } finally {
    isBusy.value = false
  }
}

const bind = async () => {
  isBusy.value = true
  stepError.value = null
  try {
    const answer = await studenthubApi<LdapBindAnswer>('/api/v1/integration/ldap/bind', {
      method: 'POST',
      body: {
        ...connection(),
        base_dn: baseDn.value.trim(),
        bind_user: bindUser.value.trim(),
        bind_pw: bindPw.value,
        ...(sourceId.value ? { ldap_source_id: sourceId.value } : {}),
      },
    })
    if (answer.result !== 'ok') {
      stepError.value = answer.message || __('Signing in failed.')
      return
    }
    if (!answer.user_attributes || !Object.keys(answer.user_attributes).length) {
      stepError.value = __('User information could not be retrieved, please check your bind user permissions.')
      return
    }
    if (!answer.groups || !Object.keys(answer.groups).length) {
      stepError.value = __('Group information could not be retrieved, please check your bind user permissions.')
      return
    }
    ldapAttributes.value = answer.user_attributes
    ldapGroups.value = Object.keys(answer.groups).sort()
    // Found values only fill what isn't set yet (as in the classic wizard).
    extra.value = {
      ...extra.value,
      user_uid: extra.value.user_uid || answer.user_uid,
      group_uid: extra.value.group_uid || answer.group_uid,
      group_filter: extra.value.group_filter || answer.group_filter,
    }
    if (!userFilter.value) userFilter.value = answer.user_filter ?? ''
    if (!userRows.value.length) userRows.value = toUserAttributeRows()
    step.value = 'mapping'
  } catch (error) {
    stepError.value = (error as Error).message
  } finally {
    isBusy.value = false
  }
}

const preferences = computed<LdapPreferences>(() => ({
  ...extra.value,
  ...connection(),
  base_dn: baseDn.value.trim(),
  bind_user: bindUser.value.trim(),
  bind_pw: bindPw.value,
  user_filter: userFilter.value.trim(),
  user_attributes: fromUserAttributeRows(userRows.value),
  ...fromGroupRoleRows(groupRows.value),
  unassigned_users: unassignedUsers.value,
}))

const checkMapping = () => {
  const problems = mappingProblems(userRows.value)
  stepError.value = problems[0] ?? null
  return !problems.length
}

const pollTest = async () => {
  try {
    const job = await studenthubApi<LdapJob>('/api/v1/integration/ldap/job_try?finished=true')
    testJob.value = job
    if (!job?.finished_at && !job?.result?.error) pollTimer = setTimeout(pollTest, 4000)
  } catch (error) {
    stepError.value = (error as Error).message
  }
}

const startTest = async () => {
  if (!checkMapping()) return
  isBusy.value = true
  stepError.value = null
  testJob.value = null
  try {
    await studenthubApi('/api/v1/integration/ldap/job_try', {
      method: 'POST',
      body: { ...preferences.value, ...(sourceId.value ? { ldap_source_id: sourceId.value } : {}) },
    })
    step.value = 'test'
    await pollTest()
  } catch (error) {
    stepError.value = (error as Error).message
  } finally {
    isBusy.value = false
  }
}

const roleName = (id: string) => options.value?.roles.find((role) => String(role.id) === id)?.name ?? `#${id}`

const save = async () => {
  if (!checkMapping()) return
  isBusy.value = true
  stepError.value = null
  const payload = { name: name.value.trim(), active: active.value, preferences: preferences.value }
  try {
    if (sourceId.value) await studenthubApi(`/api/v1/ldap_sources/${sourceId.value}`, { method: 'PUT', body: payload })
    else await studenthubApi('/api/v1/ldap_sources', { method: 'POST', body: payload })
    notify({ id: 'ldap-saved', type: NotificationTypes.Success, message: __('The LDAP server has been saved.') })
    await router.push('/manage/system/integrations/ldap')
  } catch (error) {
    stepError.value = (error as Error).message
  } finally {
    isBusy.value = false
  }
}

const steps: { key: Step; label: string }[] = [
  { key: 'connect', label: __('Connect') },
  { key: 'bind', label: __('Sign in') },
  { key: 'mapping', label: __('Mapping') },
  { key: 'test', label: __('Try') },
]

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const smallInput =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)]'
const primaryClass = 'bg-app! text-on-app! hover:bg-app-hover!'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
      <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
        {{ sourceId ? $t('Edit LDAP server') : $t('Add LDAP server') }}
      </h1>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!options" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <ol class="flex flex-wrap gap-2 text-sm" :aria-label="$t('Steps')">
          <li
            v-for="(item, index) in steps"
            :key="item.key"
            class="rounded-full px-3 py-1 font-semibold"
            :class="item.key === step ? 'bg-[var(--sh-app)] text-white' : 'bg-white text-[var(--sh-muted)]'"
            :aria-current="item.key === step ? 'step' : undefined"
          >
            {{ index + 1 }}. {{ $t(item.label) }}
          </li>
        </ol>

        <CommonAlert v-if="stepError" variant="danger" role="alert">{{ $t(stepError) }}</CommonAlert>

        <!-- 1. Connect -->
        <form v-if="step === 'connect'" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5" novalidate @submit.prevent="discover">
          <label for="ldap-name" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Name') }}
            <input id="ldap-name" v-model="name" type="text" :class="inputClass" :placeholder="$t('e.g. College Active Directory')" />
          </label>
          <div class="flex flex-col gap-1">
            <label for="ldap-host" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Server') }}
              <input
                id="ldap-host"
                v-model="host"
                type="text"
                :class="inputClass"
                placeholder="dc.example.ac.uk"
                aria-describedby="ldap-host-help"
                @change="normalizeHost"
              />
            </label>
            <span id="ldap-host-help" class="text-xs text-[var(--sh-muted)]">
              {{ $t('Name or address, with the port if it is not the usual one (e.g. dc.example.ac.uk:3269).') }}
            </span>
          </div>
          <div class="flex flex-wrap items-end gap-4">
            <label for="ldap-ssl" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Encryption') }}
              <select id="ldap-ssl" v-model="ssl" :class="inputClass">
                <option value="ssl">{{ $t('SSL') }}</option>
                <option value="starttls">{{ $t('STARTTLS') }}</option>
                <option value="off">{{ $t('No SSL') }}</option>
              </select>
            </label>
            <label v-if="ssl !== 'off'" for="ldap-verify" class="flex items-center gap-2 pb-2 text-sm text-[var(--sh-ink)]">
              <input id="ldap-verify" v-model="sslVerify" type="checkbox" />
              {{ $t('Check the server certificate') }}
            </label>
            <label for="ldap-active" class="flex items-center gap-2 pb-2 text-sm text-[var(--sh-ink)]">
              <input id="ldap-active" v-model="active" type="checkbox" />
              {{ $t('Active') }}
            </label>
          </div>
          <CommonAlert v-if="ssl !== 'off' && !sslVerify" variant="warning">
            {{ $t('Without checking the certificate, someone in between could read the service account password.') }}
          </CommonAlert>
          <div class="flex justify-end gap-2">
            <CommonButton variant="secondary" size="medium" @click="router.push('/manage/system/integrations/ldap')">{{ $t('Cancel') }}</CommonButton>
            <CommonButton variant="primary" type="submit" size="medium" :class="primaryClass" :disabled="isBusy">{{ $t('Connect') }}</CommonButton>
          </div>
        </form>

        <!-- 2. Sign in -->
        <form v-else-if="step === 'bind'" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5" novalidate @submit.prevent="bind">
          <label for="ldap-base-dn" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Base DN') }}
            <input id="ldap-base-dn" v-model="baseDn" type="text" list="ldap-naming-contexts" :class="inputClass" />
            <datalist id="ldap-naming-contexts">
              <option v-for="dn in namingContexts" :key="dn" :value="dn" />
            </datalist>
          </label>
          <label for="ldap-bind-user" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Service account (bind user)') }}
            <input id="ldap-bind-user" v-model="bindUser" type="text" autocomplete="off" :class="inputClass" />
          </label>
          <label for="ldap-bind-pw" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Password') }}
            <input id="ldap-bind-pw" v-model="bindPw" type="password" autocomplete="new-password" :class="inputClass" />
          </label>
          <div class="flex justify-between gap-2">
            <CommonButton variant="secondary" size="medium" @click="step = 'connect'">{{ $t('Back') }}</CommonButton>
            <CommonButton variant="primary" type="submit" size="medium" :class="primaryClass" :disabled="isBusy">{{ $t('Sign in') }}</CommonButton>
          </div>
        </form>

        <!-- 3. Mapping -->
        <div v-else-if="step === 'mapping'" class="flex flex-col gap-4">
          <section aria-labelledby="ldap-user-map" class="flex flex-col gap-2 rounded-xl border border-[var(--sh-line)] bg-white p-5">
            <h2 id="ldap-user-map" class="font-semibold text-[var(--sh-ink)]">{{ $t('User fields') }}</h2>
            <p class="text-sm text-[var(--sh-muted)]">{{ $t('Which LDAP attribute fills which user field. Login is required.') }}</p>
            <ul class="flex flex-col gap-2">
              <li v-for="row in userRows" :key="row.uid" class="flex flex-wrap items-center gap-2">
                <label :for="`ldap-attr-${row.uid}`">
                  <span class="sr-only">{{ $t('LDAP attribute') }}</span>
                  <select :id="`ldap-attr-${row.uid}`" v-model="row.source" :class="smallInput">
                    <option value="" disabled>{{ $t('LDAP attribute…') }}</option>
                    <option v-if="row.source && !ldapAttributes[row.source]" :value="row.source">{{ row.source }}</option>
                    <option v-for="(label, attribute) in ldapAttributes" :key="attribute" :value="attribute">{{ label }}</option>
                  </select>
                </label>
                <CommonIcon name="arrow-right" size="xs" class="text-[var(--sh-muted)]" decorative />
                <label :for="`ldap-dest-${row.uid}`">
                  <span class="sr-only">{{ $t('User field') }}</span>
                  <select :id="`ldap-dest-${row.uid}`" v-model="row.dest" :class="smallInput">
                    <option value="" disabled>{{ $t('User field…') }}</option>
                    <option v-for="field in options.user_attributes" :key="field.name" :value="field.name">{{ $t(field.display) }}</option>
                  </select>
                </label>
                <button
                  type="button"
                  class="rounded p-1.5 text-[var(--sh-muted)] hover:text-red-600"
                  :aria-label="$t('Remove mapping')"
                  @click="userRows = userRows.filter((item) => item.uid !== row.uid)"
                >
                  <CommonIcon name="trash3" size="xs" decorative />
                </button>
              </li>
            </ul>
            <CommonButton class="self-start" variant="secondary" size="small" prefix-icon="plus" @click="userRows = [...userRows, newUserAttributeRow()]">
              {{ $t('Add a field') }}
            </CommonButton>
          </section>

          <section aria-labelledby="ldap-group-map" class="flex flex-col gap-2 rounded-xl border border-[var(--sh-line)] bg-white p-5">
            <h2 id="ldap-group-map" class="font-semibold text-[var(--sh-ink)]">{{ $t('Groups to roles') }}</h2>
            <p class="text-sm text-[var(--sh-muted)]">
              {{ $t('Members of an LDAP group get the role. With "nested", members of groups inside it count too.') }}
            </p>
            <datalist id="ldap-groups">
              <option v-for="group in ldapGroups" :key="group" :value="group" />
            </datalist>
            <ul class="flex flex-col gap-2">
              <li v-for="row in groupRows" :key="row.uid" class="flex flex-wrap items-center gap-2">
                <label :for="`ldap-group-${row.uid}`" class="min-w-64 grow">
                  <span class="sr-only">{{ $t('LDAP group') }}</span>
                  <input :id="`ldap-group-${row.uid}`" v-model="row.source" type="text" list="ldap-groups" :class="[smallInput, 'w-full']" :placeholder="$t('Group DN…')" />
                </label>
                <CommonIcon name="arrow-right" size="xs" class="text-[var(--sh-muted)]" decorative />
                <label :for="`ldap-role-${row.uid}`">
                  <span class="sr-only">{{ $t('Role') }}</span>
                  <select :id="`ldap-role-${row.uid}`" v-model="row.dest" :class="smallInput">
                    <option value="" disabled>{{ $t('Role…') }}</option>
                    <option v-for="role in options.roles" :key="role.id" :value="String(role.id)">{{ role.name }}</option>
                  </select>
                </label>
                <label :for="`ldap-nested-${row.uid}`" class="flex items-center gap-1.5 text-sm text-[var(--sh-ink)]">
                  <input :id="`ldap-nested-${row.uid}`" v-model="row.recursive" type="checkbox" />
                  {{ $t('nested') }}
                </label>
                <button
                  type="button"
                  class="rounded p-1.5 text-[var(--sh-muted)] hover:text-red-600"
                  :aria-label="$t('Remove mapping')"
                  @click="groupRows = groupRows.filter((item) => item.uid !== row.uid)"
                >
                  <CommonIcon name="trash3" size="xs" decorative />
                </button>
              </li>
            </ul>
            <CommonButton class="self-start" variant="secondary" size="small" prefix-icon="plus" @click="groupRows = [...groupRows, newGroupRoleRow()]">
              {{ $t('Add a group') }}
            </CommonButton>
          </section>

          <section aria-labelledby="ldap-expert" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
            <h2 id="ldap-expert" class="font-semibold text-[var(--sh-ink)]">{{ $t('More settings') }}</h2>
            <label for="ldap-user-filter" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('User filter') }}
              <input id="ldap-user-filter" v-model="userFilter" type="text" :class="[inputClass, 'font-mono']" />
            </label>
            <label for="ldap-unassigned" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Users in none of these groups') }}
              <select id="ldap-unassigned" v-model="unassignedUsers" :class="inputClass">
                <option value="sigup_roles">{{ $t('Assign signup roles') }}</option>
                <option value="skip_sync">{{ $t("Don't synchronize") }}</option>
              </select>
            </label>
          </section>

          <div class="flex flex-wrap justify-between gap-2">
            <CommonButton variant="secondary" size="medium" @click="step = 'bind'">{{ $t('Back') }}</CommonButton>
            <div class="flex gap-2">
              <CommonButton variant="secondary" size="medium" :disabled="isBusy" @click="save">{{ $t('Save without trying') }}</CommonButton>
              <CommonButton variant="primary" size="medium" :class="primaryClass" :disabled="isBusy" @click="startTest">
                {{ $t('Try it (changes nothing)') }}
              </CommonButton>
            </div>
          </div>
        </div>

        <!-- 4. Try -->
        <section v-else aria-labelledby="ldap-try" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="ldap-try" class="font-semibold text-[var(--sh-ink)]">{{ $t('Trial run') }}</h2>
          <p v-if="!testJob?.finished_at && !testJob?.result?.error" class="text-sm text-[var(--sh-muted)]" role="status">
            {{ $t('Reading the directory…') }}
            <template v-if="testJob?.result?.total">{{ $t('%s of %s users', testJob.result.sum ?? 0, testJob.result.total) }}</template>
          </p>
          <CommonAlert v-else-if="testJob?.result?.error || testJob?.result?.info" variant="danger">
            {{ testJob.result.error || testJob.result.info }}
          </CommonAlert>
          <template v-else-if="testJob?.result">
            <p class="text-sm text-[var(--sh-ink)]" role="status">
              {{ $t('A sync would make these changes:') }}
            </p>
            <ul class="flex flex-wrap gap-2 text-sm">
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.created ?? 0 }}</b> {{ $t('new users') }}</li>
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.updated ?? 0 }}</b> {{ $t('updated') }}</li>
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.unchanged ?? 0 }}</b> {{ $t('unchanged') }}</li>
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.skipped ?? 0 }}</b> {{ $t('skipped') }}</li>
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.deactivated ?? 0 }}</b> {{ $t('deactivated') }}</li>
              <li class="rounded-lg bg-[var(--sh-page)] px-2.5 py-1"><b class="tabular-nums">{{ testJob.result.failed ?? 0 }}</b> {{ $t('failed') }}</li>
            </ul>
            <ul v-if="testJob.result.role_ids" class="text-sm text-[var(--sh-ink-2)]">
              <li v-for="(counts, roleId) in testJob.result.role_ids" :key="roleId">
                {{ roleName(String(roleId)) }}: {{ Object.entries(counts).map(([key, count]) => `${count} ${$t(key)}`).join(', ') }}
              </li>
            </ul>
          </template>
          <div class="flex justify-between gap-2">
            <CommonButton variant="secondary" size="medium" @click="step = 'mapping'">{{ $t('Back') }}</CommonButton>
            <CommonButton variant="primary" size="medium" :class="primaryClass" :disabled="isBusy || !testJob?.finished_at" @click="save">
              {{ $t('Save') }}
            </CommonButton>
          </div>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
