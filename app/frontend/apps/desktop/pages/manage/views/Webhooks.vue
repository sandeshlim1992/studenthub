<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface WebhookItem {
  id: number
  name: string
  endpoint: string
  http_method: string
  ssl_verify?: boolean
  auth_type?: string | null
  basic_auth_username?: string
  basic_auth_password?: string
  bearer_token?: string
  signature_token?: string
  customized_payload?: boolean
  custom_payload?: string
  note?: string
  active: boolean
  updated_at?: string
  created_at?: string
}

const router = useRouter()
const webhooks = ref<WebhookItem[]>([])
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
  endpoint: '',
  http_method: 'post',
  ssl_verify: true,
  auth_type: '' as string | null,
  basic_auth_username: '',
  basic_auth_password: '',
  bearer_token: '',
  signature_token: '',
  customized_payload: false,
  custom_payload: '',
  note: '',
  active: true,
})

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Webhooks') },
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

const fetchWebhooks = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/webhooks', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        webhooks.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage webhooks.')
    } else {
      errorText.value = `Failed to load webhooks (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch webhooks:', e)
    errorText.value = __('Error fetching webhooks. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const filteredWebhooks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return webhooks.value
  return webhooks.value.filter(
    (w) =>
      w.name.toLowerCase().includes(query) ||
      (w.endpoint && w.endpoint.toLowerCase().includes(query))
  )
})

const handleNewWebhook = () => {
  formState.value = defaultFormState()
  drawerTitle.value = __('New Webhook')
  showDrawer.value = true
}

const handleEditWebhook = (wh: WebhookItem) => {
  formState.value = {
    id: wh.id,
    name: wh.name || '',
    endpoint: wh.endpoint || '',
    http_method: (wh.http_method || 'post').toLowerCase(),
    ssl_verify: wh.ssl_verify !== false,
    auth_type: wh.auth_type || '',
    basic_auth_username: wh.basic_auth_username || '',
    basic_auth_password: wh.basic_auth_password || '',
    bearer_token: wh.bearer_token || '',
    signature_token: wh.signature_token || '',
    customized_payload: Boolean(wh.customized_payload),
    custom_payload: wh.custom_payload || '',
    note: htmlToPlainText(wh.note || ''),
    active: wh.active !== false,
  }
  drawerTitle.value = __('Edit Webhook')
  showDrawer.value = true
}

const saveWebhook = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }
  if (!formState.value.endpoint.trim()) {
    alert(__('Endpoint URL is required.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      endpoint: formState.value.endpoint,
      http_method: formState.value.http_method,
      ssl_verify: formState.value.ssl_verify,
      auth_type: formState.value.auth_type || null,
      basic_auth_username: formState.value.auth_type === 'basic_auth' ? formState.value.basic_auth_username : null,
      basic_auth_password: formState.value.auth_type === 'basic_auth' ? formState.value.basic_auth_password : null,
      bearer_token: formState.value.auth_type === 'bearer_token' ? formState.value.bearer_token : null,
      signature_token: formState.value.signature_token || null,
      customized_payload: formState.value.customized_payload,
      custom_payload: formState.value.customized_payload ? formState.value.custom_payload : null,
      note: formState.value.note,
      active: formState.value.active,
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/webhooks/${formState.value.id}` : '/api/v1/webhooks'
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
      fetchWebhooks()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save webhook.'))
    }
  } catch (e) {
    console.error('Failed to save webhook:', e)
  } finally {
    submitting.value = false
  }
}

const handleCloneWebhook = (wh: WebhookItem) => {
  formState.value = {
    id: null,
    name: __('%s (Copy)', wh.name || __('Webhook')),
    endpoint: wh.endpoint || '',
    http_method: (wh.http_method || 'post').toLowerCase(),
    ssl_verify: wh.ssl_verify !== false,
    auth_type: wh.auth_type || '',
    basic_auth_username: wh.basic_auth_username || '',
    basic_auth_password: wh.basic_auth_password || '',
    bearer_token: wh.bearer_token || '',
    signature_token: wh.signature_token || '',
    customized_payload: Boolean(wh.customized_payload),
    custom_payload: wh.custom_payload || '',
    note: htmlToPlainText(wh.note || ''),
    active: wh.active !== false,
  }
  drawerTitle.value = __('Clone Webhook')
  showDrawer.value = true
}

// Example Payload modal
const showPayloadModal = ref(false)
const payloadPreviewData = ref('')
const payloadLoading = ref(false)
const copiedPayload = ref(false)

const openPayloadModal = async () => {
  showPayloadModal.value = true
  payloadLoading.value = true
  try {
    const res = await fetch('/api/v1/webhooks/preview', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const data = await res.json()
      payloadPreviewData.value = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    } else {
      payloadPreviewData.value = JSON.stringify({ error: 'Failed to load preview payload' }, null, 2)
    }
  } catch (e) {
    console.error('Failed to load payload preview:', e)
  } finally {
    payloadLoading.value = false
  }
}

const copyPayloadToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(payloadPreviewData.value)
    copiedPayload.value = true
    setTimeout(() => { copiedPayload.value = false }, 2000)
  } catch (e) {
    console.error(e)
  }
}

// Pre-defined Webhooks modal
interface PredefinedDefinition {
  name: string
  endpoint?: string
  note?: string
  custom_payload?: string | Record<string, unknown>
  customized_payload?: boolean
}

const showPredefinedModal = ref(false)
const predefinedWebhooks = ref<PredefinedDefinition[]>([])
const predefinedLoading = ref(false)

const openPredefinedModal = async () => {
  showPredefinedModal.value = true
  predefinedLoading.value = true
  try {
    const res = await fetch('/api/v1/webhooks/pre_defined', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const data = await res.json()
      predefinedWebhooks.value = Array.isArray(data) ? data : Object.values(data)
    }
  } catch (e) {
    console.error('Failed to load predefined webhooks:', e)
  } finally {
    predefinedLoading.value = false
  }
}

const selectPredefinedWebhook = (pre: PredefinedDefinition) => {
  formState.value = defaultFormState()
  formState.value.name = pre.name
  formState.value.endpoint = pre.endpoint || ''
  formState.value.note = pre.note || ''
  if (pre.custom_payload) {
    formState.value.customized_payload = true
    formState.value.custom_payload = typeof pre.custom_payload === 'string' ? pre.custom_payload : JSON.stringify(pre.custom_payload, null, 2)
  }
  showPredefinedModal.value = false
  drawerTitle.value = __('%s (Pre-defined)', pre.name)
  showDrawer.value = true
}

const handleDeleteWebhook = async (id: number, name: string) => {
  if (!confirm(__('Are you sure you want to delete webhook "%s"?', name))) return
  try {
    const res = await fetch(`/api/v1/webhooks/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchWebhooks()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete webhook.'))
    }
  } catch (e) {
    console.error('Failed to delete webhook:', e)
  }
}

const toggleActiveState = async (wh: WebhookItem) => {
  try {
    const res = await fetch(`/api/v1/webhooks/${wh.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ active: !wh.active }),
    })
    if (res.ok) {
      fetchWebhooks()
    }
  } catch (e) {
    console.error('Failed to update active state:', e)
  }
}

