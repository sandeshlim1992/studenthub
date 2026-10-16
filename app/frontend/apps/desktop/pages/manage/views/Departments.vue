<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

// Student Hub: Departments (Studenthub::Departments). Each has a name, the campuses it covers
// (from the ticket's Campus field, which admins manage under Objects) and one email address.
// The on/off switch also shows or hides "Talk to Student Support" for students; departments can
// be set up while it is off.

interface Department {
  id: number
  name: string
  locations: string[]
  email: string
  // Campuses it covers that the Campus field no longer has.
  missing_locations: string[]
}

interface Campus {
  value: string
  label: string
}

interface DepartmentDraft {
  name: string
  locations: string[]
  email: string
}

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Departments') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const enabled = ref(false)
const departments = ref<Department[]>([])
const campuses = ref<Campus[]>([])
const isLoaded = ref(false)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

// The department being edited: its saved state (null while new) and the form on screen.
const editing = ref<{ saved: Department | null; draft: DepartmentDraft } | null>(null)

const load = async () => {
  try {
    const data = await studenthubApi<{
      enabled: boolean
      departments: Department[]
      campuses: Campus[]
    }>('/api/v1/studenthub/departments')
    enabled.value = data.enabled
    departments.value = data.departments
    campuses.value = data.campuses
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    isLoaded.value = true
  }
}

onMounted(load)
onActivated(() => {
  if (isLoaded.value && !editing.value) void load()
})

const campusLabel = (value: string) =>
  campuses.value.find((campus) => campus.value === value)?.label ?? value

const draftOf = (department: Department | null): DepartmentDraft => ({
  name: department?.name ?? '',
  locations: [...(department?.locations ?? [])],
  email: department?.email ?? '',
})

const startNew = () => {
  editing.value = { saved: null, draft: draftOf(null) }
}

const startEdit = (department: Department) => {
  editing.value = { saved: department, draft: draftOf(department) }
}

const isDirty = computed(() => {
  if (!editing.value) return false
  const { saved, draft } = editing.value
  return JSON.stringify(draft) !== JSON.stringify(draftOf(saved))
})

// The campuses to tick, plus any the department still has that the Campus field dropped.
const locationChoices = computed(() => {
  const missing = (editing.value?.saved?.missing_locations ?? []).map((value) => ({
    value,
    label: value,
    missing: true,
  }))
  const current = campuses.value.map(({ value, label }) => ({ value, label, missing: false }))
  return [...current, ...missing]
})

const toggleLocation = (value: string, checked: boolean) => {
  const draft = editing.value?.draft
  if (!draft) return
  draft.locations = checked
    ? [...draft.locations, value]
    : draft.locations.filter((location) => location !== value)
}

const close = async () => {
  if (isDirty.value && !(await waitForVariantConfirmation('unsaved'))) return
  editing.value = null
  await load()
}

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'department-saved', type: NotificationTypes.Success, message })
    editing.value = null
    await load()
  } catch (error) {
    notify({
      id: 'department-error',
      type: NotificationTypes.Error,
      message: (error as Error).message,
    })
  } finally {
    isBusy.value = false
  }
}

const save = () => {
  if (!editing.value) return
  const { saved, draft } = editing.value

  return run(
    () =>
      saved
        ? studenthubApi(`/api/v1/studenthub/departments/${saved.id}`, {
            method: 'PUT',
            body: draft,
          })
        : studenthubApi('/api/v1/studenthub/departments', { method: 'POST', body: draft }),
    __('The department has been saved.'),
  )
}

const toggleEnabled = async () => {
  isBusy.value = true
  try {
    const data = await studenthubApi<{ enabled: boolean }>(
      '/api/v1/studenthub/departments/settings',
      { method: 'PUT', body: { enabled: !enabled.value } },
    )
    enabled.value = data.enabled
    notify({
      id: 'department-saved',
      type: NotificationTypes.Success,
      message: data.enabled ? __('Departments are on.') : __('Departments are off.'),
    })
  } catch (error) {
    notify({
      id: 'department-error',
      type: NotificationTypes.Error,
      message: (error as Error).message,
    })
  } finally {
    isBusy.value = false
  }
}

