<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ObjectAttribute {
  id: number
  object_lookup_id: number
  object?: string
  name: string
  display: string
  data_type: string
  data_option?: {
    null?: boolean
    default?: unknown
    options?: Record<string, string> | Array<{ name: string; value: string }>
    maxlength?: number
  }
  editable: boolean
  active: boolean
  to_create?: boolean
  to_delete?: boolean
  to_migrate?: boolean
  to_config?: boolean
  position: number
}

interface AttributeModalState {
  isOpen: boolean
  isEditing: boolean
  id?: number
  object: string
  display: string
  name: string
  dataType: string
  isRequired: boolean
  defaultValue: string
  optionsList: Array<{ key: string; value: string }>
  isActive: boolean
  isSaving: boolean
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Objects') },
]

const availableObjects = ref<string[]>(['Ticket', 'User', 'Organization', 'Group'])
const currentObject = ref<string>('Ticket')
const allAttributes = ref<ObjectAttribute[]>([])
const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isMigrating = ref(false)
const isDiscarding = ref(false)

const attributeModal = ref<AttributeModalState>({
  isOpen: false,
  isEditing: false,
  object: 'Ticket',
  display: '',
  name: '',
  dataType: 'input',
  isRequired: false,
  defaultValue: '',
  optionsList: [{ key: '', value: '' }],
  isActive: true,
  isSaving: false,
})

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => {
    successMessage.value = ''
  }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  setTimeout(() => {
    errorMessage.value = ''
  }, 6000)
}

const fetchData = async () => {
  isLoading.value = true
  try {
    const [listRes, attrsRes] = await Promise.all([
      fetch('/api/v1/object_manager_attributes_list', { headers: { Accept: 'application/json' } }),
      fetch('/api/v1/object_manager_attributes', { headers: { Accept: 'application/json' } }),
    ])

    if (listRes.ok) {
      const listData = await listRes.json()
      if (Array.isArray(listData.objects) && listData.objects.length > 0) {
        availableObjects.value = listData.objects
        if (!availableObjects.value.includes(currentObject.value)) {
          currentObject.value = availableObjects.value[0]
        }
      }
    }

    if (attrsRes.ok) {
      const attrsData: ObjectAttribute[] = await attrsRes.json()
      allAttributes.value = attrsData
    }
  } catch {
    showError(__('Failed to load object attributes.'))
  } finally {
    isLoading.value = false
  }
}

const pendingChanges = computed(() => {
  return allAttributes.value.filter(
    (attr) => attr.to_create || attr.to_delete || attr.to_migrate || attr.to_config,
  )
})

const currentAttributes = computed(() => {
  return allAttributes.value
    .filter((attr) => (attr.object || 'Ticket') === currentObject.value)
    .sort((a, b) => a.position - b.position)
})

const executeMigrations = async () => {
  if (
    !confirm(
      __('Are you sure you want to update the database schema for all pending attribute changes?'),
    )
  )
    return

  isMigrating.value = true
  try {
    const res = await fetch('/api/v1/object_manager_attributes_execute_migrations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
    })

    if (res.ok) {
      showSuccess(__('Database migrations executed successfully.'))
      await fetchData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to execute database migrations.'))
    }
  } catch {
    showError(__('An error occurred during database migration.'))
  } finally {
    isMigrating.value = false
  }
}

const discardChanges = async () => {
  if (!confirm(__('Are you sure you want to discard all uncommitted changes?'))) return

  isDiscarding.value = true
  try {
    const res = await fetch('/api/v1/object_manager_attributes_discard_changes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
    })

    if (res.ok) {
      showSuccess(__('Pending changes discarded successfully.'))
      await fetchData()
    } else {
      showError(__('Failed to discard changes.'))
    }
  } catch {
    showError(__('An error occurred while discarding changes.'))
  } finally {
    isDiscarding.value = false
  }
}

const openNewAttributeModal = () => {
  attributeModal.value = {
    isOpen: true,
    isEditing: false,
    object: currentObject.value,
    display: '',
    name: '',
    dataType: 'input',
    isRequired: false,
    defaultValue: '',
    optionsList: [
      { key: 'opt_1', value: __('Option 1') },
      { key: 'opt_2', value: __('Option 2') },
    ],
    isActive: true,
    isSaving: false,
  }
}

