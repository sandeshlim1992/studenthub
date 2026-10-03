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

interface ScreensConfig {
  [role: string]: {
    [screen: string]: {
      shown: boolean
      required?: boolean
    }
  }
}

interface AttributeModalState {
  isOpen: boolean
  isEditing: boolean
  id?: number
  object: string
  name: string
  display: string
  active: boolean
  dataType: string
  position: number
  // data_option fields
  defaultVal: unknown
  inputType: string
  maxlength: number
  linktemplate: string
  rows: number
  min: number
  max: number
  future: boolean
  past: boolean
  diff: number | null
  translate: boolean
  optionsList: Array<{ key: string; value: string }>
  screens: ScreensConfig
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
const csrfToken = ref('')

const getDefaultScreensForObject = (obj: string): ScreensConfig => {
  if (obj === 'Ticket') {
    return {
      'ticket.customer': {
        create_middle: { shown: true, required: false },
        edit: { shown: true, required: false },
      },
      'ticket.agent': {
        create_middle: { shown: true, required: false },
        edit: { shown: true, required: false },
      },
    }
  }
  if (obj === 'User') {
    return {
      'ticket.customer': {
        create: { shown: true, required: false },
        view: { shown: true },
        signup: { shown: false, required: false },
      },
      'ticket.agent': {
        create: { shown: true, required: false },
        edit: { shown: true, required: false },
        view: { shown: true },
        invite_customer: { shown: false, required: false },
      },
      'admin.user': {
        create: { shown: true, required: false },
        edit: { shown: true, required: false },
        view: { shown: true },
      },
    }
  }
  if (obj === 'Organization') {
    return {
      'ticket.customer': {
        view: { shown: true },
      },
      'ticket.agent': {
        create: { shown: true, required: false },
        edit: { shown: true, required: false },
        view: { shown: true },
      },
      'admin.organization': {
        create: { shown: true, required: false },
        edit: { shown: true, required: false },
        view: { shown: true },
      },
    }
  }
  if (obj === 'Group') {
    return {
      'admin.group': {
        create: { shown: true, required: false },
        edit: { shown: true, required: false },
        view: { shown: true },
      },
    }
  }
  return {
    'ticket.agent': {
      create_middle: { shown: true, required: false },
      edit: { shown: true, required: false },
    },
  }
}

const attributeModal = ref<AttributeModalState>({
  isOpen: false,
  isEditing: false,
  object: 'Ticket',
  name: '',
  display: '',
  active: true,
  dataType: 'input',
  position: 910,
  defaultVal: '',
  inputType: 'text',
  maxlength: 255,
  linktemplate: '',
  rows: 4,
  min: 0,
  max: 2147483647,
  future: true,
  past: true,
  diff: null,
  translate: false,
  optionsList: [{ key: '', value: '' }],
  screens: getDefaultScreensForObject('Ticket'),
  isSaving: false,
})

const getCsrf = () => {
  if (csrfToken.value) return csrfToken.value
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

    const token = listRes.headers.get('csrf-token') || attrsRes.headers.get('csrf-token')
    if (token) {
      csrfToken.value = token
    }

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

const searchQuery = ref('')
const filteredAttributes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return currentAttributes.value
  return currentAttributes.value.filter(
    (attr) =>
      attr.name.toLowerCase().includes(query) ||
      attr.display.toLowerCase().includes(query) ||
      attr.data_type.toLowerCase().includes(query),
  )
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

const formatOptions = [
  { value: 'input', label: __('Text field') },
  { value: 'textarea', label: __('Textarea field') },
  { value: 'boolean', label: __('Boolean field') },
  { value: 'integer', label: __('Integer field') },
  { value: 'date', label: __('Date field') },
  { value: 'datetime', label: __('Date & time field') },
  { value: 'select', label: __('Single selection field') },
  { value: 'multiselect', label: __('Multiple selection field') },
  { value: 'tree_select', label: __('Single tree selection field') },
  { value: 'multi_tree_select', label: __('Multiple tree selection field') },
]

const openNewAttributeModal = () => {
  attributeModal.value = {
    isOpen: true,
    isEditing: false,
    object: currentObject.value,
    name: '',
    display: '',
    active: true,
    dataType: 'input',
    position: (currentAttributes.value.length + 1) * 10,
    defaultVal: '',
    inputType: 'text',
    maxlength: 255,
    linktemplate: '',
    rows: 4,
    min: 0,
    max: 2147483647,
    future: true,
    past: true,
    diff: null,
    translate: false,
    optionsList: [
      { key: 'opt_1', value: __('Option 1') },
      { key: 'opt_2', value: __('Option 2') },
    ],
    screens: getDefaultScreensForObject(currentObject.value),
    isSaving: false,
  }
}

const openEditAttributeModal = (attr: ObjectAttribute) => {
  try {
    const targetObject = attr.object || currentObject.value
    const optionsList: Array<{ key: string; value: string }> = []
    const attrRecord = attr as unknown as Record<string, unknown>
    const rawDataOpt = (attrRecord.data_option_new as Record<string, unknown> | undefined)?.options
      ? (attrRecord.data_option_new as Record<string, unknown>)
      : (attr.data_option as Record<string, unknown> | undefined)
    const dataOpt = rawDataOpt && typeof rawDataOpt === 'object' ? rawDataOpt : {}

    if (dataOpt.options) {
      if (Array.isArray(dataOpt.options)) {
        const flattenTree = (arr: unknown[]) => {
          for (const item of arr) {
            if (!item) continue
            if (typeof item === 'string' || typeof item === 'number') {
              optionsList.push({ key: String(item), value: String(item) })
            } else if (typeof item === 'object') {
              const itemRec = item as Record<string, unknown>
              const key = itemRec.value != null ? String(itemRec.value) : (itemRec.name != null ? String(itemRec.name) : '')
              const val = itemRec.name != null ? String(itemRec.name) : key
              optionsList.push({ key, value: val })
              if (Array.isArray(itemRec.children) && itemRec.children.length > 0) {
                flattenTree(itemRec.children)
              }
            }
          }
        }
        flattenTree(dataOpt.options)
      } else if (typeof dataOpt.options === 'object' && dataOpt.options !== null) {
        for (const [k, v] of Object.entries(dataOpt.options as Record<string, unknown>)) {
          optionsList.push({ key: String(k), value: String(v) })
        }
      }
    }

    const defaultScreens = getDefaultScreensForObject(targetObject)
    const rawScreens = ((attrRecord.screens_new || attrRecord.screens || {}) as Record<string, Record<string, { shown?: boolean; required?: boolean }>>)
    for (const [role, screensMap] of Object.entries(defaultScreens)) {
      for (const [screen, opts] of Object.entries(screensMap)) {
        const saved = rawScreens[screen]?.[role]
        if (saved) {
          if (saved.shown !== undefined) opts.shown = saved.shown
          if (saved.required !== undefined && opts.required !== undefined) opts.required = saved.required
        }
      }
    }

    attributeModal.value = {
      isOpen: true,
      isEditing: true,
      id: attr.id,
      object: targetObject,
      name: attr.name || '',
      display: attr.display || '',
      active: attr.active !== false,
      dataType: attr.data_type || 'input',
      position: attr.position || 910,
      defaultVal: dataOpt.default !== undefined ? dataOpt.default : '',
      inputType: dataOpt.type || 'text',
      maxlength: dataOpt.maxlength || (attr.data_type === 'textarea' ? 2500 : 255),
      linktemplate: dataOpt.linktemplate || '',
      rows: dataOpt.rows || 4,
      min: dataOpt.min !== undefined ? dataOpt.min : 0,
      max: dataOpt.max !== undefined ? dataOpt.max : 2147483647,
      future: dataOpt.future !== false,
      past: dataOpt.past !== false,
      diff: dataOpt.diff !== undefined ? dataOpt.diff : null,
      translate: dataOpt.translate === true,
      optionsList: optionsList.length > 0 ? optionsList : [{ key: '', value: '' }],
      screens: defaultScreens,
      isSaving: false,
    }
  } catch (err) {
    console.error('Failed to open edit attribute modal:', err)
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
    const screensPayload: Record<string, Record<string, unknown>> = {}
    let isAnyRequired = false
    for (const [role, screensMap] of Object.entries(attributeModal.value.screens)) {
      for (const [screen, opts] of Object.entries(screensMap)) {
        if (!screensPayload[screen]) screensPayload[screen] = {}
        screensPayload[screen][role] = { ...opts }
        if (opts.required) isAnyRequired = true
      }
    }

    const dataOption: Record<string, unknown> = {
      null: !isAnyRequired,
    }

    if (attributeModal.value.defaultVal !== undefined && attributeModal.value.defaultVal !== '') {
      dataOption.default = attributeModal.value.defaultVal
    }

    const type = attributeModal.value.dataType
    if (type === 'input') {
      dataOption.type = attributeModal.value.inputType || 'text'
      dataOption.maxlength = Number(attributeModal.value.maxlength) || 255
      if (attributeModal.value.linktemplate) {
        dataOption.linktemplate = attributeModal.value.linktemplate
      }
    } else if (type === 'textarea') {
      dataOption.maxlength = Number(attributeModal.value.maxlength) || 2500
      dataOption.rows = Number(attributeModal.value.rows) || 4
    } else if (type === 'integer') {
      dataOption.min = Number(attributeModal.value.min) || 0
      dataOption.max = Number(attributeModal.value.max) || 2147483647
      dataOption.default = Number(attributeModal.value.defaultVal) || 0
    } else if (type === 'boolean') {
      dataOption.options = { true: 'Yes', false: 'No' }
      dataOption.default = attributeModal.value.defaultVal === 'true' || attributeModal.value.defaultVal === true
    } else if (['date', 'datetime'].includes(type)) {
      dataOption.future = attributeModal.value.future
      dataOption.past = attributeModal.value.past
      if (attributeModal.value.diff !== null && attributeModal.value.diff !== undefined) {
        dataOption.diff = Number(attributeModal.value.diff)
      }
    } else if (['tree_select', 'multi_tree_select'].includes(type)) {
      const treeOpts = attributeModal.value.optionsList
        .filter((r) => r.key.trim() || r.value.trim())
        .map((r) => ({
          value: r.key.trim() || r.value.trim(),
          name: r.value.trim() || r.key.trim(),
        }))
      dataOption.options = treeOpts
      dataOption.relation = ''
      dataOption.translate = attributeModal.value.translate
    } else if (['select', 'multiselect'].includes(type)) {
      const opts: Record<string, string> = {}
      for (const row of attributeModal.value.optionsList) {
        if (row.key.trim()) {
          opts[row.key.trim()] = row.value.trim() || row.key.trim()
        }
      }
      dataOption.options = opts
      dataOption.relation = ''
      dataOption.translate = attributeModal.value.translate
    }

    const payload = {
      object: attributeModal.value.object,
      name: attributeModal.value.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_'),
      display: attributeModal.value.display.trim(),
      data_type: type,
      data_option: dataOption,
      screens: screensPayload,
      active: attributeModal.value.active,
      position: Number(attributeModal.value.position) || 910,
    }

    let res: Response
    if (attributeModal.value.isEditing && attributeModal.value.id) {
      res = await fetch(`/api/v1/object_manager_attributes/${attributeModal.value.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/v1/object_manager_attributes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify(payload),
      })
    }

    if (res.ok) {
      showSuccess(__('Attribute saved. Remember to click "Update Database" to apply schema changes.'))
      attributeModal.value.isOpen = false
      await fetchData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to save attribute.'))
    }
  } catch (err: unknown) {
    const errorObj = err as { message?: string }
    showError(errorObj?.message || __('An unexpected error occurred while saving attribute.'))
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
      headers: {
        'X-CSRF-Token': getCsrf(),
      },
    })

    if (res.ok) {
      showSuccess(__('Attribute marked for deletion. Click "Update Database" to apply changes.'))
      await fetchData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to mark attribute for deletion.'))
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
        class="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-xs sm:flex-row sm:items-start dark:border-amber-800/60 dark:bg-amber-950/40"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400 mt-0.5"
          >
            <CommonIcon name="exclamation-triangle" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-amber-900 dark:text-amber-100">
              {{ __('You have %s uncommitted database changes').replace('%s', String(pendingChanges.length)) }}
            </h3>
            <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              {{
                __(
                  'Attributes have been created, modified, or marked for deletion. Apply changes to alter the database schema.',
                )
              }}
            </p>
            <ul class="mt-3 space-y-1.5 text-xs font-mono">
              <li
                v-for="item in pendingChanges"
                :key="item.id"
                class="flex items-center gap-2 text-slate-700 dark:text-slate-300"
              >
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wider"
                  :class="{
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300': item.to_create,
                    'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300': item.to_delete,
                    'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300': item.to_migrate || item.to_config,
                  }"
                >
                  {{ item.to_create ? __('Create') : (item.to_delete ? __('Delete') : __('Changed')) }}
                </span>
                <span>{{ item.object || currentObject }}.{{ item.name }} ({{ item.data_type }})</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2.5 self-end sm:self-center">
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

      <!-- Object Tabs & Search & New Button -->
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

        <div class="flex items-center gap-3">
          <div class="relative w-48 sm:w-60">
            <CommonIcon
              name="search"
              class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="__('Search attributes...')"
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 transition-colors"
            />
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
              <th class="px-5 py-3.5 text-center">{{ __('Position') }}</th>
              <th class="px-5 py-3.5 text-center">{{ __('Status') }}</th>
              <th class="px-5 py-3.5 text-right">{{ __('Actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="attr in filteredAttributes"
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
              <td class="px-5 py-3.5 text-center font-mono text-[11px] text-slate-400">
                {{ attr.position }}
              </td>
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
                  <router-link
                    v-if="attr.object === 'Ticket' && attr.name === 'priority_id'"
                    to="/manage/ticket/priorities"
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    :title="__('Manage Priorities')"
                  >
                    <CommonIcon name="gear" class="h-3.5 w-3.5" />
                  </router-link>
                  <router-link
                    v-else-if="attr.object === 'Ticket' && attr.name === 'state_id'"
                    to="/manage/ticket/states"
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    :title="__('Manage States')"
                  >
                    <CommonIcon name="gear" class="h-3.5 w-3.5" />
                  </router-link>
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
            <tr v-if="filteredAttributes.length === 0">
              <td colspan="6" class="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                <CommonIcon name="search" class="mx-auto mb-2 h-6 w-6 opacity-40" />
                <p>{{ __('No attributes found matching your criteria.') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>

  <!-- Modal: New/Edit Attribute Teleported to Body -->
  <Teleport to="body">
    <div
      v-if="attributeModal.isOpen"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      @click="attributeModal.isOpen = false"
    >
      <div
        class="max-h-[92vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-[#1e293b] dark:bg-[#0f172a]"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
            {{
              attributeModal.isEditing
                ? `${__('Edit Attribute')}: ${attributeModal.display || attributeModal.name}`
                : `${__('New Attribute for')} ${attributeModal.object}`
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

        <div class="space-y-4 text-xs">
          <!-- Name / Key -->
          <div class="space-y-1.5">
            <label
              for="attr-name"
              class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ __('Name') }}
            </label>
            <input
              id="attr-name"
              v-model="attributeModal.name"
              type="text"
              placeholder="e.g. order_number"
              :disabled="attributeModal.isEditing"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden disabled:opacity-60 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <!-- Display * -->
          <div class="space-y-1.5">
            <label
              for="attr-display"
              class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ __('Display *') }}
            </label>
            <input
              id="attr-display"
              v-model="attributeModal.display"
              type="text"
              placeholder="e.g. Order Number"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>

          <!-- Active * -->
          <div class="space-y-1.5">
            <label
              for="attr-active"
              class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ __('Active *') }}
            </label>
            <select
              id="attr-active"
              v-model="attributeModal.active"
              class="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option :value="true">{{ __('active') }}</option>
              <option :value="false">{{ __('inactive') }}</option>
            </select>
          </div>

          <!-- Format * -->
          <div class="space-y-1.5">
            <label
              for="attr-data-type"
              class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ __('Format *') }}
            </label>
            <select
              id="attr-data-type"
              v-model="attributeModal.dataType"
              :disabled="attributeModal.isEditing"
              class="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden disabled:opacity-60 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            >
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Format-specific options -->
          <!-- Text field (input) -->
          <template v-if="attributeModal.dataType === 'input'">
            <div class="space-y-1.5">
              <label for="attr-default-input" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Default') }}
              </label>
              <input
                id="attr-default-input"
                v-model="attributeModal.defaultVal"
                type="text"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div class="space-y-1.5">
              <label for="attr-input-type" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Type *') }}
              </label>
              <select
                id="attr-input-type"
                v-model="attributeModal.inputType"
                class="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option value="text">{{ __('Text') }}</option>
                <option value="tel">{{ __('Phone') }}</option>
                <option value="email">{{ __('Email') }}</option>
                <option value="url">{{ __('Url') }}</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label for="attr-input-maxlength" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Max. length *') }}
              </label>
              <input
                id="attr-input-maxlength"
                v-model.number="attributeModal.maxlength"
                type="number"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div v-if="attributeModal.inputType !== 'url'" class="space-y-1.5">
              <label for="attr-link-template" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Link template') }}
              </label>
              <input
                id="attr-link-template"
                v-model="attributeModal.linktemplate"
                type="text"
                placeholder="https://example.com/?q=#{object.attribute_name} - use ticket, user or organization as object"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
          </template>

          <!-- Textarea field -->
          <template v-else-if="attributeModal.dataType === 'textarea'">
            <div class="space-y-1.5">
              <label for="attr-default-textarea" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Default') }}
              </label>
              <textarea
                id="attr-default-textarea"
                v-model="attributeModal.defaultVal"
                rows="3"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="attr-textarea-maxlength" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {{ __('Max. length *') }}
                </label>
                <input
                  id="attr-textarea-maxlength"
                  v-model.number="attributeModal.maxlength"
                  type="number"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
                />
              </div>
              <div class="space-y-1.5">
                <label for="attr-textarea-rows" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {{ __('Rows *') }}
                </label>
                <input
                  id="attr-textarea-rows"
                  v-model.number="attributeModal.rows"
                  type="number"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
                />
              </div>
            </div>
          </template>

          <!-- Boolean field -->
          <template v-else-if="attributeModal.dataType === 'boolean'">
            <div class="space-y-1.5">
              <label for="attr-default-boolean" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Default') }}
              </label>
              <select
                id="attr-default-boolean"
                v-model="attributeModal.defaultVal"
                class="w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              >
                <option :value="false">{{ __('No') }}</option>
                <option :value="true">{{ __('Yes') }}</option>
              </select>
            </div>
          </template>

          <!-- Integer field -->
          <template v-else-if="attributeModal.dataType === 'integer'">
            <div class="space-y-1.5">
              <label for="attr-default-integer" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Default') }}
              </label>
              <input
                id="attr-default-integer"
                v-model.number="attributeModal.defaultVal"
                type="number"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="attr-min-integer" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {{ __('Minimal') }}
                </label>
                <input
                  id="attr-min-integer"
                  v-model.number="attributeModal.min"
                  type="number"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
                />
              </div>
              <div class="space-y-1.5">
                <label for="attr-max-integer" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {{ __('Maximal') }}
                </label>
                <input
                  id="attr-max-integer"
                  v-model.number="attributeModal.max"
                  type="number"
                  class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
                />
              </div>
            </div>
          </template>

          <!-- Date / Datetime fields -->
          <template v-else-if="['date', 'datetime'].includes(attributeModal.dataType)">
            <div class="flex items-center gap-6">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  v-model="attributeModal.future"
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer accent-blue-600"
                />
                <span class="text-xs text-slate-700 dark:text-slate-300">{{ __('Allow future') }}</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  v-model="attributeModal.past"
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer accent-blue-600"
                />
                <span class="text-xs text-slate-700 dark:text-slate-300">{{ __('Allow past') }}</span>
              </label>
            </div>
          </template>

          <!-- Select / Multiselect / Tree Select fields -->
          <template v-else-if="['select', 'multiselect', 'tree_select', 'multi_tree_select'].includes(attributeModal.dataType)">
            <div class="space-y-1.5">
              <label for="attr-default-select" class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Default') }}
              </label>
              <input
                id="attr-default-select"
                v-model="attributeModal.defaultVal"
                type="text"
                placeholder="e.g. opt_1"
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
              />
            </div>

            <!-- Options list -->
            <div class="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {{ __('Options') }}
                  </span>
                  <p class="text-[11px] text-slate-400">
                    {{ __('Configure selection items (Key / Stored Value and Display Label).') }}
                  </p>
                </div>
                <button
                  type="button"
                  class="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400"
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
                  :placeholder="__('Key / Stored Value')"
                  class="w-1/2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
                />
                <input
                  v-model="row.value"
                  type="text"
                  :placeholder="__('Display Label')"
                  class="w-1/2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
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

            <div class="pt-2">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  v-model="attributeModal.translate"
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer accent-blue-600"
                />
                <span class="text-xs text-slate-700 dark:text-slate-300">{{ __('Translate field contents') }}</span>
              </label>
            </div>
          </template>

          <!-- Permissions & Screens Table -->
          <div class="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p class="text-xs text-slate-600 dark:text-slate-400">
              {{ __('Here you define which authorization has access to the attribute.') }}
            </p>
            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table class="w-full text-left text-xs">
                <thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  <tr>
                    <th class="px-4 py-2.5">{{ __('Permissions') }}</th>
                    <th class="px-4 py-2.5">{{ __('Screen') }}</th>
                    <th class="w-1/2 px-4 py-2.5">{{ __('Options') }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <template v-for="(screensMap, role) in attributeModal.screens" :key="role">
                    <tr class="bg-slate-50/70 font-semibold text-slate-800 dark:bg-slate-800/40 dark:text-slate-200">
                      <td class="px-4 py-2 font-mono text-xs" colspan="3">{{ role }}</td>
                    </tr>
                    <tr
                      v-for="(opts, screen) in screensMap"
                      :key="`${role}-${screen}`"
                      class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td class="px-4 py-2"></td>
                      <td class="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{{ screen }}</td>
                      <td class="px-4 py-2">
                        <div class="flex items-center gap-4">
                          <label class="flex cursor-pointer items-center gap-1.5">
                            <span class="text-xs text-slate-600 dark:text-slate-400">{{ __('shown:') }}</span>
                            <input
                              v-model="opts.shown"
                              type="checkbox"
                              class="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                            />
                          </label>
                          <label v-if="opts.required !== undefined" class="flex cursor-pointer items-center gap-1.5">
                            <span class="text-xs text-slate-600 dark:text-slate-400">{{ __('required:') }}</span>
                            <input
                              v-model="opts.required"
                              type="checkbox"
                              class="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td colspan="2" class="px-4 py-1.5 text-[11px] text-slate-400 italic dark:text-slate-500">
                        {{ __('Not applicable to: merging, emails, form, Facebook, Telegram, SMS') }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Position -->
          <div class="space-y-1.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <label
              for="attr-position"
              class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ __('Position') }}
            </label>
            <input
              id="attr-position"
              v-model.number="attributeModal.position"
              type="number"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
            />
          </div>
        </div>

        <!-- Modal Footer matching Screenshot 2 -->
        <div
          class="flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-800"
        >
          <button
            type="button"
            class="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="attributeModal.isOpen = false"
          >
            {{ __('Cancel & Go Back') }}
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-[#2ecc71] px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#27ae60] disabled:opacity-60"
            :disabled="attributeModal.isSaving"
            @click="saveAttribute"
          >
            <CommonIcon
              v-if="attributeModal.isSaving"
              name="arrow-clockwise"
              class="h-3.5 w-3.5 animate-spin"
            />
            <span>{{ attributeModal.isSaving ? __('Saving...') : __('Submit') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
