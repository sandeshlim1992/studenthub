<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApplicationStore } from '#shared/stores/application.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import {
  actionFields,
  actionProblems,
  conditionFields,
  conditionStateProblems,
  conditionToState,
  emptyConditionState,
  performToRows,
  rowsToPerform,
  stateRows,
  stateToCondition,
  type ActionRow,
  type AutomationOptions,
  type ConditionState,
} from '#desktop/pages/manage/components/Automation/automation.ts'
import AutomationActionEditor from '#desktop/pages/manage/components/Automation/AutomationActionEditor.vue'
import AutomationConditions from '#desktop/pages/manage/components/Automation/AutomationConditions.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

interface TriggerItem {
  id: number
  name: string
  activator?: string
  execution_condition_mode?: string
  condition?: unknown
  perform?: unknown
  note?: string
  active: boolean
  updated_at?: string
  created_at?: string
}

const router = useRouter()
const triggers = ref<TriggerItem[]>([])

const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuId = ref<number | null>(null)

// Drawer / Form state
const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

const defaultFormState = () => ({
  id: null as number | null,
  name: '',
  activator: 'action',
  execution_condition_mode: 'selective',
  note: '',
  active: true,
})

const formState = ref(defaultFormState())

// Student Hub: conditions and actions are edited with the shared editor (Automation/), which knows
// a trigger's fields (the change that runs it, its message) and keeps what it doesn't know.
const options = ref<AutomationOptions | null>(null)
const conditionState = ref<ConditionState>(emptyConditionState())
const actionRows = ref<ActionRow[]>([])
const problems = ref<string[]>([])

const allowExpert = computed(() => Boolean(useApplicationStore().config.ticket_allow_expert_conditions))
const conditionFieldList = computed(() => (options.value ? conditionFields(options.value, 'trigger') : []))
const actionFieldList = computed(() => (options.value ? actionFields(options.value, 'trigger') : []))

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Triggers') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const htmlToPlainText = (html: string) => {
  if (!html) return ''
  const withNewlines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
  const doc = new DOMParser().parseFromString(withNewlines, 'text/html')
  return doc.body.textContent || ''
}