const openEditAttributeModal = (attr: ObjectAttribute) => {
  const optionsList: Array<{ key: string; value: string }> = []
  if (attr.data_option?.options) {
    if (Array.isArray(attr.data_option.options)) {
      for (const item of attr.data_option.options) {
        optionsList.push({ key: item.value || item.name, value: item.name })
      }
    } else {
      for (const [k, v] of Object.entries(attr.data_option.options)) {
        optionsList.push({ key: k, value: String(v) })
      }
    }
  }

  attributeModal.value = {
    isOpen: true,
    isEditing: true,
    id: attr.id,
    object: attr.object || currentObject.value,
    display: attr.display,
    name: attr.name,
    dataType: attr.data_type,
    isRequired: !attr.data_option?.null,
    defaultValue: String(attr.data_option?.default ?? ''),
    optionsList: optionsList.length > 0 ? optionsList : [{ key: '', value: '' }],
    isActive: attr.active,
    isSaving: false,
  }
}

const addOptionRow = () => {
  attributeModal.value.optionsList.push({ key: '', value: '' })
}

const removeOptionRow = (index: number) => {
  attributeModal.value.optionsList.splice(index, 1)
}

const saveAttribute = async () => {
  if (!attributeModal.value.display.trim()) {
    showError(__('Display label is required.'))
    return
  }
  if (!attributeModal.value.isEditing && !attributeModal.value.name.trim()) {
    showError(__('Attribute key name is required.'))
    return
  }

  attributeModal.value.isSaving = true
  try {
    const dataOption: Record<string, unknown> = {
      null: !attributeModal.value.isRequired,
    }

    if (attributeModal.value.defaultValue) {
      dataOption.default = attributeModal.value.defaultValue
    }

    if (['select', 'multiselect', 'tree_select'].includes(attributeModal.value.dataType)) {
      const opts: Record<string, string> = {}
      for (const row of attributeModal.value.optionsList) {
        if (row.key.trim()) {
          opts[row.key.trim()] = row.value.trim() || row.key.trim()
        }
      }
      dataOption.options = opts
    }

    const payload = {
      object: attributeModal.value.object,
      name: attributeModal.value.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_'),
      display: attributeModal.value.display.trim(),
      data_type: attributeModal.value.dataType,
      data_option: dataOption,
      active: attributeModal.value.isActive,
    }

    let res: Response
    if (attributeModal.value.isEditing && attributeModal.value.id) {
      res = await fetch(`/api/v1/object_manager_attributes/${attributeModal.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/v1/object_manager_attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
        body: JSON.stringify(payload),
      })
    }

    if (res.ok) {
      showSuccess(__('Attribute saved. Remember to update the database to apply changes.'))
      attributeModal.value.isOpen = false
      await fetchData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to save attribute.'))
    }
  } catch {
    showError(__('An unexpected error occurred while saving attribute.'))
  } finally {
    attributeModal.value.isSaving = false
  }
}

const deleteAttribute = async (attr: ObjectAttribute) => {
  if (
    !confirm(
      __(
        'Are you sure you want to delete "%s"? It will be removed from the database once migrations are executed.',
        attr.display,
      ),
    )
  )
    return

  try {
    const res = await fetch(`/api/v1/object_manager_attributes/${attr.id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrf() },
    })

    if (res.ok) {
      showSuccess(__('Attribute marked for deletion. Click "Update Database" to apply changes.'))
      await fetchData()
    } else {
      showError(__('Failed to mark attribute for deletion.'))
    }
  } catch {
    showError(__('An error occurred while deleting attribute.'))
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="mb-2 flex items-center gap-3">
          <button
            type="button"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            :title="__('Back')"
            @click="router.back()"
          >
            <CommonIcon name="arrow-left" class="h-4 w-4" />
          </button>
          <div class="flex items-center gap-2.5">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-400"
            >
              <CommonIcon name="wrench" class="h-4 w-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {{ __('Object Manager') }}
            </h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{
            __(
              'Add and manage custom fields and attributes for tickets, users, organizations, and groups.',
            )
          }}
        </p>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>{{ successMessage }}</span>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Pending Changes Warning Banner -->
      <div
        v-if="pendingChanges.length > 0"
        class="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs sm:flex-row sm:items-center dark:border-amber-800/60 dark:bg-amber-950/40"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400"
          >
            <CommonIcon name="exclamation-triangle" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-amber-900 dark:text-amber-100">
              {{ __('You have %s uncommitted database changes', pendingChanges.length) }}
            </h3>
            <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              {{
                __(
                  'Attributes have been created, modified, or marked for deletion. Apply changes to alter the database schema.',
                )
              }}
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            class="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-800"
            :disabled="isDiscarding || isMigrating"
            @click="discardChanges"
          >
            {{ isDiscarding ? __('Discarding...') : __('Discard Changes') }}
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-700 disabled:opacity-60"
            :disabled="isMigrating || isDiscarding"
            @click="executeMigrations"
          >
            <CommonIcon
              v-if="isMigrating"
              name="arrow-clockwise"
              class="h-3.5 w-3.5 animate-spin"
            />
            <span>{{ isMigrating ? __('Updating Database...') : __('Update Database') }}</span>
          </button>
        </div>
      </div>

      <!-- Object Tabs & New Button -->
      <div
        class="mb-6 flex flex-col items-stretch justify-between gap-4 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-[#1e293b]"
      >
        <div class="flex items-center gap-2 overflow-x-auto">
          <button
            v-for="obj in availableObjects"
            :key="obj"
            type="button"
            class="cursor-pointer rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            :class="
              currentObject === obj
                ? 'bg-blue-600 font-semibold text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            "
            @click="currentObject = obj"
          >
            {{ obj }}
          </button>
        </div>

        <button
          type="button"
          class="flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 sm:self-auto"
          @click="openNewAttributeModal"
        >
          <CommonIcon name="plus" class="h-3.5 w-3.5" />
          <span>{{ __('New Attribute') }}</span>
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="space-y-4">
        <div class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-[#1e293b]" />
        <div class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-[#1e293b]" />
        <div class="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-[#1e293b]" />
      </div>

      <!-- Attributes Table -->
      <div
        v-else
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-[#1e293b] dark:bg-[#0f172a]/40"
      >
        <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
          <thead
            class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-[#1e293b]/70"
          >
            <tr>
              <th class="px-5 py-3.5">{{ __('Display Name') }}</th>
              <th class="px-5 py-3.5">{{ __('Identifier') }}</th>
              <th class="px-5 py-3.5">{{ __('Type') }}</th>
              <th class="px-5 py-3.5 text-center">{{ __('Status') }}</th>
              <th class="px-5 py-3.5 text-right">{{ __('Actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="attr in currentAttributes"
              :key="attr.id"
              class="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
              :class="{ 'bg-red-50/30 opacity-60 dark:bg-red-950/20': attr.to_delete }"
            >
              <td class="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                <div class="flex items-center gap-2">
                  <span>{{ attr.display }}</span>
                  <span
                    v-if="!attr.editable"
                    class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800"
                  >
                    {{ __('System') }}
                  </span>
                </div>
              </td>
              <td class="px-5 py-3.5 font-mono text-[11px] text-slate-500">{{ attr.name }}</td>
              <td class="px-5 py-3.5 capitalize">{{ attr.data_type.replace('_', ' ') }}</td>
              <td class="px-5 py-3.5 text-center">
                <span
                  v-if="attr.to_create"
                  class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                >
                  {{ __('Pending Create') }}
                </span>
                <span
                  v-else-if="attr.to_delete"
                  class="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-400"
                >
                  {{ __('Pending Delete') }}
                </span>
                <span
                  v-else-if="attr.to_migrate"
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                >
                  {{ __('Pending Update') }}
                </span>
                <span
                  v-else
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  :class="
                    attr.active
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                  "
                >
                  {{ attr.active ? __('Active') : __('Disabled') }}
                </span>
              </td>
              <td class="px-5 py-3.5 text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="cursor-pointer font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    @click="openEditAttributeModal(attr)"
                  >
                    {{ __('Edit') }}
                  </button>
                  <button
                    v-if="attr.editable && !attr.to_delete"
                    type="button"
                    class="cursor-pointer font-medium text-red-500 hover:text-red-700"
                    @click="deleteAttribute(attr)"
                  >
                    {{ __('Delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: New/Edit Attribute -->
    <div
      v-if="attributeModal.isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1e293b] dark:bg-[#0f172a]"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
            {{
              attributeModal.isEditing
                ? __('Edit Attribute: %s', attributeModal.display)
                : __('New Attribute for %s', attributeModal.object)
            }}
          </h3>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="attributeModal.isOpen = false"
          >
            <CommonIcon name="x-lg" class="h-4 w-4" />
          </button>
        </div>

        <div class="space-y-3.5 text-xs">
          <!-- Display Label -->
          <div class="space-y-1.5">
            <label
              for="attr-display"
              class="block font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('Display Label') }}
            </label>
            <input
              id="attr-display"
              v-model="attributeModal.display"
              type="text"
              placeholder="e.g. Order Number, VIP Status"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <!-- Key Name (Only editable on create) -->
          <div class="space-y-1.5">
            <label for="attr-name" class="block font-semibold text-slate-700 dark:text-slate-300">
              {{ __('Key / Database Column Name') }}
            </label>
            <input
              id="attr-name"
              v-model="attributeModal.name"
              type="text"
              placeholder="e.g. order_number"
              :disabled="attributeModal.isEditing"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden disabled:opacity-60 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <!-- Data Type -->
          <div class="space-y-1.5">
            <label
              for="attr-data-type"
              class="block font-semibold text-slate-700 dark:text-slate-300"
            >
              {{ __('Data Type') }}
            </label>
            <select
              id="attr-data-type"
              v-model="attributeModal.dataType"
              :disabled="attributeModal.isEditing"
              class="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden disabled:opacity-60 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option value="input">{{ __('Text (Single Line)') }}</option>
              <option value="textarea">{{ __('Text Area (Multiline)') }}</option>
              <option value="integer">{{ __('Integer Number') }}</option>
              <option value="boolean">{{ __('Boolean (Yes / No)') }}</option>
              <option value="select">{{ __('Select Dropdown') }}</option>
              <option value="multiselect">{{ __('Multi-Select') }}</option>
              <option value="date">{{ __('Date') }}</option>
              <option value="datetime">{{ __('Date & Time') }}</option>
            </select>
          </div>

          <!-- Options for select/multiselect -->
          <div
            v-if="['select', 'multiselect'].includes(attributeModal.dataType)"
            class="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-slate-700 dark:text-slate-300">{{
                __('Options')
              }}</span>
              <button
                type="button"
                class="cursor-pointer text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                @click="addOptionRow"
              >
                + {{ __('Add Option') }}
              </button>
            </div>
            <div
              v-for="(row, idx) in attributeModal.optionsList"
              :key="idx"
              class="flex items-center gap-2"
            >
              <input
                v-model="row.key"
                type="text"
                :placeholder="__('Key')"
                :aria-label="__('Option key')"
                class="w-1/2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-[#2d3f5c] dark:bg-[#1e293b]"
              />
              <input
                v-model="row.value"
                type="text"
                :placeholder="__('Display Value')"
                :aria-label="__('Option display value')"
                class="w-1/2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-[#2d3f5c] dark:bg-[#1e293b]"
              />
              <button
                type="button"
                class="cursor-pointer p-1 text-red-400 hover:text-red-600"
                @click="removeOptionRow(idx)"
              >
                <CommonIcon name="x-lg" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <!-- Required Toggle -->
          <div
            class="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800"
          >
            <div>
              <p class="font-semibold text-slate-700 dark:text-slate-300">
                {{ __('Required Field') }}
              </p>
              <p class="text-[11px] text-slate-400">
                {{ __('Users must provide a value before saving.') }}
              </p>
            </div>
            <input
              id="attr-required"
              v-model="attributeModal.isRequired"
              type="checkbox"
              :aria-label="__('Required Field')"
              class="h-4 w-4 cursor-pointer accent-blue-600"
            />
          </div>

          <!-- Active Toggle -->
          <div
            class="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800"
          >
            <div>
              <p class="font-semibold text-slate-700 dark:text-slate-300">{{ __('Active') }}</p>
              <p class="text-[11px] text-slate-400">
                {{ __('Render this field in ticket views and agent forms.') }}
              </p>
            </div>
            <input
              id="attr-active"
              v-model="attributeModal.isActive"
              type="checkbox"
              :aria-label="__('Active')"
              class="h-4 w-4 cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <!-- Modal Footer -->
        <div
          class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <button
            type="button"
            class="cursor-pointer rounded-xl px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="attributeModal.isOpen = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-60"
            :disabled="attributeModal.isSaving"
            @click="saveAttribute"
          >
            <CommonIcon
              v-if="attributeModal.isSaving"
              name="arrow-clockwise"
              class="h-3.5 w-3.5 animate-spin"
            />
            <span>{{ attributeModal.isSaving ? __('Saving...') : __('Save Attribute') }}</span>
          </button>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
