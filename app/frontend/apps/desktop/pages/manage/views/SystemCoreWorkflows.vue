<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface WorkflowConditionItem {
  id: string
  attribute: string
  operator: string
  value: string
}

interface WorkflowActionItem {
  id: string
  attribute: string
  operator: string
  value: string
}

interface CoreWorkflowRecord {
  id: number
  name: string
  object: string
  preferences?: {
    screen?: string[]
  }
  condition_saved?: Record<string, { operator: string; value: string | string[] }>
  condition_selected?: Record<string, { operator: string; value: string | string[] }>
  perform?: Record<string, { operator: string; value?: string | string[]; show?: string }>
  active: boolean
  stop_after_match: boolean
  changeable: boolean
  priority: number
  created_at?: string
  updated_at?: string
}

interface WorkflowModalState {
  isOpen: boolean
  isEditing: boolean
  id?: number
  name: string
  object: string
  priority: number
  active: boolean
  stopAfterMatch: boolean
  screens: string[]
  conditionScope: 'selected' | 'saved'
  conditions: WorkflowConditionItem[]
  conditionsSaved: WorkflowConditionItem[]
  actions: WorkflowActionItem[]
  isSaving: boolean
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Core Workflows') },
]

const workflows = ref<CoreWorkflowRecord[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedObjectFilter = ref('all')
const selectedStatusFilter = ref('all')
const successMessage = ref('')
const errorMessage = ref('')
const isToggling = ref<Record<number, boolean>>({})

// Delete confirmation modal state
const deleteModal = ref<{
  isOpen: boolean
  workflow: CoreWorkflowRecord | null
  isDeleting: boolean
}>({
  isOpen: false,
  workflow: null,
  isDeleting: false,
})

// Edit / Create modal state
const modalState = ref<WorkflowModalState>({
  isOpen: false,
  isEditing: false,
  name: '',
  object: 'Ticket',
  priority: 100,
  active: true,
  stopAfterMatch: false,
  screens: ['create', 'edit'],
  conditionScope: 'selected',
  conditions: [],
  conditionsSaved: [],
  actions: [],
  isSaving: false,
})

const activeModalTab = ref<'general' | 'conditions' | 'actions'>('general')

const availableObjects = ['Ticket', 'User', 'Organization', 'Group']

const availableScreens = computed(() => [
  { id: 'create', label: __('Creation mask') },
  { id: 'edit', label: __('Edit mask') },
  { id: 'overview_bulk', label: __('Overview bulk mask') },
])

const availableConditionOperators = computed(() => [
  { value: 'is', label: __('is') },
  { value: 'is_not', label: __('is not') },
  { value: 'contains', label: __('contains') },
  { value: 'contains_not', label: __('does not contain') },
])

const availableActionOperators = computed(() => [
  { value: 'show', label: __('Show') },
  { value: 'hide', label: __('Hide') },
  { value: 'set_mandatory', label: __('Set mandatory') },
  { value: 'set_optional', label: __('Set optional') },
  { value: 'set_readonly', label: __('Set read-only') },
  { value: 'unset_readonly', label: __('Unset read-only') },
  { value: 'set_fixed_to', label: __('Set fixed to') },
  { value: 'add_option', label: __('Add option') },
  { value: 'remove_option', label: __('Remove option') },
])

const suggestedTicketAttributes = [
  'ticket.group_id',
  'ticket.priority_id',
  'ticket.state_id',
  'ticket.type_id',
  'ticket.owner_id',
  'ticket.customer_id',
  'ticket.organization_id',
  'ticket.title',
  'ticket.pending_time',
]

const fetchWorkflows = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await fetch('/api/v1/core_workflows', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    if (Array.isArray(data)) {
      workflows.value = data
    } else if (data.core_workflows && Array.isArray(data.core_workflows)) {
      workflows.value = data.core_workflows
    } else {
      workflows.value = []
    }
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to load core workflows.')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchWorkflows()
})