const fetchTriggers = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/triggers', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        triggers.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage triggers.')
    } else {
      errorText.value = `Failed to load triggers (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch triggers:', e)
    errorText.value = __('Error fetching triggers. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchOptions = async () => {
  try {
    options.value = await studenthubApi<AutomationOptions>('/api/v1/studenthub/automation/options')
  } catch (e) {
    console.error('Failed to fetch the condition and action choices:', e)
  }
}

const filteredTriggers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return triggers.value
  return triggers.value.filter(
    (t) =>
      t.name.toLowerCase().includes(query) ||
      (t.note && t.note.toLowerCase().includes(query))
  )
})

const openDrawer = async (title: string, trig?: TriggerItem, copy = false) => {
  if (!options.value) await fetchOptions()
  formState.value = trig
    ? {
        id: copy ? null : trig.id,
        name: copy ? __('%s (Copy)', trig.name || __('Trigger')) : trig.name || '',
        activator: trig.activator || 'action',
        execution_condition_mode: trig.execution_condition_mode || 'selective',
        note: htmlToPlainText(trig.note || ''),
        active: trig.active !== false,
      }
    : defaultFormState()
  conditionState.value = trig ? conditionToState(trig.condition, conditionFieldList.value) : emptyConditionState()
  actionRows.value = trig ? performToRows(trig.perform, actionFieldList.value) : []
  problems.value = []
  drawerTitle.value = title
  showDrawer.value = true
}

const handleNewTrigger = () => openDrawer(__('New Trigger'))

const handleEditTrigger = (trig: TriggerItem) => openDrawer(__('Edit Trigger'), trig)

const handleCloneTrigger = (trig: TriggerItem) => openDrawer(__('Clone Trigger'), trig, true)

const checkProblems = () => {
  const found: string[] = []
  if (!formState.value.name.trim()) found.push(__('Name is required.'))
  if (!stateRows(conditionState.value).length) found.push(__('Add at least one condition.'))
  found.push(...conditionStateProblems(conditionState.value, conditionFieldList.value))
  if (!actionRows.value.length) found.push(__('Add at least one action.'))
  found.push(...actionProblems(actionRows.value, actionFieldList.value))
  problems.value = found
  return found.length === 0
}

const saveTrigger = async () => {
  if (!checkProblems()) return

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      activator: formState.value.activator,
      execution_condition_mode: formState.value.execution_condition_mode,
      note: formState.value.note,
      active: formState.value.active,
      condition: stateToCondition(conditionState.value, conditionFieldList.value),
      perform: rowsToPerform(actionRows.value, actionFieldList.value),
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/triggers/${formState.value.id}` : '/api/v1/triggers'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      showDrawer.value = false
      fetchTriggers()
    } else {
      const data = await res.json()
      problems.value = [data.error_human || data.error || __('Failed to save trigger.')]
    }
  } catch (e) {
    console.error('Failed to save trigger:', e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteTrigger = async (id: number, name: string) => {
  if (!confirm(__('Are you sure you want to delete trigger "%s"?', name))) return
  try {
    const res = await fetch(`/api/v1/triggers/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchTriggers()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete trigger.'))
    }
  } catch (e) {
    console.error('Failed to delete trigger:', e)
  }
}

const toggleActiveState = async (trig: TriggerItem) => {
  try {
    const res = await fetch(`/api/v1/triggers/${trig.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !trig.active }),
    })
    if (res.ok) {
      fetchTriggers()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

onMounted(() => {
  fetchTriggers()
  fetchOptions()
  window.addEventListener('click', closeActionMenu)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100" @click="closeActionMenu">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <button
            @click="router.push('/manage')"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Triggers') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewTrigger"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New Trigger') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for triggers')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Activated By') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="4" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredTriggers.length === 0">
            <tr>
              <td colspan="4" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="lightning" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No triggers found') }}</h3>
                <p class="text-xs">{{ __('No triggers matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="trig in filteredTriggers"
              :key="trig.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditTrigger(trig)"
            >
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ trig.name }}
              </td>
              <!-- Activated By -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 capitalize">
                {{ trig.activator === 'time' ? __('Time event') : __('Action') }}
              </td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(trig)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="trig.active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(trig.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === trig.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="() => { closeActionMenu(); handleEditTrigger(trig) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <button
                      @click="() => { closeActionMenu(); handleCloneTrigger(trig) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="() => { closeActionMenu(); handleDeleteTrigger(trig.id, trig.name) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <CommonIcon name="trash3" class="w-3.5 h-3.5 mr-2.5 text-red-400" />{{ __('Delete') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>

  <!-- Drawer -->
  <Teleport to="body">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end"
      @click="showDrawer = false"
    >
      <div
        class="w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="lightning" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button
            @click="showDrawer = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Description Box -->
          <div class="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ __('Triggers watch tickets for certain changes, and then fire off automated actions whenever those changes occur.') }}
          </div>

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="100"
              :placeholder="__('Name of the trigger')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Activated by -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Activated by') }}
            </label>
            <select
              v-model="formState.activator"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="action">{{ __('Action') }}</option>
              <option value="time">{{ __('Time event') }}</option>
            </select>
          </div>

          <!-- Action execution mode -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Action execution') }}
            </label>
            <div class="space-y-2">
              <label class="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                <input type="radio" value="selective" v-model="formState.execution_condition_mode" class="mt-0.5 text-blue-600" />
                <div>
                  <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ __('Selective (default)') }}</span>
                  <p class="text-[11px] text-slate-500">{{ __('When at least one field from conditions was updated or article was added and conditions match.') }}</p>
                </div>
              </label>
              <label class="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer">
                <input type="radio" value="always" v-model="formState.execution_condition_mode" class="mt-0.5 text-blue-600" />
                <div>
                  <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ __('Always') }}</span>
                  <p class="text-[11px] text-slate-500">{{ __('When conditions match regardless of specific field updates.') }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Conditions -->
          <section aria-labelledby="trigger-conditions-title">
            <h3 id="trigger-conditions-title" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Conditions for affected objects') }} <span class="text-red-500">*</span>
            </h3>
            <p v-if="!options" class="text-sm text-slate-500">{{ __('Loading…') }}</p>
            <AutomationConditions
              v-else
              v-model="conditionState"
              :fields="conditionFieldList"
              id-prefix="trigger-condition"
              :allow-expert="allowExpert"
            />
          </section>

          <!-- Actions -->
          <section aria-labelledby="trigger-actions-title">
            <h3 id="trigger-actions-title" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Execute changes on objects') }}
            </h3>
            <AutomationActionEditor v-if="options" v-model="actionRows" :fields="actionFieldList" id-prefix="trigger-action" />
          </section>

          <!-- Note -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Note') }}
            </label>
            <textarea
              v-model="formState.note"
              rows="3"
              maxlength="250"
              :placeholder="__('Internal note about this trigger')"
              class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Active') }} <span class="text-red-500">*</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the trigger is active for automated execution.') }}</p>
            </div>
            <button
              @click="formState.active = !formState.active"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="formState.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="formState.active ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>
          <CommonAlert v-if="problems.length" variant="danger" role="alert">
            <ul class="list-disc ps-4">
              <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
            </ul>
          </CommonAlert>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            @click="showDrawer = false"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
          >
            {{ __('Cancel') }}
          </button>
          <button
            @click="saveTrigger"
            :disabled="submitting"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
