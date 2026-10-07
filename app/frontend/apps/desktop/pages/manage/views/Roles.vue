<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import { roleSummary, type RoleRow, type RolesOverview } from '../components/Roles/rolePermissions.ts'

// Student Hub: Roles, moved from the classic admin. A role gives its users permissions and, for
// agents, access to teams.

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Roles') },
]

const { notify } = useNotifications()

const overview = ref<RolesOverview | null>(null)
const loadError = ref<string | null>(null)
const busyId = ref<number | null>(null)

const load = async () => {
  try {
    overview.value = await studenthubApi<RolesOverview>('/api/v1/studenthub/roles')
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (overview.value) void load()
})

const roles = computed(() =>
  [...(overview.value?.roles ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  ),
)

const toggleActive = async (role: RoleRow) => {
  busyId.value = role.id
  try {
    const saved = await studenthubApi<{ active: boolean }>(`/api/v1/roles/${role.id}`, {
      method: 'PUT',
      body: { active: !role.active },
    })
    role.active = saved.active
    notify({
      id: 'role-saved',
      type: NotificationTypes.Success,
      message: saved.active ? __('Role switched on.') : __('Role switched off.'),
    })
  } catch (error) {
    notify({ id: 'role-error', type: NotificationTypes.Error, message: (error as Error).message })
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Roles') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('What users with each role may do, and which teams agents work in.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          @click="$router.push('/manage/roles/new')"
        >
          {{ $t('New role') }}
        </CommonButton>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!overview" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <div v-else class="overflow-x-auto rounded-xl border border-[var(--sh-line)] bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th class="px-4 py-2.5 text-start">{{ $t('Name') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Gives') }}</th>
              <th class="px-4 py-2.5 text-end">{{ $t('Active users') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Active') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--sh-line)]">
            <tr v-for="role in roles" :key="role.id" :class="{ 'opacity-60': !role.active }">
              <td class="px-4 py-3">
                <RouterLink
                  :to="`/manage/roles/${role.id}`"
                  class="font-semibold text-[var(--sh-ink)]! hover:text-[var(--sh-app)]! hover:underline"
                >
                  {{ role.name }}
                </RouterLink>
                <span
                  v-if="role.default_at_signup"
                  class="ms-2 rounded-md bg-[var(--sh-app-soft)] px-1.5 py-0.5 text-xs font-semibold text-[var(--sh-app)]"
                >
                  {{ $t('New users get it') }}
                </span>
                <p v-if="role.note" class="mt-0.5 line-clamp-1 text-xs text-[var(--sh-muted)]">{{ role.note }}</p>
              </td>
              <td class="px-4 py-3">
                <span class="flex flex-wrap gap-1">
                  <span
                    v-for="label in roleSummary(role, overview.permissions)"
                    :key="label"
                    class="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700"
                  >
                    {{ $t(label) }}
                  </span>
                </span>
              </td>
              <td class="px-4 py-3 text-end tabular-nums">{{ role.user_count }}</td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
                  :class="role.active ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
                  :aria-checked="role.active"
                  :aria-label="$t('Active: %s', role.name)"
                  :disabled="busyId === role.id"
                  @click="toggleActive(role)"
                >
                  <span
                    class="inline-block size-4 rounded-full bg-white shadow transition-transform"
                    :class="role.active ? 'ltr:translate-x-4.5 rtl:-translate-x-4.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'"
                  />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>
</template>