const filteredWorkflows = computed(() => {
  return workflows.value.filter((wf) => {
    if (selectedObjectFilter.value !== 'all' && wf.object !== selectedObjectFilter.value) {
      return false
    }
    if (selectedStatusFilter.value === 'active' && !wf.active) {
      return false
    }
    if (selectedStatusFilter.value === 'inactive' && wf.active) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const matchName = wf.name.toLowerCase().includes(q)
      const matchObj = wf.object.toLowerCase().includes(q)
      if (!matchName && !matchObj) return false
    }
    return true
  })
})

const getScreensDisplay = (wf: CoreWorkflowRecord): string[] => {
  const screens = wf.preferences?.screen || []
  return screens.map((s) => {
    if (s === 'create' || s === 'create_middle') return __('Creation mask')
    if (s === 'edit') return __('Edit mask')
    if (s === 'overview_bulk') return __('Overview bulk mask')
    return s
  })
}

const getConditionsCount = (wf: CoreWorkflowRecord): number => {
  const cSaved = Object.keys(wf.condition_saved || {}).length
  const cSelected = Object.keys(wf.condition_selected || {}).length
  return cSaved + cSelected
}

const getActionsCount = (wf: CoreWorkflowRecord): number => {
  return Object.keys(wf.perform || {}).length
}

