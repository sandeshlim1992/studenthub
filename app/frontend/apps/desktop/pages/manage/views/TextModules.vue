<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface TextModuleItem {
  id: number
  name: string
  keywords: string
  content: string
  note?: string
  active: boolean
  group_ids?: number[]
  updated_at?: string
  created_at?: string
}

interface GroupItem {
  id: number
  name: string
}

const router = useRouter()
const textModules = ref<TextModuleItem[]>([])
const groupsList = ref<GroupItem[]>([])
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
  keywords: '',
  content: '',
  note: '',
  active: true,
  group_ids: [] as number[],
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Text Modules') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

// Map group_ids to group names
const getGroupNames = (groupIds?: number[]) => {
  if (!groupIds || groupIds.length === 0) return []
  return groupIds
    .map((id) => groupsList.value.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

const contentTextarea = ref<HTMLTextAreaElement | null>(null)

// Insert placeholder helper into content field (at cursor position or appended)
const insertPlaceholder = (placeholder: string) => {
  const el = contentTextarea.value
  if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd
    const current = formState.value.content || ''
    formState.value.content = current.substring(0, start) + placeholder + current.substring(end)
    setTimeout(() => {
      el.focus()
      const newPos = start + placeholder.length
      el.setSelectionRange(newPos, newPos)
    }, 0)
  } else {
    formState.value.content = (formState.value.content || '') + placeholder
  }
}

// Fetch Text Modules
const fetchTextModules = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/text_modules', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        textModules.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage text modules.')
    } else {
      errorText.value = `Failed to load text modules (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch text modules:', e)
    errorText.value = __('Error fetching text modules. Please try again.')
  } finally {
    isLoading.value = false
  }
}

// Fetch groups list
const fetchGroups = async () => {
  try {
    const res = await fetch('/api/v1/groups', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      groupsList.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to fetch groups:', e)
  }
}

const filteredTextModules = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return textModules.value
  return textModules.value.filter(
    (tm) =>
      tm.name.toLowerCase().includes(query) ||
      (tm.keywords && tm.keywords.toLowerCase().includes(query)) ||
      (tm.content && tm.content.toLowerCase().includes(query))
  )
})

const handleNewTextModule = () => {
  formState.value = defaultFormState()
  drawerTitle.value = __('New Text Module')
  showDrawer.value = true
}

const htmlToPlainText = (html: string) => {
  if (!html) return ''
  // Convert line breaks and paragraph ends to newlines
  const withNewlines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
  // Strip remaining HTML tags
  const doc = new DOMParser().parseFromString(withNewlines, 'text/html')
  return doc.body.textContent || ''
}

const handleEditTextModule = (tm: TextModuleItem) => {
  formState.value = {
    id: tm.id,
    name: tm.name || '',
    keywords: tm.keywords || '',
    content: htmlToPlainText(tm.content || ''),
    note: htmlToPlainText(tm.note || ''),
    active: tm.active !== false,
    group_ids: tm.group_ids ? [...tm.group_ids] : [],
  }
  drawerTitle.value = __('Edit Text Module')
  showDrawer.value = true
}

const saveTextModule = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }
  if (!formState.value.content.trim()) {
    alert(__('Content is required.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      keywords: formState.value.keywords,
      content: formState.value.content,
      note: formState.value.note,
      active: formState.value.active,
      group_ids: formState.value.group_ids,
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/text_modules/${formState.value.id}` : '/api/v1/text_modules'
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
      fetchTextModules()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save text module.'))
    }
  } catch (e) {
    console.error('Failed to save text module:', e)
  } finally {
    submitting.value = false
  }
}

const handleCloneTextModule = (tm: TextModuleItem) => {
  closeActionMenu()
  formState.value = {
    id: null,
    name: `${__('Clone')}: ${tm.name}`,
    keywords: tm.keywords || '',
    content: htmlToPlainText(tm.content || ''),
    note: htmlToPlainText(tm.note || ''),
    active: tm.active !== false,
    group_ids: tm.group_ids ? [...tm.group_ids] : [],
  }
  drawerTitle.value = __('New Text Module')
  showDrawer.value = true
}