onMounted(() => {
  fetchWebhooks()
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
            {{ __('Webhooks') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="openPayloadModal"
            class="px-3.5 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CommonIcon name="code-slash" class="w-4 h-4 text-slate-400" />
            {{ __('Example Payload') }}
          </button>
          <button
            @click="openPredefinedModal"
            class="px-3.5 py-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CommonIcon name="lightning" class="w-4 h-4" />
            {{ __('Pre-defined Webhook') }}
          </button>
          <button
            @click="handleNewWebhook"
            class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            {{ __('New Webhook') }}
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for webhooks')"
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
              <th class="py-4 px-6">{{ __('Method') }}</th>
              <th class="py-4 px-6">{{ __('Endpoint') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Active') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-64"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="5" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredWebhooks.length === 0">
            <tr>
              <td colspan="5" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="globe" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No webhooks found') }}</h3>
                <p class="text-xs">{{ __('No webhooks matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="wh in filteredWebhooks"
              :key="wh.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditWebhook(wh)"
            >
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ wh.name }}
              </td>
              <!-- Method -->
              <td class="py-4 px-6 text-xs font-mono font-semibold uppercase">
                <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {{ wh.http_method }}
                </span>
              </td>
              <!-- Endpoint -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs max-w-sm truncate">
                {{ wh.endpoint }}
              </td>
              <!-- Active -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleActiveState(wh)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="wh.active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(wh.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === wh.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="() => { closeActionMenu(); handleEditWebhook(wh) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <button
                      @click="() => { closeActionMenu(); handleCloneWebhook(wh) }"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="copy" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Clone') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="() => { closeActionMenu(); handleDeleteWebhook(wh.id, wh.name) }"
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
              <CommonIcon name="globe" class="w-5 h-5" />
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
            {{ __('Webhooks make it easy to send information about events within Student Hub to third-party systems via HTTP(S).') }}
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
              :placeholder="__('Name of the webhook')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Endpoint & Method -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                {{ __('Endpoint') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formState.endpoint"
                type="url"
                maxlength="2000"
                placeholder="https://target.example.com/webhook"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                {{ __('Method') }}
              </label>
              <select
                v-model="formState.http_method"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 uppercase font-mono text-xs"
              >
                <option value="post">POST</option>
                <option value="put">PUT</option>
                <option value="patch">PATCH</option>
                <option value="delete">DELETE</option>
              </select>
            </div>
          </div>

          <!-- SSL Verify -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('SSL verification') }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Verify target server SSL certificate.') }}</p>
            </div>
            <button
              @click="formState.ssl_verify = !formState.ssl_verify"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="formState.ssl_verify ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="formState.ssl_verify ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>

          <!-- Authentication -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Authentication') }}
            </label>
            <select
              v-model="formState.auth_type"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">{{ __('None') }}</option>
              <option value="basic_auth">{{ __('HTTP Basic Authentication') }}</option>
              <option value="bearer_token">{{ __('Bearer Token') }}</option>
            </select>
          </div>

          <!-- Basic Auth credentials -->
          <div v-if="formState.auth_type === 'basic_auth'" class="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{{ __('Username') }}</label>
              <input
                v-model="formState.basic_auth_username"
                type="text"
                maxlength="250"
                class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{{ __('Password') }}</label>
              <input
                v-model="formState.basic_auth_password"
                type="password"
                maxlength="250"
                class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <!-- Bearer token -->
          <div v-else-if="formState.auth_type === 'bearer_token'" class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{{ __('Bearer Token') }}</label>
            <input
              v-model="formState.bearer_token"
              type="password"
              maxlength="250"
              class="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <!-- Signature Token -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('HMAC SHA1 Signature Token') }}
            </label>
            <input
              v-model="formState.signature_token"
              type="password"
              maxlength="200"
              :placeholder="__('Secret signature token for payload verification (optional)')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <!-- Custom Payload -->
          <div class="space-y-3">
            <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {{ __('Custom Payload') }}
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">{{ __('Customize JSON body sent to endpoint.') }}</p>
              </div>
              <button
                @click="formState.customized_payload = !formState.customized_payload"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                :class="formState.customized_payload ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                  :class="formState.customized_payload ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>

            <div v-if="formState.customized_payload">
              <textarea
                v-model="formState.custom_payload"
                rows="6"
                placeholder='{\n  "event": "ticket_update",\n  "ticket_id": "#{ticket.id}"\n}'
                class="w-full px-3.5 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 leading-relaxed"
              ></textarea>
            </div>
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
              :placeholder="__('Internal note about this webhook')"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            ></textarea>
          </div>

          <!-- Active -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Active') }} <span class="text-red-500">*</span>
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Determine if the webhook is active for outbound requests.') }}</p>
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
            @click="saveWebhook"
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

  <!-- Example Payload Modal -->
  <Teleport to="body">
    <div
      v-if="showPayloadModal"
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click="showPayloadModal = false"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        @click.stop
      >
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="code-slash" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Example Payload') }}</h3>
              <p class="text-xs text-slate-500">{{ __('Live sample payload dispatched on ticket/article webhook triggers.') }}</p>
            </div>
          </div>
          <button
            @click="showPayloadModal = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 bg-slate-950 text-slate-200 font-mono text-xs relative">
          <div v-if="payloadLoading" class="py-12 flex items-center justify-center gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-slate-400 text-xs">{{ __('Generating sample payload...') }}</span>
          </div>
          <pre v-else class="whitespace-pre-wrap break-all">{{ payloadPreviewData }}</pre>
        </div>

        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            @click="copyPayloadToClipboard"
            :disabled="payloadLoading"
            class="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CommonIcon :name="copiedPayload ? 'check2' : 'copy'" class="w-3.5 h-3.5" />
            {{ copiedPayload ? __('Copied!') : __('Copy JSON') }}
          </button>
          <button
            @click="showPayloadModal = false"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            {{ __('Close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Pre-defined Webhook Modal -->
  <Teleport to="body">
    <div
      v-if="showPredefinedModal"
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click="showPredefinedModal = false"
    >
      <div
        class="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        @click.stop
      >
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <CommonIcon name="lightning" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Pre-defined Webhooks') }}</h3>
              <p class="text-xs text-slate-500">{{ __('Select a template to auto-populate webhook configurations.') }}</p>
            </div>
          </div>
          <button
            @click="showPredefinedModal = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 space-y-3">
          <div v-if="predefinedLoading" class="py-12 flex items-center justify-center gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-slate-400 text-xs">{{ __('Loading templates...') }}</span>
          </div>
          <div
            v-else
            v-for="(pre, pIdx) in predefinedWebhooks"
            :key="pIdx"
            @click="selectPredefinedWebhook(pre)"
            class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex items-center justify-between"
          >
            <div>
              <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ pre.name }}</h4>
              <p v-if="pre.note" class="text-xs text-slate-500 mt-0.5">{{ pre.note }}</p>
            </div>
            <CommonIcon name="chevron-right" class="w-4 h-4 text-slate-400 shrink-0 ml-3" />
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            @click="showPredefinedModal = false"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            {{ __('Cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