const toggleWorkflowActive = async (wf: CoreWorkflowRecord) => {
  const newActive = !wf.active
  isToggling.value[wf.id] = true
  errorMessage.value = ''
  try {
    const response = await fetch(`/api/v1/core_workflows/${wf.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ active: newActive }),
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    wf.active = newActive
    successMessage.value = newActive
      ? __('Workflow "%s" activated.', wf.name)
      : __('Workflow "%s" deactivated.', wf.name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to update workflow status.')
  } finally {
    isToggling.value[wf.id] = false
  }
}

const openNewWorkflowModal = () => {
  modalState.value = {
    isOpen: true,
    isEditing: false,
    name: '',
    object: 'Ticket',
    priority: 100,
    active: true,
    stopAfterMatch: false,
    screens: ['create', 'edit'],
    conditionScope: 'selected',
    conditions: [
      {
        id: 'cond_1',
        attribute: 'ticket.group_id',
        operator: 'is',
        value: '',
      },
    ],
    conditionsSaved: [],
    actions: [
      {
        id: 'act_1',
        attribute: 'ticket.state_id',
        operator: 'show',
        value: '',
      },
    ],
    isSaving: false,
  }
  activeModalTab.value = 'general'
}

const openEditWorkflowModal = (wf: CoreWorkflowRecord) => {
  const conditions: WorkflowConditionItem[] = []
  let condIndex = 1

  if (wf.condition_selected) {
    for (const [attr, cond] of Object.entries(wf.condition_selected)) {
      const valStr = Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value || '')
      conditions.push({
        id: `cond_sel_${condIndex++}`,
        attribute: attr,
        operator: cond.operator || 'is',
        value: valStr,
      })
    }
  }

  const conditionsSaved: WorkflowConditionItem[] = []
  let condSavedIndex = 1
  if (wf.condition_saved) {
    for (const [attr, cond] of Object.entries(wf.condition_saved)) {
      const valStr = Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value || '')
      conditionsSaved.push({
        id: `cond_sav_${condSavedIndex++}`,
        attribute: attr,
        operator: cond.operator || 'is',
        value: valStr,
      })
    }
  }

  const actions: WorkflowActionItem[] = []
  let actIndex = 1
  if (wf.perform) {
    for (const [attr, act] of Object.entries(wf.perform)) {
      const valStr = Array.isArray(act.value) ? act.value.join(', ') : String(act.value || '')
      actions.push({
        id: `act_${actIndex++}`,
        attribute: attr,
        operator: act.operator || 'show',
        value: valStr,
      })
    }
  }

  const loadedScreens = wf.preferences?.screen ? [...wf.preferences.screen] : ['create', 'edit']
  if (loadedScreens.includes('create_middle') && !loadedScreens.includes('create')) {
    loadedScreens.push('create')
  }

  modalState.value = {
    isOpen: true,
    isEditing: true,
    id: wf.id,
    name: wf.name,
    object: wf.object,
    priority: wf.priority ?? 100,
    active: wf.active,
    stopAfterMatch: wf.stop_after_match,
    screens: loadedScreens,
    conditionScope: conditions.length > 0 || conditionsSaved.length === 0 ? 'selected' : 'saved',
    conditions,
    conditionsSaved,
    actions,
    isSaving: false,
  }
  activeModalTab.value = 'general'
}

const duplicateWorkflow = (wf: CoreWorkflowRecord) => {
  openEditWorkflowModal(wf)
  modalState.value.isEditing = false
  delete modalState.value.id
  modalState.value.name = `${wf.name} (${__('Copy')})`
}

const addCondition = () => {
  modalState.value.conditions.push({
    id: `cond_${Date.now()}`,
    attribute:
      modalState.value.object === 'Ticket'
        ? 'ticket.state_id'
        : `${modalState.value.object.toLowerCase()}.name`,
    operator: 'is',
    value: '',
  })
}

const removeCondition = (index: number) => {
  modalState.value.conditions.splice(index, 1)
}

const addConditionSaved = () => {
  modalState.value.conditionsSaved.push({
    id: `cond_saved_${Date.now()}`,
    attribute:
      modalState.value.object === 'Ticket'
        ? 'ticket.state_id'
        : `${modalState.value.object.toLowerCase()}.name`,
    operator: 'is',
    value: '',
  })
}

const removeConditionSaved = (index: number) => {
  modalState.value.conditionsSaved.splice(index, 1)
}

const addAction = () => {
  modalState.value.actions.push({
    id: `act_${Date.now()}`,
    attribute:
      modalState.value.object === 'Ticket'
        ? 'ticket.priority_id'
        : `${modalState.value.object.toLowerCase()}.name`,
    operator: 'show',
    value: '',
  })
}

const removeAction = (index: number) => {
  modalState.value.actions.splice(index, 1)
}

const toggleScreen = (screenId: string) => {
  const idx = modalState.value.screens.indexOf(screenId)
  if (idx > -1) {
    modalState.value.screens.splice(idx, 1)
  } else {
    modalState.value.screens.push(screenId)
  }
}

const saveWorkflow = async () => {
  const { name } = modalState.value
  if (!name.trim()) {
    errorMessage.value = __('Please enter a workflow name.')
    return
  }

  modalState.value.isSaving = true
  errorMessage.value = ''

  // Build conditionSelected payload
  const conditionSelected: Record<string, { operator: string; value: string[] }> = {}
  for (const cond of modalState.value.conditions) {
    if (cond.attribute.trim()) {
      const values = cond.value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      conditionSelected[cond.attribute.trim()] = {
        operator: cond.operator,
        value: values,
      }
    }
  }

  // Build conditionSaved payload
  const conditionSaved: Record<string, { operator: string; value: string[] }> = {}
  for (const cond of modalState.value.conditionsSaved) {
    if (cond.attribute.trim()) {
      const values = cond.value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      conditionSaved[cond.attribute.trim()] = {
        operator: cond.operator,
        value: values,
      }
    }
  }

  // Build perform payload
  const perform: Record<string, { operator: string; value?: string[]; show?: string }> = {}
  for (const act of modalState.value.actions) {
    if (act.attribute.trim()) {
      if (act.operator === 'show' || act.operator === 'hide') {
        perform[act.attribute.trim()] = {
          operator: act.operator,
          show: act.operator === 'show' ? 'true' : 'false',
        }
      } else {
        const values = act.value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
        perform[act.attribute.trim()] = {
          operator: act.operator,
          value: values,
        }
      }
    }
  }

  // Map screen identifiers for Ticket creation mask: 'create_middle' in backend
  const finalScreens = [...modalState.value.screens]
  if (
    modalState.value.object === 'Ticket' &&
    finalScreens.includes('create') &&
    !finalScreens.includes('create_middle')
  ) {
    finalScreens.push('create_middle')
  }

  const payload = {
    name: modalState.value.name.trim(),
    object: modalState.value.object,
    priority: modalState.value.priority,
    active: modalState.value.active,
    stop_after_match: modalState.value.stopAfterMatch,
    preferences: {
      screen: finalScreens,
    },
    condition_selected: conditionSelected,
    condition_saved: conditionSaved,
    perform,
  }

  try {
    const url = modalState.value.isEditing
      ? `/api/v1/core_workflows/${modalState.value.id}`
      : '/api/v1/core_workflows'
    const method = modalState.value.isEditing ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${response.status}`)
    }

    modalState.value.isOpen = false
    successMessage.value = modalState.value.isEditing
      ? __('Workflow updated successfully.')
      : __('Workflow created successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchWorkflows()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to save workflow.')
  } finally {
    modalState.value.isSaving = false
  }
}