const handleDeleteTextModule = async (id: number, name: string) => {
  closeActionMenu()
  if (!confirm(__('Are you sure you want to delete text module "%s"?').replace('%s', name))) return
  try {
    const res = await fetch(`/api/v1/text_modules/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchTextModules()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete text module.'))
    }
  } catch (e) {
    console.error('Failed to delete text module:', e)
  }
}

// CSV Import state
const showImportModal = ref(false)
const importStage = ref<'input' | 'preview' | 'complete'>('input')
const importContent = ref('')
const importFile = ref<File | null>(null)
const importColSep = ref(',')
const importDeleteOption = ref(false)
const importLoading = ref(false)
const importError = ref('')
const importResult = ref<{
  result?: string
  stats?: {
    created?: number
    updated?: number
    deleted?: number
    total?: number
  }
} | null>(null)

const openImportModal = () => {
  showImportModal.value = true
  importStage.value = 'input'
  importContent.value = ''
  importFile.value = null
  importResult.value = null
  importError.value = ''
  importDeleteOption.value = false
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    importFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      importContent.value = (e.target?.result as string) || ''
    }
    reader.readAsText(file)
  }
}

const downloadExampleCsv = () => {
  window.location.href = '/api/v1/text_modules/import_example'
}

const runImport = async (dryRun: boolean) => {
  if (!importContent.value.trim()) {
    importError.value = __('Please select a file or paste CSV data.')
    return
  }
  importLoading.value = true
  importError.value = ''

  try {
    const formData = new FormData()
    formData.append('data', importContent.value)
    formData.append('col_sep', importColSep.value)
    if (dryRun) {
      formData.append('try', 'true')
    }
    if (importDeleteOption.value) {
      formData.append('delete', 'true')
    }

    const res = await fetch(`/api/v1/text_modules/import${dryRun ? '?try=true' : ''}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: formData,
    })

    const data = await res.json()
    if (res.ok) {
      importResult.value = data
      if (dryRun) {
        importStage.value = 'preview'
      } else {
        importStage.value = 'complete'
        fetchTextModules()
      }
    } else {
      importError.value = data.error_human || data.error || data.message || __('Failed to import CSV data.')
    }
  } catch (e) {
    console.error('CSV import error:', e)
    importError.value = __('An error occurred during import.')
  } finally {
    importLoading.value = false
  }
}

