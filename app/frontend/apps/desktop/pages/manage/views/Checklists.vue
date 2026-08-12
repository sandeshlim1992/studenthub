<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ChecklistTemplateItem {
  id: number
  name: string
  sorted_item_ids?: number[]
  items?: { id: number; text: string }[]
  active: boolean
  updated_at?: string
  created_at?: string
}

const router = useRouter()
const checklistTemplates = ref<ChecklistTemplateItem[]>([])
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
  active: true,
  items: [''],
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Checklists') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const draggedItemIndex = ref<number | null>(null)

const handleDragStart = (index: number, event: DragEvent) => {
  draggedItemIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (targetIndex: number, event: DragEvent) => {
  event.preventDefault()
  if (draggedItemIndex.value === null || draggedItemIndex.value === targetIndex) return
  const items = [...formState.value.items]
  const [removed] = items.splice(draggedItemIndex.value, 1)
  items.splice(targetIndex, 0, removed)
  formState.value.items = items
  draggedItemIndex.value = null
}

const moveItem = (index: number, direction: 'up' | 'down') => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= formState.value.items.length) return
  const items = [...formState.value.items]
  const temp = items[index]
  items[index] = items[targetIndex]
  items[targetIndex] = temp
  formState.value.items = items
}

const addItemRow = () => {
  formState.value.items.push('')
}

const removeItemRow = (index: number) => {
  formState.value.items.splice(index, 1)
  if (formState.value.items.length === 0) {
    formState.value.items.push('')
  }
}

const fetchChecklistTemplates = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/checklist_templates?expand=true', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        checklistTemplates.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage checklists.')
    } else {
      errorText.value = `Failed to load checklists (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch checklist templates:', e)
    errorText.value = __('Error fetching checklists. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const filteredChecklistTemplates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return checklistTemplates.value
  return checklistTemplates.value.filter((t) => t.name.toLowerCase().includes(query))
})

const handleNewChecklist = () => {
  formState.value = defaultFormState()
  drawerTitle.value = __('New Checklist')
  showDrawer.value = true
}

const handleEditChecklist = async (tmpl: ChecklistTemplateItem) => {
  isLoading.value = true
  try {
    const res = await fetch(`/api/v1/checklist_templates/${tmpl.id}?full=true`, {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      const record = data.assets?.ChecklistTemplate?.[tmpl.id] || data
      const sortedItemIds: number[] = record.sorted_item_ids || data.sorted_item_ids || []
      const itemAssets: Record<string, { id: number; text: string }> = data.assets?.ChecklistTemplateItem || {}

      let itemTexts: string[] = []
      if (sortedItemIds.length > 0) {
        itemTexts = sortedItemIds.map((itemId) => itemAssets[String(itemId)]?.text).filter(Boolean) as string[]
      } else if (Array.isArray(record.items)) {
        itemTexts = record.items.map((i: { text: string }) => i.text).filter(Boolean)
      }

      formState.value = {
        id: tmpl.id,
        name: record.name || tmpl.name || '',
        active: record.active !== false,
        items: itemTexts.length > 0 ? itemTexts : [''],
      }
      drawerTitle.value = __('Edit Checklist')
      showDrawer.value = true
    } else {
      alert(__('Failed to fetch checklist details.'))
    }
  } catch (e) {
    console.error('Failed to fetch checklist details:', e)
  } finally {
    isLoading.value = false
  }
}

const saveChecklistTemplate = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }

  const validItems = formState.value.items.map((i) => i.trim()).filter(Boolean)

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      active: formState.value.active,
      items: validItems,
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/checklist_templates/${formState.value.id}` : '/api/v1/checklist_templates'
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
      fetchChecklistTemplates()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save checklist.'))
    }
  } catch (e) {
    console.error('Failed to save checklist template:', e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteChecklistTemplate = async (id: number, name: string) => {
  if (!confirm(`Are you sure you want to delete checklist template "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/checklist_templates/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchChecklistTemplates()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete checklist.'))
    }
  } catch (e) {
    console.error('Failed to delete checklist template:', e)
  }
}

const toggleActiveState = async (tmpl: ChecklistTemplateItem) => {
  try {
    const res = await fetch(`/api/v1/checklist_templates/${tmpl.id}`, {
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
      fetchChecklistTemplates()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

onMounted(() => {
  fetchChecklistTemplates()
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
            {{ __('Checklists') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewChecklist"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New Checklist') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for checklists')"
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
          <tbody v-else-if="filteredChecklistTemplates.length === 0">
            <tr>
              <td colspan="3" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="check2-square" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No checklists found') }}</h3>
                <p class="text-xs">{{ __('No checklists matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="tmpl in filteredChecklistTemplates"
              :key="tmpl.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditChecklist(tmpl)"
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
                      @click="handleEditChecklist(tmpl)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteChecklistTemplate(tmpl.id, tmpl.name)"
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
              <CommonIcon name="check2-square" class="w-5 h-5" />
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
            {{ __('With checklist templates it is possible to pre-fill new checklists with initial items.') }}
          </div>

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="250"
              :placeholder="__('Name of the checklist')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Items -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Items') }}
            </label>
            <div class="space-y-2">
              <div
                v-for="(_, idx) in formState.items"
                :key="idx"
                draggable="true"
                @dragstart="handleDragStart(idx, $event)"
                @dragover="handleDragOver($event)"
                @drop="handleDrop(idx, $event)"
                class="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all"
                :class="{ 'opacity-50 border-dashed border-blue-400': draggedItemIndex === idx }"
              >
                <!-- Drag Grip Handle -->
                <div class="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </div>
                <!-- Up / Down buttons -->
                <div class="flex flex-col gap-0.5">
                  <button
                    type="button"
                    @click="moveItem(idx, 'up')"
                    :disabled="idx === 0"
                    class="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <CommonIcon name="chevron-up" class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    @click="moveItem(idx, 'down')"
                    :disabled="idx === formState.items.length - 1"
                    class="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <CommonIcon name="chevron-down" class="w-3 h-3" />
                  </button>
                </div>
                <input
                  v-model="formState.items[idx]"
                  type="text"
                  :placeholder="`Item ${idx + 1}`"
                  class="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  @click="removeItemRow(idx)"
                  class="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <CommonIcon name="trash3" class="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                @click="addItemRow"
                class="w-full mt-2 px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
              >
                <CommonIcon name="plus" class="w-3.5 h-3.5" />{{ __('Add Item') }}
              </button>
            </div>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Active') }} <span class="text-red-500">*</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the checklist template is active.') }}</p>
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
            @click="saveChecklistTemplate"
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