const confirmDeleteWorkflow = (wf: CoreWorkflowRecord) => {
  deleteModal.value = {
    isOpen: true,
    workflow: wf,
    isDeleting: false,
  }
}

const executeDeleteWorkflow = async () => {
  if (!deleteModal.value.workflow) return
  deleteModal.value.isDeleting = true
  errorMessage.value = ''
  try {
    const response = await fetch(`/api/v1/core_workflows/${deleteModal.value.workflow.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    const { name } = deleteModal.value.workflow
    deleteModal.value.isOpen = false
    successMessage.value = __('Workflow "%s" deleted.', name)
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchWorkflows()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to delete workflow.')
  } finally {
    deleteModal.value.isDeleting = false
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <button
                type="button"
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                :title="__('Back to Administration')"
                :aria-label="__('Back to Administration')"
                @click="router.push('/manage')"
              >
                <CommonIcon name="arrow-left" class="h-4 w-4" />
              </button>
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                >
                  <CommonIcon name="split" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Core Workflows') }}
                </h1>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ __('System') }}
              </span>
            </div>
            <p class="text-sm text-slate-500 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
              {{
                __(
                  'Dynamically control field visibility, read-only state, and mandatory requirements across screens based on real-time selections.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              :aria-label="__('New Workflow')"
              @click="openNewWorkflowModal"
            >
              <CommonIcon name="plus" class="h-4 w-4" />
              {{ __('New Workflow') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        role="status"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span class="flex-1">{{ successMessage }}</span>
        <button
          type="button"
          class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
        role="alert"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span class="flex-1">{{ errorMessage }}</span>
        <button
          type="button"
          class="text-red-600 hover:text-red-800 dark:text-red-400"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <!-- Search & Filters -->
      <div
        class="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div class="relative w-full max-w-sm">
          <input
            id="search-workflows"
            v-model="searchQuery"
            type="search"
            :placeholder="__('Search for workflows...')"
            :aria-label="__('Search workflows')"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden ltr:pr-4 ltr:pl-9 rtl:pr-9 rtl:pl-4 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-slate-100"
          />
          <div class="absolute top-1/2 -translate-y-1/2 text-slate-400 ltr:left-3 rtl:right-3">
            <CommonIcon name="search" class="h-3.5 w-3.5" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- Object Filter -->
          <div class="flex items-center space-x-1.5 rtl:space-x-reverse">
            <label
              for="filter-object"
              class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {{ __('Object:') }}
            </label>
            <select
              id="filter-object"
              v-model="selectedObjectFilter"
              class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              :aria-label="__('Filter by object')"
            >
              <option value="all">{{ __('All Objects') }}</option>
              <option v-for="obj in availableObjects" :key="obj" :value="obj">
                {{ obj }}
              </option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center space-x-1.5 rtl:space-x-reverse">
            <label
              for="filter-status"
              class="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {{ __('Status:') }}
            </label>
            <select
              id="filter-status"
              v-model="selectedStatusFilter"
              class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              :aria-label="__('Filter by status')"
            >
              <option value="all">{{ __('All') }}</option>
              <option value="active">{{ __('Active') }}</option>
              <option value="inactive">{{ __('Inactive') }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Workflows Table -->
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-12 text-center">
          <div
            class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          ></div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ __('Loading core workflows...') }}
          </p>
        </div>

        <div v-else-if="filteredWorkflows.length === 0" class="p-16 text-center">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          >
            <CommonIcon name="split" class="h-6 w-6" />
          </div>
          <h3 class="mb-1 text-base font-semibold text-slate-800 dark:text-slate-100">
            {{ __('No workflows found') }}
          </h3>
          <p class="mx-auto mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {{
              searchQuery
                ? __('Try adjusting your search or filter.')
                : __('Get started by creating your first core workflow.')
            }}
          </p>
          <button
            v-if="!searchQuery"
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
            :aria-label="__('Create Workflow')"
            @click="openNewWorkflowModal"
          >
            <CommonIcon name="plus" class="h-4 w-4" />
            {{ __('Create Workflow') }}
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-start text-sm text-slate-600 dark:text-slate-300">
            <thead
              class="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Priority') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Name') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Object') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Screens') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Conditions & Actions') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Active') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-end">
                  {{ __('Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr
                v-for="wf in filteredWorkflows"
                :key="wf.id"
                class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <!-- Priority -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    #{{ wf.priority }}
                  </span>
                </td>

                <!-- Name -->
                <td class="px-6 py-4">
                  <div class="flex items-center">
                    <span class="font-medium text-slate-900 dark:text-white">
                      {{ wf.name }}
                    </span>
                    <span
                      v-if="wf.stop_after_match"
                      class="text-2xs inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset ltr:ml-2 rtl:mr-2 dark:bg-amber-900/30 dark:text-amber-300"
                      :title="__('Stops evaluating further workflows after match')"
                    >
                      {{ __('Stop match') }}
                    </span>
                  </div>
                </td>

                <!-- Object -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="{
                      'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300':
                        wf.object === 'Ticket',
                      'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300':
                        wf.object === 'User',
                      'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300':
                        wf.object === 'Organization',
                      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300':
                        wf.object === 'Group',
                    }"
                  >
                    {{ wf.object }}
                  </span>
                </td>

                <!-- Screens -->
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(screenLabel, idx) in getScreensDisplay(wf)"
                      :key="idx"
                      class="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {{ screenLabel }}
                    </span>
                    <span v-if="getScreensDisplay(wf).length === 0" class="text-xs text-slate-400">
                      {{ __('All screens') }}
                    </span>
                  </div>
                </td>

                <!-- Conditions & Actions Summary -->
                <td class="px-6 py-4 text-xs whitespace-nowrap">
                  <div class="flex flex-col gap-1">
                    <span class="text-slate-600 dark:text-slate-400">
                      {{
                        getConditionsCount(wf) === 0
                          ? __('Always runs')
                          : __('%s condition(s)', getConditionsCount(wf))
                      }}
                    </span>
                    <span class="font-medium text-blue-600 dark:text-blue-400">
                      {{ __('%s action(s)', getActionsCount(wf)) }}
                    </span>
                  </div>
                </td>

                <!-- Active Switch -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    :class="wf.active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'"
                    role="switch"
                    :aria-checked="wf.active"
                    :aria-label="__('Toggle active state for %s', wf.name)"
                    :disabled="isToggling[wf.id]"
                    @click="toggleWorkflowActive(wf)"
                  >
                    <span
                      class="pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out"
                      :class="
                        wf.active
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </td>

                <!-- Row Actions -->
                <td class="px-6 py-4 text-end whitespace-nowrap">
                  <div class="flex items-center justify-end space-x-2 rtl:space-x-reverse">
                    <button
                      type="button"
                      class="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      :title="__('Edit')"
                      :aria-label="__('Edit %s', wf.name)"
                      @click="openEditWorkflowModal(wf)"
                    >
                      <CommonIcon name="pen" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      :title="__('Duplicate')"
                      :aria-label="__('Duplicate %s', wf.name)"
                      @click="duplicateWorkflow(wf)"
                    >
                      <CommonIcon name="copy" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      :title="__('Delete')"
                      :aria-label="__('Delete %s', wf.name)"
                      @click="confirmDeleteWorkflow(wf)"
                    >
                      <CommonIcon name="trash" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- New / Edit Modal -->
      <div
        v-if="modalState.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="modalState.isEditing ? __('Edit Workflow') : __('New Workflow')"
      >
        <div
          class="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <!-- Modal Header -->
          <div
            class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800"
          >
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                {{ modalState.isEditing ? __('Edit Workflow') : __('New Workflow') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  modalState.isEditing
                    ? __('Update conditions and actions for this workflow.')
                    : __('Create conditional UI behaviors for forms.')
                }}
              </p>
            </div>
            <button
              type="button"
              class="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              :aria-label="__('Close')"
              @click="modalState.isOpen = false"
            >
              <CommonIcon name="close" class="h-5 w-5" />
            </button>
          </div>

          <!-- Modal Tabs -->
          <div
            class="flex border-b border-slate-200 bg-slate-50/80 px-6 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <button
              type="button"
              class="cursor-pointer border-b-2 px-4 py-3 text-xs font-semibold transition"
              :class="
                activeModalTab === 'general'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              "
              @click="activeModalTab = 'general'"
            >
              {{ __('1. General Settings') }}
            </button>
            <button
              type="button"
              class="cursor-pointer border-b-2 px-4 py-3 text-xs font-semibold transition"
              :class="
                activeModalTab === 'conditions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              "
              @click="activeModalTab = 'conditions'"
            >
              {{ __('2. Match Conditions') }}
              <span
                class="text-2xs inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700 ltr:ml-1 rtl:mr-1 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ modalState.conditions.length + modalState.conditionsSaved.length }}
              </span>
            </button>
            <button
              type="button"
              class="cursor-pointer border-b-2 px-4 py-3 text-xs font-semibold transition"
              :class="
                activeModalTab === 'actions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              "
              @click="activeModalTab = 'actions'"
            >
              {{ __('3. Field Actions') }}
              <span
                class="text-2xs inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700 ltr:ml-1 rtl:mr-1 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ modalState.actions.length }}
              </span>
            </button>
          </div>

          <!-- Modal Body Content -->
          <div class="max-h-[60vh] overflow-y-auto p-6">
            <!-- TAB 1: General Settings -->
            <div v-if="activeModalTab === 'general'" class="space-y-5">
              <div>
                <label
                  for="wf-name"
                  class="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {{ __('Workflow Name') }} <span class="text-red-500">*</span>
                </label>
                <input
                  id="wf-name"
                  v-model="modalState.name"
                  type="text"
                  required
                  class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  :placeholder="__('e.g. VIP Customer VIP Status Fields')"
                />
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    for="wf-object"
                    class="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {{ __('Target Object') }}
                  </label>
                  <select
                    id="wf-object"
                    v-model="modalState.object"
                    class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    <option v-for="obj in availableObjects" :key="obj" :value="obj">
                      {{ obj }}
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    for="wf-priority"
                    class="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {{ __('Priority Order (lower runs first)') }}
                  </label>
                  <input
                    id="wf-priority"
                    v-model.number="modalState.priority"
                    type="number"
                    min="1"
                    class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <!-- Screen Selection -->
              <div>
                <label class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {{ __('Apply on Screens') }}
                </label>
                <div class="mt-2 flex flex-wrap gap-4">
                  <label
                    v-for="scr in availableScreens"
                    :key="scr.id"
                    class="flex cursor-pointer items-center space-x-2 text-xs text-slate-700 rtl:space-x-reverse dark:text-slate-300"
                  >
                    <input
                      type="checkbox"
                      :checked="modalState.screens.includes(scr.id)"
                      class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      @change="toggleScreen(scr.id)"
                    />
                    <span>{{ scr.label }}</span>
                  </label>
                </div>
              </div>

              <div class="flex flex-col gap-3 pt-2">
                <label class="flex cursor-pointer items-center space-x-3 rtl:space-x-reverse">
                  <input
                    v-model="modalState.active"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <div>
                    <span class="text-xs font-medium text-slate-900 dark:text-white">{{
                      __('Active')
                    }}</span>
                    <p class="text-2xs text-slate-500 dark:text-slate-400">
                      {{ __('Enable or disable this workflow rule across all forms.') }}
                    </p>
                  </div>
                </label>

                <label class="flex cursor-pointer items-center space-x-3 rtl:space-x-reverse">
                  <input
                    v-model="modalState.stopAfterMatch"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <div>
                    <span class="text-xs font-medium text-slate-900 dark:text-white">
                      {{ __('Stop After Match') }}
                    </span>
                    <p class="text-2xs text-slate-500 dark:text-slate-400">
                      {{
                        __(
                          'If this workflow matches, do not evaluate any subsequent lower priority workflows.',
                        )
                      }}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <!-- TAB 2: Match Conditions -->
            <div v-else-if="activeModalTab === 'conditions'" class="space-y-4">
              <!-- Scope switcher -->
              <div class="flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <button
                  type="button"
                  class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="
                    modalState.conditionScope === 'selected'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  "
                  @click="modalState.conditionScope = 'selected'"
                >
                  {{ __('Selected Conditions (Form Input)') }}
                  <span class="rounded-full bg-slate-200 px-1.5 py-0.5 text-2xs ltr:ml-1 rtl:mr-1 dark:bg-slate-700">
                    {{ modalState.conditions.length }}
                  </span>
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="
                    modalState.conditionScope === 'saved'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  "
                  @click="modalState.conditionScope = 'saved'"
                >
                  {{ __('Saved Conditions (Stored in DB)') }}
                  <span class="rounded-full bg-slate-200 px-1.5 py-0.5 text-2xs ltr:ml-1 rtl:mr-1 dark:bg-slate-700">
                    {{ modalState.conditionsSaved.length }}
                  </span>
                </button>
              </div>

              <!-- Scope 1: Selected Conditions -->
              <div v-if="modalState.conditionScope === 'selected'" class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-semibold text-slate-900 uppercase dark:text-white">
                      {{ __('Selected Conditions (Form Input)') }}
                    </h3>
                    <p class="text-2xs text-slate-500 dark:text-slate-400">
                      {{
                        __(
                          'Conditions evaluated on unsaved user inputs currently entered in the form.',
                        )
                      }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    @click="addCondition"
                  >
                    <CommonIcon name="plus" class="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                    {{ __('Add Condition') }}
                  </button>
                </div>

                <div
                  v-if="modalState.conditions.length === 0"
                  class="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700"
                >
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ __('No selected conditions defined.') }}
                  </p>
                  <button
                    type="button"
                    class="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    @click="addCondition"
                  >
                    {{ __('+ Add first selected condition') }}
                  </button>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="(cond, index) in modalState.conditions"
                    :key="cond.id"
                    class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div class="flex-1">
                      <input
                        v-model="cond.attribute"
                        type="text"
                        list="attributes-list"
                        :aria-label="__('Condition Attribute')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        :placeholder="__('Attribute, e.g. ticket.state_id')"
                      />
                    </div>
                    <div class="w-full sm:w-36">
                      <select
                        v-model="cond.operator"
                        :aria-label="__('Condition Operator')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      >
                        <option
                          v-for="op in availableConditionOperators"
                          :key="op.value"
                          :value="op.value"
                        >
                          {{ op.label }}
                        </option>
                      </select>
                    </div>
                    <div class="flex-1">
                      <input
                        v-model="cond.value"
                        type="text"
                        :aria-label="__('Condition Value')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        :placeholder="__('Values (comma separated)')"
                      />
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 sm:self-auto dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      :aria-label="__('Remove Condition')"
                      @click="removeCondition(index)"
                    >
                      <CommonIcon name="trash" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Scope 2: Saved Conditions -->
              <div v-else class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-xs font-semibold text-slate-900 uppercase dark:text-white">
                      {{ __('Saved Conditions (Stored in DB)') }}
                    </h3>
                    <p class="text-2xs text-slate-500 dark:text-slate-400">
                      {{
                        __(
                          'Conditions evaluated on existing saved object attributes in the database.',
                        )
                      }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    @click="addConditionSaved"
                  >
                    <CommonIcon name="plus" class="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                    {{ __('Add Condition') }}
                  </button>
                </div>

                <div
                  v-if="modalState.conditionsSaved.length === 0"
                  class="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700"
                >
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ __('No saved conditions defined.') }}
                  </p>
                  <button
                    type="button"
                    class="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    @click="addConditionSaved"
                  >
                    {{ __('+ Add first saved condition') }}
                  </button>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="(cond, index) in modalState.conditionsSaved"
                    :key="cond.id"
                    class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div class="flex-1">
                      <input
                        v-model="cond.attribute"
                        type="text"
                        list="attributes-list"
                        :aria-label="__('Saved Condition Attribute')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        :placeholder="__('Attribute, e.g. ticket.state_id')"
                      />
                    </div>
                    <div class="w-full sm:w-36">
                      <select
                        v-model="cond.operator"
                        :aria-label="__('Saved Condition Operator')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      >
                        <option
                          v-for="op in availableConditionOperators"
                          :key="op.value"
                          :value="op.value"
                        >
                          {{ op.label }}
                        </option>
                      </select>
                    </div>
                    <div class="flex-1">
                      <input
                        v-model="cond.value"
                        type="text"
                        :aria-label="__('Saved Condition Value')"
                        class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        :placeholder="__('Values (comma separated)')"
                      />
                    </div>
                    <button
                      type="button"
                      class="cursor-pointer self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 sm:self-auto dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      :aria-label="__('Remove Saved Condition')"
                      @click="removeConditionSaved(index)"
                    >
                      <CommonIcon name="trash" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: Field Actions -->
            <div v-else-if="activeModalTab === 'actions'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-semibold text-slate-900 uppercase dark:text-white">
                    {{ __('Perform Actions on Fields') }}
                  </h3>
                  <p class="text-2xs text-slate-500 dark:text-slate-400">
                    {{
                      __(
                        'Set fields to show, hide, read-only, mandatory, or pre-populate fixed values.',
                      )
                    }}
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  @click="addAction"
                >
                  <CommonIcon name="plus" class="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                  {{ __('Add Action') }}
                </button>
              </div>

              <div
                v-if="modalState.actions.length === 0"
                class="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700"
              >
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'No actions defined. Add at least one action to apply when conditions match.',
                    )
                  }}
                </p>
                <button
                  type="button"
                  class="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  @click="addAction"
                >
                  {{ __('+ Add first action') }}
                </button>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(act, index) in modalState.actions"
                  :key="act.id"
                  class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <!-- Attribute -->
                  <div class="flex-1">
                    <input
                      v-model="act.attribute"
                      type="text"
                      list="attributes-list"
                      :aria-label="__('Action Field')"
                      class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      :placeholder="__('Field, e.g. ticket.priority_id')"
                    />
                  </div>

                  <!-- Operator / Action -->
                  <div class="w-full sm:w-44">
                    <select
                      v-model="act.operator"
                      :aria-label="__('Action Type')"
                      class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option
                        v-for="actOp in availableActionOperators"
                        :key="actOp.value"
                        :value="actOp.value"
                      >
                        {{ actOp.label }}
                      </option>
                    </select>
                  </div>

                  <!-- Value (if applicable) -->
                  <div v-if="act.operator !== 'show' && act.operator !== 'hide'" class="flex-1">
                    <input
                      v-model="act.value"
                      type="text"
                      :aria-label="__('Action Value')"
                      class="block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      :placeholder="__('Target value or options')"
                    />
                  </div>

                  <!-- Delete -->
                  <button
                    type="button"
                    class="cursor-pointer self-end rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 sm:self-auto dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    :aria-label="__('Remove Action')"
                    @click="removeAction(index)"
                  >
                    <CommonIcon name="trash" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div
            class="flex items-center justify-end space-x-3 border-t border-slate-200 px-6 py-4 rtl:space-x-reverse dark:border-slate-800"
          >
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Cancel')"
              @click="modalState.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-hidden disabled:opacity-50"
              :disabled="modalState.isSaving"
              :aria-label="__('Save Workflow')"
              @click="saveWorkflow"
            >
              <CommonIcon
                v-if="modalState.isSaving"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ modalState.isEditing ? __('Save Changes') : __('Create Workflow') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div
        v-if="deleteModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Confirm Deletion')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              <CommonIcon name="trash" class="size-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Delete Core Workflow') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Are you sure you want to delete "%s"? This action cannot be undone.',
                    deleteModal.workflow?.name,
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="deleteModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-hidden disabled:opacity-50"
              :disabled="deleteModal.isDeleting"
              :aria-label="__('Delete Workflow')"
              @click="executeDeleteWorkflow"
            >
              <CommonIcon
                v-if="deleteModal.isDeleting"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Delete Workflow') }}
            </button>
          </div>
        </div>
      </div>

      <datalist id="attributes-list">
        <option v-for="attr in suggestedTicketAttributes" :key="attr" :value="attr" />
      </datalist>
    </div>
  </LayoutContent>
</template>