const toggleActiveState = async (tm: TextModuleItem) => {
  try {
    const res = await fetch(`/api/v1/text_modules/${tm.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !tm.active }),
    })
    if (res.ok) {
      fetchTextModules()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

onMounted(() => {
  fetchTextModules()
  fetchGroups()
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
            {{ __('Text Modules') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-2.5">
          <button
            @click="openImportModal"
            class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <CommonIcon name="upload" class="w-4 h-4 text-slate-500" />
            <span>{{ __('Import') }}</span>
          </button>
          <button
            @click="handleNewTextModule"
            class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            {{ __('New Text Module') }}
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for text modules')"
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
              <th class="py-4 px-6">{{ __('Keywords') }}</th>
              <th class="py-4 px-6">{{ __('Content Snippet') }}</th>
              <th class="py-4 px-6">{{ __('Groups') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="6" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredTextModules.length === 0">
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="text-modules" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No text modules found') }}</h3>
                <p class="text-xs">{{ __('No text modules matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="tm in filteredTextModules"
              :key="tm.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditTextModule(tm)"
            >
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ tm.name }}
              </td>
              <!-- Keywords -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                {{ tm.keywords || '-' }}
              </td>
              <!-- Content Snippet -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                {{ tm.content ? tm.content.replace(/<[^>]*>/g, '') : '-' }}
              </td>
              <!-- Groups -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400">
                <span v-if="tm.group_ids && tm.group_ids.length > 0" class="flex flex-wrap gap-1">
                  <span
                    v-for="name in getGroupNames(tm.group_ids)"
                    :key="name"
                    class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs"
                  >
                    {{ name }}
                  </span>
                </span>
                <span v-else class="text-xs italic text-slate-400">{{ __('All Groups') }}</span>
              </td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(tm)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="tm.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(tm.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === tm.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="handleEditTextModule(tm)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <button
                      @click="handleCloneTextModule(tm)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteTextModule(tm.id, tm.name)"
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
              <CommonIcon name="text-modules" class="w-5 h-5" />
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
          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="100"
              :placeholder="__('Name of the text module')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Keywords -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Keywords') }}
            </label>
            <input
              v-model="formState.keywords"
              type="text"
              maxlength="100"
              :placeholder="__('Keywords for fast search (e.g. greeting, signature)')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Content -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Content') }} <span class="text-red-500">*</span>
            </label>

            <!-- Insert Variable Bar -->
            <div class="flex items-center gap-2 mb-2 flex-wrap bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <span class="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">{{ __('Insert Variable:') }}</span>
              <button
                type="button"
                @click="insertPlaceholder('#{ticket.customer.firstname}')"
                class="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-all shadow-2xs"
                title="Insert #{ticket.customer.firstname}"
              >
                #{ticket.customer.firstname}
              </button>
              <button
                type="button"
                @click="insertPlaceholder('#{ticket.customer.lastname}')"
                class="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-all shadow-2xs"
                title="Insert #{ticket.customer.lastname}"
              >
                #{ticket.customer.lastname}
              </button>
              <button
                type="button"
                @click="insertPlaceholder('#{user.firstname}')"
                class="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-all shadow-2xs"
                title="Insert #{user.firstname}"
              >
                #{user.firstname}
              </button>
              <button
                type="button"
                @click="insertPlaceholder('#{ticket.number}')"
                class="px-2.5 py-1 text-xs font-mono bg-white dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-600 rounded-lg cursor-pointer transition-all shadow-2xs"
                title="Insert #{ticket.number}"
              >
                #{ticket.number}
              </button>
            </div>

            <textarea
              ref="contentTextarea"
              v-model="formState.content"
              rows="12"
              maxlength="2000"
              :placeholder="__('Text module content snippet... Use #{ticket.customer.firstname} for dynamic variables.')"
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-sans text-sm leading-relaxed min-h-[260px]"
            ></textarea>
            <p class="text-[11px] text-slate-400 mt-1.5">
              {{ __('To select placeholders from a list in replies, enter "::".') }}
            </p>
          </div>

          <!-- Note -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Note') }}
            </label>
            <textarea
              v-model="formState.note"
              rows="2"
              maxlength="250"
              :placeholder="__('Internal note about when to use this text module')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
            ></textarea>
          </div>

          <!-- Groups -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Groups') }}
            </label>
            <p class="text-xs text-slate-400 mb-2">
              {{ __('Restrict availability to specific groups. Leave empty to allow for all groups.') }}
            </p>
            <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label
                v-for="group in groupsList"
                :key="group.id"
                class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border rounded-lg text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                :class="formState.group_ids.includes(group.id) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'"
              >
                <input
                  type="checkbox"
                  :value="group.id"
                  v-model="formState.group_ids"
                  class="rounded text-blue-600"
                />
                <span class="font-medium text-slate-700 dark:text-slate-200">{{ group.name }}</span>
              </label>
            </div>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Active') }} <span class="text-red-500">*</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the text module is active for use in ticket replies.') }}</p>
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
            @click="saveTextModule"
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

  <!-- CSV Import Wizard Modal -->
  <Teleport to="body">
    <div
      v-if="showImportModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
      @click.self="showImportModal = false"
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-8"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="upload" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">{{ __('Import Text Modules via CSV') }}</h3>
              <p class="text-xs text-slate-400 dark:text-slate-500">
                <span v-if="importStage === 'input'">{{ __('Step 1: Upload CSV or paste data') }}</span>
                <span v-else-if="importStage === 'preview'">{{ __('Step 2: Review test results') }}</span>
                <span v-else>{{ __('Step 3: Import complete') }}</span>
              </p>
            </div>
          </div>
          <button
            @click="showImportModal = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body: Stage 1 - Input Data -->
        <div v-if="importStage === 'input'" class="p-6 space-y-5 text-left">
          <!-- Download Example File Link -->
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <div class="text-xs text-slate-600 dark:text-slate-300">
              {{ __('Need a reference template format?') }}
            </div>
            <button
              @click="downloadExampleCsv"
              class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <CommonIcon name="download" class="w-3.5 h-3.5" />
              <span>{{ __('Download sample CSV') }}</span>
            </button>
          </div>

          <!-- File Upload Zone -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {{ __('CSV File') }}
            </label>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              @change="handleFileUpload"
              class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/40 dark:file:text-blue-300 file:cursor-pointer"
            />
          </div>

          <!-- Paste Raw CSV Text -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {{ __('Or paste raw CSV text') }}
            </label>
            <textarea
              v-model="importContent"
              rows="6"
              :placeholder="__('name,keywords,content\nGreeting,hello,Hello #{ticket.customer.firstname}!\nClosing,bye,Best regards,\nYour Support Team')"
              class="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-blue-500 text-slate-800 dark:text-slate-200"
            ></textarea>
          </div>

          <!-- Options -->
          <div class="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {{ __('Column Separator') }}
              </label>
              <select
                v-model="importColSep"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              >
                <option value=",">{{ __('Comma (,)') }}</option>
                <option value=";">{{ __('Semicolon (;)') }}</option>
                <option value="&#9;">{{ __('Tab') }}</option>
              </select>
            </div>
            <div class="flex items-center gap-2 pt-6">
              <input
                v-model="importDeleteOption"
                type="checkbox"
                id="tm-import-delete"
                class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
              />
              <label for="tm-import-delete" class="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                {{ __('Delete missing records') }}
              </label>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="importError" class="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
            {{ importError }}
          </div>
        </div>

        <!-- Modal Body: Stage 2 - Dry Run Preview Results -->
        <div v-else-if="importStage === 'preview'" class="p-6 overflow-y-auto space-y-5 text-left">
          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
            <div class="font-semibold text-sm mb-1">{{ __('The test run was successful!') }}</div>
            <p>{{ __('Review the estimated record modifications before proceeding with permanent changes.') }}</p>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-slate-900 dark:text-white">{{ importResult?.stats?.total ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Total') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-green-600">{{ importResult?.stats?.created ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Create') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-blue-600">{{ importResult?.stats?.updated ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Update') }}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-2xl font-bold text-red-600">{{ importResult?.stats?.deleted ?? 0 }}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider mt-1">{{ __('Delete') }}</div>
            </div>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ __('Do you really want to import this data permanently into the database?') }}
          </p>
        </div>

        <!-- Modal Body: Stage 3 - Complete Summary -->
        <div v-else-if="importStage === 'complete'" class="p-6 overflow-y-auto space-y-5 text-center">
          <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CommonIcon name="check2" class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-900 dark:text-white">{{ __('Import Completed Successfully') }}</h4>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {{ __('The text module records have been synchronized.') }}
            </p>
          </div>

          <div class="grid grid-cols-4 gap-4 max-w-lg mx-auto">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-slate-900 dark:text-white">{{ importResult?.stats?.total ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Total') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-green-600">{{ importResult?.stats?.created ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Created') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-blue-600">{{ importResult?.stats?.updated ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Updated') }}</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
              <div class="text-xl font-bold text-red-600">{{ importResult?.stats?.deleted ?? 0 }}</div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{{ __('Deleted') }}</div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50">
          <template v-if="importStage === 'input'">
            <button
              @click="showImportModal = false"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {{ __('Cancel') }}
            </button>
            <button
              @click="runImport(true)"
              :disabled="importLoading"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CommonIcon v-if="importLoading" name="loading" class="w-4 h-4 animate-spin" />
              <span>{{ importLoading ? __('Testing Import...') : __('Start Test Import') }}</span>
            </button>
          </template>

          <template v-else-if="importStage === 'preview'">
            <button
              @click="importStage = 'input'"
              class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            >
              {{ __('Back') }}
            </button>
            <button
              @click="runImport(false)"
              :disabled="importLoading"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CommonIcon v-if="importLoading" name="loading" class="w-4 h-4 animate-spin" />
              <span>{{ importLoading ? __('Importing...') : __('Yes, start real import') }}</span>
            </button>
          </template>

          <template v-else-if="importStage === 'complete'">
            <button
              @click="showImportModal = false"
              class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs cursor-pointer"
            >
              {{ __('Done') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