const remove = async () => {
  const saved = editing.value?.saved
  if (!saved || !(await waitForVariantConfirmation('delete'))) return

  return run(
    () => studenthubApi(`/api/v1/studenthub/departments/${saved.id}`, { method: 'DELETE' }),
    __('The department has been deleted.'),
  )
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm font-normal text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const labelClass = 'flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <template v-if="!editing">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
              {{ $t('Departments') }}
            </h1>
            <p class="mt-1 max-w-3xl text-sm text-[var(--sh-muted)]">
              {{ $t('Each department has a name, the campuses it covers and one email address.') }}
            </p>
          </div>
          <CommonButton
            variant="primary"
            size="medium"
            prefix-icon="plus"
            class="bg-app! text-on-app! hover:bg-app-hover!"
            :disabled="!isLoaded || Boolean(loadError)"
            @click="startNew"
          >
            {{ $t('New department') }}
          </CommonButton>
        </header>

        <section
          v-if="isLoaded && !loadError"
          class="flex items-center justify-between gap-4 rounded-xl border border-[var(--sh-line)] bg-white px-4 py-3"
        >
          <div class="min-w-0">
            <h2 id="departments-switch-label" class="font-semibold text-[var(--sh-ink)]">
              {{ $t('Use departments') }}
            </h2>
            <p id="departments-switch-hint" class="text-sm text-[var(--sh-muted)]">
              {{ $t('When on, students see Talk to Student Support on their home page.') }}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
            :class="enabled ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
            :aria-checked="enabled"
            aria-labelledby="departments-switch-label"
            aria-describedby="departments-switch-hint"
            :disabled="isBusy"
            @click="toggleEnabled"
          >
            <span
              class="inline-block size-5 rounded-full bg-white shadow transition-transform"
              :class="
                enabled
                  ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5'
                  : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'
              "
            />
          </button>
        </section>

        <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
        <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
        <p
          v-else-if="!departments.length"
          class="rounded-xl border border-dashed border-[var(--sh-line)] bg-white px-4 py-8 text-center text-sm text-[var(--sh-muted)]"
        >
          {{ $t('No departments yet.') }}
        </p>

        <ul
          v-else
          class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white"
        >
          <li
            v-for="department in departments"
            :key="department.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3"
            :aria-label="department.name"
          >
            <div class="flex min-w-0 grow flex-col gap-0.5">
              <span class="font-semibold text-[var(--sh-ink)]">{{ department.name }}</span>
              <span class="text-xs text-[var(--sh-muted)]">
                {{ department.locations.map(campusLabel).join(', ') }} · {{ department.email }}
              </span>
              <span
                v-if="department.missing_locations.length"
                class="text-xs font-semibold text-red-700"
              >
                {{ $t('No longer a campus: %s', department.missing_locations.join(', ')) }}
              </span>
            </div>
            <CommonButton
              variant="neutral"
              size="small"
              icon="pencil"
              :aria-label="$t('Edit %s', department.name)"
              @click="startEdit(department)"
            />
          </li>
        </ul>
      </template>

      <template v-else>
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              class="flex items-center gap-1 self-start text-sm font-semibold text-[var(--sh-app)] hover:underline"
              @click="close"
            >
              <CommonIcon name="chevron-left" size="xs" decorative />
              {{ $t('All departments') }}
            </button>
            <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
              {{ editing.saved?.name || $t('New department') }}
            </h1>
          </div>
          <div class="flex flex-wrap gap-2">
            <CommonButton
              v-if="editing.saved"
              variant="remove"
              size="medium"
              :disabled="isBusy"
              @click="remove"
            >
              {{ $t('Delete') }}
            </CommonButton>
            <CommonButton variant="secondary" size="medium" :disabled="isBusy" @click="close">
              {{ $t('Cancel') }}
            </CommonButton>
            <CommonButton
              variant="primary"
              size="medium"
              class="bg-app! text-on-app! hover:bg-app-hover!"
              :disabled="isBusy || !isDirty"
              @click="save"
            >
              {{ $t('Save') }}
            </CommonButton>
          </div>
        </header>

        <form
          class="flex flex-col gap-5 rounded-xl border border-[var(--sh-line)] bg-white p-5"
          @submit.prevent="save"
        >
          <label for="department-name" :class="labelClass">
            {{ $t('Name') }}
            <input
              id="department-name"
              v-model="editing.draft.name"
              type="text"
              maxlength="150"
              required
              :class="inputClass"
            />
          </label>

          <fieldset class="flex flex-col gap-2">
            <legend class="mb-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Locations') }}
            </legend>
            <p v-if="!locationChoices.length" class="text-sm text-[var(--sh-muted)]">
              {{ $t('The Campus field has no campuses. Add them under Objects.') }}
            </p>
            <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label
                v-for="choice in locationChoices"
                :key="choice.value"
                :for="`department-location-${choice.value}`"
                class="flex items-center gap-2 rounded-lg border border-[var(--sh-line)] px-3 py-2 text-sm text-[var(--sh-ink)]"
              >
                <input
                  :id="`department-location-${choice.value}`"
                  type="checkbox"
                  :checked="editing.draft.locations.includes(choice.value)"
                  @change="
                    toggleLocation(choice.value, ($event.target as HTMLInputElement).checked)
                  "
                />
                <span class="flex min-w-0 flex-col">
                  {{ choice.label }}
                  <span v-if="choice.missing" class="text-xs font-semibold text-red-700">
                    {{ $t('No longer a campus') }}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <label for="department-email" :class="labelClass">
            {{ $t('Email address') }}
            <input
              id="department-email"
              v-model="editing.draft.email"
              type="email"
              maxlength="255"
              required
              :class="inputClass"
            />
          </label>
        </form>
      </template>
    </div>
  </LayoutContent>
</template>
