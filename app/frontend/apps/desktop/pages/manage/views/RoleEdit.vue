<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import {
  cleanGroupAccess,
  GROUP_ACCESS,
  includedByParent,
  missingRequirements,
  permissionSections,
  toggleGroupAccess,
  type GroupAccess,
  type RolesOverview,
} from '../components/Roles/rolePermissions.ts'

// Student Hub: one role: name, permissions and, for agents, team access. Saved with Zammad's
// /api/v1/roles.

const route = useRoute()
const router = useRouter()
const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()

const roleId = computed(() => {
  const id = Number(route.params.roleId)
  return Number.isInteger(id) && id > 0 ? id : null
})

const overview = ref<RolesOverview | null>(null)
const loadError = ref<string | null>(null)
const problems = ref<string[]>([])
const isSaving = ref(false)

const name = ref('')
const note = ref('')
const active = ref(true)
const defaultAtSignup = ref(false)
const permissionIds = ref<number[]>([])
const groupAccess = ref<Record<string, GroupAccess[]>>({})

const breadcrumbItems = computed(() => [
  { label: __('Administration'), to: '/manage' },
  { label: __('Roles'), to: '/manage/roles' },
  { label: roleId.value ? name.value || __('Role') : __('New role') },
])

const load = async () => {
  loadError.value = null
  problems.value = []
  try {
    overview.value = await studenthubApi<RolesOverview>('/api/v1/studenthub/roles')
    const role = overview.value.roles.find((item) => item.id === roleId.value)
    if (roleId.value && !role) {
      loadError.value = __('This role does not exist.')
      return
    }
    name.value = role?.name ?? ''
    note.value = role?.note ?? ''
    active.value = role?.active ?? true
    defaultAtSignup.value = role?.default_at_signup ?? false
    permissionIds.value = [...(role?.permission_ids ?? [])]
    groupAccess.value = Object.fromEntries(
      Object.entries(role?.group_ids ?? {}).map(([groupId, access]) => [groupId, [...access]]),
    )
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
watch(roleId, () => load())

const permissions = computed(() => overview.value?.permissions ?? [])
const sections = computed(() => permissionSections(permissions.value))
const chosenNames = computed(() =>
  permissions.value.filter((permission) => permissionIds.value.includes(permission.id)).map((item) => item.name),
)
const hasTeamAccess = computed(() =>
  permissions.value.some((permission) => permission.groups && permissionIds.value.includes(permission.id)),
)
const originalRole = computed(() => overview.value?.roles.find((item) => item.id === roleId.value))

const togglePermission = (id: number) => {
  permissionIds.value = permissionIds.value.includes(id)
    ? permissionIds.value.filter((item) => item !== id)
    : [...permissionIds.value, id]
}

const toggleAccess = (groupId: number, access: GroupAccess) => {
  groupAccess.value = {
    ...groupAccess.value,
    [groupId]: toggleGroupAccess(groupAccess.value[groupId], access),
  }
}

// Admins editing a role they have themselves could take away their own access to this page.
const losesOwnAccess = computed(() => {
  if (!roleId.value || !overview.value?.my_role_ids.includes(roleId.value)) return false
  const had = permissions.value.filter((item) => originalRole.value?.permission_ids.includes(item.id)).map((item) => item.name)
  const keeps = (names: string[]) => names.includes('admin') || names.includes('admin.role')
  return keeps(had) && !keeps(chosenNames.value)
})

const save = async () => {
  const found: string[] = []
  if (!name.value.trim()) found.push(__('Give the role a name.'))
  problems.value = found
  if (found.length) return

  if (losesOwnAccess.value) {
    const confirmed = await waitForConfirmation(
      __('You have this role. Without the admin permission you may no longer manage roles. Save anyway?'),
    )
    if (!confirmed) return
  }

  isSaving.value = true
  const payload = {
    name: name.value.trim(),
    note: note.value.trim(),
    active: active.value,
    default_at_signup: defaultAtSignup.value,
    permission_ids: permissionIds.value,
    group_ids: hasTeamAccess.value ? cleanGroupAccess(groupAccess.value) : {},
  }

  try {
    if (roleId.value) await studenthubApi(`/api/v1/roles/${roleId.value}`, { method: 'PUT', body: payload })
    else await studenthubApi('/api/v1/roles', { method: 'POST', body: payload })
    notify({ id: 'role-saved', type: NotificationTypes.Success, message: __('The role has been saved.') })
    await router.push('/manage/roles')
  } catch (error) {
    problems.value = [(error as Error).message]
  } finally {
    isSaving.value = false
  }
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
        {{ roleId ? $t('Edit role') : $t('New role') }}
      </h1>

      <CommonAlert v-if="loadError" variant="danger">{{ $t(loadError) }}</CommonAlert>
      <p v-else-if="!overview" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="save">
        <section aria-labelledby="role-basics" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="role-basics" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('Role') }}</h2>
          <label for="role-name" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Name') }}
            <input id="role-name" v-model="name" type="text" required :class="inputClass" />
          </label>
          <label for="role-note" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Note') }}
            <input id="role-note" v-model="note" type="text" maxlength="250" :class="inputClass" />
          </label>
          <div class="flex flex-wrap gap-5">
            <label for="role-active" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
              <input id="role-active" v-model="active" type="checkbox" />
              {{ $t('Active') }}
            </label>
            <label for="role-signup" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
              <input id="role-signup" v-model="defaultAtSignup" type="checkbox" />
              {{ $t('New users get this role') }}
            </label>
          </div>
          <CommonAlert v-if="originalRole?.name === 'Admin'" variant="info">
            {{ $t('Student Hub gives this role full access to every team, for the Teams views; team changes here are put back.') }}
          </CommonAlert>
          <CommonAlert v-if="originalRole?.name === 'Managers'" variant="info">
            {{ $t('This is the Managers role of Ticket Approvals: its users approve or deny tickets. It needs "Approve tickets".') }}
          </CommonAlert>
        </section>

        <section aria-labelledby="role-permissions" class="flex flex-col gap-4 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="role-permissions" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
            {{ $t('Permissions') }}
          </h2>
          <fieldset v-for="section in sections" :key="section.key" class="flex flex-col gap-1.5">
            <legend class="mb-1 text-sm font-bold text-[var(--sh-ink)]">{{ $t(section.title) }}</legend>
            <div class="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
              <label
                v-for="permission in section.permissions"
                :key="permission.id"
                :for="`role-permission-${permission.id}`"
                class="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--sh-page)]"
              >
                <input
                  :id="`role-permission-${permission.id}`"
                  type="checkbox"
                  class="mt-1"
                  :checked="permissionIds.includes(permission.id) || includedByParent(permission, chosenNames)"
                  :disabled="includedByParent(permission, chosenNames)"
                  @change="togglePermission(permission.id)"
                />
                <span class="flex flex-col">
                  <span class="text-sm font-semibold text-[var(--sh-ink)]">{{ $t(permission.label) }}</span>
                  <span class="text-xs text-[var(--sh-muted)]">
                    {{ $t(permission.description) }}
                    <template v-if="includedByParent(permission, chosenNames)">{{ $t('(included)') }}</template>
                    <template
                      v-else-if="permissionIds.includes(permission.id) && missingRequirements(permission, chosenNames).length"
                    >
                      <span class="font-semibold text-amber-700">{{ $t('Only works with "Agent tickets".') }}</span>
                    </template>
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        </section>

        <section
          v-if="hasTeamAccess"
          aria-labelledby="role-teams"
          class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5"
        >
          <h2 id="role-teams" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('Team access') }}</h2>
          <p class="text-sm text-[var(--sh-muted)]">
            {{ $t('Full includes everything; read lets agents see tickets, change lets them work on them.') }}
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-start">{{ $t('Team') }}</th>
                  <th v-for="access in GROUP_ACCESS" :key="access.value" class="px-3 py-2 text-center">{{ $t(access.label) }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--sh-line)]">
                <tr v-for="group in overview.groups" :key="group.id" :class="{ 'opacity-60': !group.active }">
                  <td class="px-3 py-2 font-semibold text-[var(--sh-ink)]">{{ group.name }}</td>
                  <td v-for="access in GROUP_ACCESS" :key="access.value" class="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      :aria-label="$t('%s: %s', group.name, $t(access.label))"
                      :checked="(groupAccess[group.id] ?? []).includes(access.value) || (access.value !== 'full' && (groupAccess[group.id] ?? []).includes('full'))"
                      :disabled="access.value !== 'full' && (groupAccess[group.id] ?? []).includes('full')"
                      @change="toggleAccess(group.id, access.value)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <CommonAlert v-if="problems.length" variant="danger" role="alert">
          <ul class="list-disc ps-4">
            <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>

        <div class="flex justify-end gap-2">
          <CommonButton variant="secondary" size="medium" @click="router.push('/manage/roles')">{{ $t('Cancel') }}</CommonButton>
          <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isSaving">
            {{ $t('Save role') }}
          </CommonButton>
        </div>
      </form>
    </div>
  </LayoutContent>
</template>
