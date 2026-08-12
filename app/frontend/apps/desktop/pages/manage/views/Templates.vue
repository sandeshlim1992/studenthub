<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface TemplateItem {
  id: number
  name: string
  options?: Record<string, { value?: string | number | string[] } | string | number | string[]>
  active?: boolean
  updated_at?: string
  created_at?: string
}

interface MetaItem {
  id: number
  name: string
}

const router = useRouter()
const templates = ref<TemplateItem[]>([])
const ticketStatesList = ref<MetaItem[]>([])
const ticketPrioritiesList = ref<MetaItem[]>([])
const groupsList = ref<MetaItem[]>([])
const usersList = ref<{ id: number; fullname: string; login: string }[]>([])

const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuId = ref<number | null>(null)

// Drawer / Form state
const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

interface ActionRow {
  field: string
  value: string
  textValue: string
}

const defaultFormState = () => ({
  id: null as number | null,
  name: '',
  active: true,
  actions: [] as ActionRow[],
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Templates') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const buildOptionsPayload = () => {
  const options: Record<string, { value: string }> = {}
  for (const act of formState.value.actions) {
    let key = ''
    let val = ''
    if (act.field === 'title') {
      key = 'ticket.title'
      val = act.textValue
    } else if (act.field === 'state') {
      key = 'ticket.state_id'
      val = act.value
    } else if (act.field === 'priority') {
      key = 'ticket.priority_id'
      val = act.value
    } else if (act.field === 'group') {
      key = 'ticket.group_id'
      val = act.value
    } else if (act.field === 'owner') {
      key = 'ticket.owner_id'
      val = act.value
    }

    if (key && val) {
      options[key] = { value: val }
    }
  }
  return options
}

const parseOptionsToActions = (options?: Record<string, unknown>) => {
  const actions: ActionRow[] = []
  if (!options) return actions

  for (const [key, rawVal] of Object.entries(options)) {
    let field = ''
    if (key === 'ticket.title') field = 'title'
    else if (key === 'ticket.state_id') field = 'state'
    else if (key === 'ticket.priority_id') field = 'priority'
    else if (key === 'ticket.group_id') field = 'group'
    else if (key === 'ticket.owner_id') field = 'owner'

    if (!field) continue

    let valStr = ''
    if (typeof rawVal === 'object' && rawVal !== null && 'value' in rawVal) {
      valStr = String((rawVal as { value: unknown }).value ?? '')
    } else {
      valStr = String(rawVal ?? '')
    }

    actions.push({
      field,
      value: field === 'title' ? '' : valStr,
      textValue: field === 'title' ? valStr : '',
    })
  }

  return actions
}

const fetchTemplates = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/templates', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        templates.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage templates.')
    } else {
      errorText.value = `Failed to load templates (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch templates:', e)
    errorText.value = __('Error fetching templates. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchMetadata = async () => {
  try {
    const [groupsRes, statesRes, prioritiesRes, usersRes] = await Promise.all([
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_states', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/ticket_priorities', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/users?per_page=500', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])
    if (groupsRes.ok) groupsList.value = await groupsRes.json()
    if (statesRes.ok) ticketStatesList.value = await statesRes.json()
    if (prioritiesRes.ok) ticketPrioritiesList.value = await prioritiesRes.json()
    if (usersRes.ok) usersList.value = await usersRes.json()
  } catch (e) {
    console.error('Failed to fetch metadata:', e)
  }
}

const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return templates.value
  return templates.value.filter((t) => t.name.toLowerCase().includes(query))
})

const handleNewTemplate = () => {
  formState.value = defaultFormState()
  formState.value.actions = [{ field: 'title', value: '', textValue: '' }]
  drawerTitle.value = __('New Template')
  showDrawer.value = true
}

const handleEditTemplate = (tmpl: TemplateItem) => {
  formState.value = {
    id: tmpl.id,
    name: tmpl.name || '',
    active: tmpl.active !== false,
    actions: parseOptionsToActions(tmpl.options as Record<string, unknown>),
  }
  if (formState.value.actions.length === 0) {
    formState.value.actions.push({ field: 'title', value: '', textValue: '' })
  }
  drawerTitle.value = __('Edit Template')
  showDrawer.value = true
}

const saveTemplate = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      active: formState.value.active,
      options: buildOptionsPayload(),
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/templates/${formState.value.id}` : '/api/v1/templates'
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
      fetchTemplates()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save template.'))
    }
  } catch (e) {
    console.error('Failed to save template:', e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteTemplate = async (id: number, name: string) => {
  if (!confirm(`Are you sure you want to delete template "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/templates/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchTemplates()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete template.'))
    }
  } catch (e) {
    console.error('Failed to delete template:', e)
  }
}

const toggleActiveState = async (tmpl: TemplateItem) => {
  try {
    const res = await fetch(`/api/v1/templates/${tmpl.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !tmpl.active }),
    })
    if (res.ok) {
      fetchTemplates()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

onMounted(() => {
  fetchTemplates()
  fetchMetadata()
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
            {{ __('Templates') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewTemplate"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New Template') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for templates')"
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
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="3" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredTemplates.length === 0">
            <tr>
              <td colspan="3" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="file" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No templates found') }}</h3>
                <p class="text-xs">{{ __('No templates matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="tmpl in filteredTemplates"
              :key="tmpl.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditTemplate(tmpl)"
            >
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ tmpl.name }}
              </td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(tmpl)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="tmpl.active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(tmpl.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === tmpl.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="handleEditTemplate(tmpl)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteTemplate(tmpl.id, tmpl.name)"
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
        class="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="file" class="w-5 h-5" />
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
            {{ __('With templates it is possible to pre-fill tickets quickly and easily.') }}
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
              :placeholder="__('Name of the template')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Actions -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Actions') }}
            </label>
            <div class="space-y-3">
              <div
                v-for="(act, idx) in formState.actions"
                :key="idx"
                class="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl relative"
              >
                <button
                  @click="formState.actions.splice(idx, 1)"
                  class="absolute top-3 right-3 text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <CommonIcon name="trash3" class="w-4 h-4" />
                </button>
                <div class="grid grid-cols-2 gap-3 mb-3 pr-8">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">{{ __('Field') }}</label>
                    <select
                      v-model="act.field"
                      @change="act.value = ''; act.textValue = ''"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="title">{{ __('Title') }}</option>
                      <option value="state">{{ __('State') }}</option>
                      <option value="priority">{{ __('Priority') }}</option>
                      <option value="group">{{ __('Group') }}</option>
                      <option value="owner">{{ __('Owner') }}</option>
                    </select>
                  </div>
                </div>

                <!-- Values Selection -->
                <div>
                  <label class="block text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">{{ __('Value') }}</label>

                  <!-- Title Input -->
                  <div v-if="act.field === 'title'">
                    <input
                      v-model="act.textValue"
                      type="text"
                      :placeholder="__('Default ticket title')"
                      class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <!-- State -->
                  <div v-else-if="act.field === 'state'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="state in ticketStatesList"
                      :key="state.id"
                      class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="act.value === String(state.id) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :value="String(state.id)"
                        v-model="act.value"
                        class="text-blue-600"
                      />
                      <span>{{ state.name }}</span>
                    </label>
                  </div>

                  <!-- Priority -->
                  <div v-else-if="act.field === 'priority'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="prio in ticketPrioritiesList"
                      :key="prio.id"
                      class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="act.value === String(prio.id) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :value="String(prio.id)"
                        v-model="act.value"
                        class="text-blue-600"
                      />
                      <span>{{ prio.name }}</span>
                    </label>
                  </div>

                  <!-- Group -->
                  <div v-else-if="act.field === 'group'" class="flex flex-wrap gap-1.5">
                    <label
                      v-for="grp in groupsList"
                      :key="grp.id"
                      class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="act.value === String(grp.id) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :value="String(grp.id)"
                        v-model="act.value"
                        class="text-blue-600"
                      />
                      <span>{{ grp.name }}</span>
                    </label>
                  </div>

                  <!-- Owner -->
                  <div v-else-if="act.field === 'owner'" class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    <label
                      v-for="user in usersList.slice(0, 40)"
                      :key="user.id"
                      class="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-md text-xs cursor-pointer"
                      :class="act.value === String(user.id) ? 'border-blue-400' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        :value="String(user.id)"
                        v-model="act.value"
                        class="text-blue-600"
                      />
                      <span>{{ user.fullname || user.login }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                @click="formState.actions.push({ field: 'title', value: '', textValue: '' })"
                class="w-full px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
              >
                <CommonIcon name="plus" class="w-3.5 h-3.5" />{{ __('Add Action') }}
              </button>
            </div>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Active') }} <span class="text-red-500">*</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the template is active for pre-filling tickets.') }}</p>
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
            @click="saveTemplate"
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
