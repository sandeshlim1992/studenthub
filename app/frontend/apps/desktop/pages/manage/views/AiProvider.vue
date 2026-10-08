<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  title?: string
  description?: string
  state_current?: {
    value?: unknown
  }
}

interface ProviderDefinition {
  key: string
  label: string
  icon: string
  brandColor: string
  brandBg: string
  badgeLabel?: string
  defaultModel?: string
  urlPlaceholder?: string
  fields: string[]
  required: string[]
  description: string
}

interface ProviderConfigState {
  provider: string
  token?: string
  model?: string
  url?: string
  url_completions?: string
  url_embeddings?: string
  ocr_active?: boolean
  ocr_model?: string
  url_ocr?: string
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('AI') },
  { label: __('Provider') },
]

const getCsrf = () =>
  (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''

const isLoading = ref(true)
const isSavingMaster = ref(false)
const isSavingConfig = ref(false)
const isDownloadingFeedback = ref(false)
const isDownloadingErrors = ref(false)

const activeTab = ref<'settings' | 'logs'>('settings')
const showToken = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const allSettings = ref<Record<string, SettingRecord>>({})
const providerActive = ref(false)

const formState = ref<ProviderConfigState>({
  provider: 'open_ai',
  token: '',
  model: 'gpt-4.1',
  url: '',
  url_completions: '',
  ocr_active: false,
  ocr_model: '',
  url_ocr: '',
})

const providers = computed<ProviderDefinition[]>(() => [
  {
    key: 'zammad_ai',
    label: __('Zammad AI'),
    icon: 'zammad-ai',
    brandColor: 'text-purple-600 dark:text-purple-400',
    brandBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    badgeLabel: __('Managed'),
    fields: ['token', 'ocr_active'],
    required: ['token'],
    description: __('Official managed AI service provided directly by Zammad Foundation.'),
  },
  {
    key: 'open_ai',
    label: __('OpenAI'),
    icon: 'openai',
    brandColor: 'text-emerald-600 dark:text-emerald-400',
    brandBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    badgeLabel: __('Cloud API'),
    defaultModel: 'gpt-4.1',
    fields: ['token', 'model', 'ocr_active', 'ocr_model'],
    required: ['token'],
    description: __('Connect to OpenAI models such as GPT-4o and o-series via API key.'),
  },
  {
    key: 'anthropic',
    label: __('Anthropic'),
    icon: 'anthropic',
    brandColor: 'text-amber-700 dark:text-amber-400',
    brandBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    badgeLabel: __('Claude Models'),
    defaultModel: 'claude-sonnet-4-6',
    fields: ['token', 'model', 'ocr_active', 'ocr_model'],
    required: ['token'],
    description: __('Connect to Anthropic Claude 3.5 and 3.7 models via API key.'),
  },
  {
    key: 'ollama',
    label: __('Ollama'),
    icon: 'ollama',
    brandColor: 'text-slate-800 dark:text-slate-200',
    brandBg: 'bg-slate-200 dark:bg-slate-700',
    badgeLabel: __('Self-Hosted'),
    defaultModel: 'mistral-small3.2',
    urlPlaceholder: 'http://localhost:11434',
    fields: ['url', 'model', 'ocr_active', 'ocr_model'],
    required: ['url'],
    description: __('Self-hosted local AI inference server running open-weight LLMs.'),
  },
  {
    key: 'mistral',
    label: __('Mistral AI'),
    icon: 'mistral',
    brandColor: 'text-orange-600 dark:text-orange-400',
    brandBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    badgeLabel: __('European AI'),
    defaultModel: 'mistral-large-2512',
    fields: ['token', 'model', 'ocr_active', 'ocr_model'],
    required: ['token'],
    description: __('European enterprise open-weight and frontier AI models via Mistral API.'),
  },
  {
    key: 'azure',
    label: __('Azure AI'),
    icon: 'azure',
    brandColor: 'text-sky-600 dark:text-sky-400',
    brandBg: 'bg-sky-500/10 dark:bg-sky-500/20',
    badgeLabel: __('Enterprise Cloud'),
    fields: ['token', 'url_completions', 'ocr_active', 'url_ocr'],
    required: ['token', 'url_completions'],
    description: __('Microsoft Azure OpenAI and AI Studio deployment-based endpoints.'),
  },
  {
    key: 'custom_open_ai',
    label: __('Custom (OpenAI Compatible)'),
    icon: 'custom-ai',
    brandColor: 'text-violet-600 dark:text-violet-400',
    brandBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    badgeLabel: __('Gateway / vLLM'),
    urlPlaceholder: 'http://localhost:1234/v1',
    fields: ['url', 'token', 'model', 'ocr_active', 'ocr_model'],
    required: ['model', 'url'],
    description: __('Generic OpenAI-compatible API gateway (e.g. vLLM, LM Studio, LocalAI).'),
  },
])

const currentProviderDef = computed(() => {
  return providers.value.find((p) => p.key === formState.value.provider) || providers.value[1]
})

const showToast = (message: string, isError = false) => {
  if (isError) {
    errorMessage.value = message
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } else {
    successMessage.value = message
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  }
}

const fetchSettings = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/settings', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const list: SettingRecord[] = await res.json()
    const dict: Record<string, SettingRecord> = {}
    list.forEach((s) => {
      dict[s.name] = s
    })
    allSettings.value = dict

    providerActive.value = !!dict.ai_provider?.state_current?.value

    const savedConfig = dict.ai_provider_config?.state_current?.value as
      | ProviderConfigState
      | undefined
    if (savedConfig && typeof savedConfig === 'object') {
      formState.value = {
        provider: savedConfig.provider || 'open_ai',
        token: savedConfig.token || '',
        model: savedConfig.model || '',
        url: savedConfig.url || '',
        url_completions: savedConfig.url_completions || '',
        ocr_active: !!savedConfig.ocr_active,
        ocr_model: savedConfig.ocr_model || '',
        url_ocr: savedConfig.url_ocr || '',
      }
    }
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : __('Failed to load AI provider settings.'), true)
  } finally {
    isLoading.value = false
  }
}

const saveSettingRecord = async (name: string, value: unknown): Promise<boolean> => {
  const setting = allSettings.value[name]
  if (!setting) {
    showToast(__('Setting "%s" not found.', name), true)
    return false
  }

  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ state_current: { value } }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || __('Failed to update setting "%s".', name), true)
      return false
    }

    const updated: SettingRecord = await res.json()
    allSettings.value[name] = updated
    return true
  } catch {
    showToast(__('An error occurred while saving "%s".', name), true)
    return false
  }
}

const toggleProviderMaster = async () => {
  const nextVal = !providerActive.value
  isSavingMaster.value = true
  const success = await saveSettingRecord('ai_provider', nextVal)
  if (success) {
    providerActive.value = nextVal
    showToast(nextVal ? __('AI Provider has been enabled.') : __('AI Provider has been disabled.'))
  }
  isSavingMaster.value = false
}

const onSelectProvider = (key: string) => {
  formState.value.provider = key
  const def = providers.value.find((p) => p.key === key)
  if (def?.defaultModel && !formState.value.model) {
    formState.value.model = def.defaultModel
  }
}

const saveProviderConfig = async () => {
  isSavingConfig.value = true
  const def = currentProviderDef.value

  const payload: ProviderConfigState = {
    provider: formState.value.provider,
  }

  if (def.fields.includes('token') && formState.value.token) {
    payload.token = formState.value.token.trim()
  }
  if (def.fields.includes('model') && formState.value.model) {
    payload.model = formState.value.model.trim()
  }
  if (def.fields.includes('url') && formState.value.url) {
    payload.url = formState.value.url.trim()
  }
  if (def.fields.includes('url_completions') && formState.value.url_completions) {
    payload.url_completions = formState.value.url_completions.trim()
  }
  if (def.fields.includes('ocr_active')) {
    payload.ocr_active = !!formState.value.ocr_active
  }
  if (def.fields.includes('ocr_model') && formState.value.ocr_model) {
    payload.ocr_model = formState.value.ocr_model.trim()
  }
  if (def.fields.includes('url_ocr') && formState.value.url_ocr) {
    payload.url_ocr = formState.value.url_ocr.trim()
  }

  const success = await saveSettingRecord('ai_provider_config', payload)
  if (success) {
    showToast(__('AI provider configuration saved successfully.'))
  }
  isSavingConfig.value = false
}

const downloadAnalytics = async (type: 'with_usages' | 'errors') => {
  if (type === 'with_usages') {
    isDownloadingFeedback.value = true
  } else {
    isDownloadingErrors.value = true
  }

  try {
    const res = await fetch(`/api/v1/ai/analytics/download/${type}`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'with_usages' ? 'ai_analytics_feedback.xlsx' : 'ai_analytics_errors.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(__('Report download started.'))
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : __('Failed to download report.'), true)
  } finally {
    if (type === 'with_usages') {
      isDownloadingFeedback.value = false
    } else {
      isDownloadingErrors.value = false
    }
  }
}

onMounted(() => {
  void fetchSettings()
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Unboxed Open Header -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            class="mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-800"
            :aria-label="__('Back to Management Overview')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="size-4" />
          </button>
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400"
          >
            <CommonIcon name="magic" class="size-4" />
          </div>
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
                {{ __('AI Provider') }}
              </h1>
              <span
                class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
              >
                {{ __('AI Infrastructure') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Connect Student Hub with foundational AI model providers to power Ticket Summary, Writing Assistant, and AI Agents.',
                )
              }}
            </p>
          </div>
        </div>

        <!-- Master Switch -->
        <div
          class="flex items-center space-x-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-2xs rtl:space-x-reverse dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <span
            class="text-xs font-semibold"
            :class="
              providerActive
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-slate-500 dark:text-slate-400'
            "
          >
            {{ providerActive ? __('Provider Active') : __('Provider Inactive') }}
          </span>
          <button
            type="button"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50"
            :class="providerActive ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'"
            :disabled="isSavingMaster"
            :aria-label="__('Toggle AI Provider')"
            @click="toggleProviderMaster"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
              :class="
                providerActive
                  ? 'ltr:translate-x-4 rtl:-translate-x-4'
                  : 'ltr:translate-x-0 rtl:translate-x-0'
              "
            />
          </button>
        </div>
      </div>

      <!-- Feedback Alerts -->
      <div
        v-if="errorMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="exclamation-triangle"
            class="size-4 shrink-0 text-red-600 dark:text-red-400"
          />
          <span>{{ errorMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-red-700 hover:text-red-900 dark:text-red-300"
          :aria-label="__('Dismiss error')"
          @click="errorMessage = ''"
        >
          &times;
        </button>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="check2"
            class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span>{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-xs font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          :aria-label="__('Dismiss notification')"
          @click="successMessage = ''"
        >
          &times;
        </button>
      </div>

      <!-- Nav Tabs -->
      <div
        class="mb-6 flex space-x-2 border-b border-slate-200 rtl:space-x-reverse dark:border-slate-800"
      >
        <button
          type="button"
          class="cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors"
          :class="
            activeTab === 'settings'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          "
          @click="activeTab = 'settings'"
        >
          {{ __('Provider Configuration') }}
        </button>
        <button
          type="button"
          class="cursor-pointer border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors"
          :class="
            activeTab === 'logs'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          "
          @click="activeTab = 'logs'"
        >
          {{ __('Feedback & Analytics') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <CommonIcon name="loading" class="size-8 animate-spin text-purple-600" />
        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {{ __('Loading AI provider settings...') }}
        </p>
      </div>

      <!-- Tab 1: Settings Form -->
      <div v-else-if="activeTab === 'settings'" class="space-y-6">
        <!-- Provider Selector Grid -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Select AI Provider') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Choose the foundational model backend to handle all LLM requests.') }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="p in providers"
              :key="p.key"
              class="group flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all"
              :class="
                formState.provider === p.key
                  ? 'border-purple-600 bg-purple-50/40 shadow-xs ring-2 ring-purple-600/20 dark:border-purple-500 dark:bg-purple-950/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs dark:border-slate-700 dark:bg-[#1e293b] dark:hover:border-slate-600'
              "
              role="button"
              tabindex="0"
              @click="onSelectProvider(p.key)"
              @keydown.enter="onSelectProvider(p.key)"
              @keydown.space.prevent="onSelectProvider(p.key)"
            >
              <div>
                <div class="flex items-start justify-between">
                  <div class="flex items-center space-x-3 rtl:space-x-reverse">
                    <div
                      class="flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                      :class="p.brandBg"
                    >
                      <CommonIcon :name="p.icon" class="size-6" :class="p.brandColor" />
                    </div>
                    <div>
                      <span class="text-sm font-bold text-slate-900 dark:text-white">
                        {{ p.label }}
                      </span>
                      <span
                        v-if="p.badgeLabel"
                        class="block text-[10px] font-semibold text-slate-400 dark:text-slate-500"
                      >
                        {{ p.badgeLabel }}
                      </span>
                    </div>
                  </div>
                  <div
                    class="flex size-5 shrink-0 items-center justify-center rounded-full border transition-all"
                    :class="
                      formState.provider === p.key
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                    "
                  >
                    <CommonIcon
                      v-if="formState.provider === p.key"
                      name="check2"
                      class="size-3 text-white"
                    />
                  </div>
                </div>
                <p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {{ p.description }}
                </p>
              </div>

              <!-- Default Model Pill (if present) -->
              <div
                v-if="p.defaultModel"
                class="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800"
              >
                <span
                  class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span class="text-slate-400 ltr:mr-1 rtl:ml-1">{{ __('Default:') }}</span>
                  {{ p.defaultModel }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Provider Credentials & Parameters -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="mb-5 flex items-center space-x-3 border-b border-slate-100 pb-4 rtl:space-x-reverse dark:border-slate-800"
          >
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-xl"
              :class="currentProviderDef.brandBg"
            >
              <CommonIcon
                :name="currentProviderDef.icon"
                class="size-6"
                :class="currentProviderDef.brandColor"
              />
            </div>
            <div>
              <div class="flex items-center space-x-2 rtl:space-x-reverse">
                <h2 class="text-base font-bold text-slate-900 dark:text-white">
                  {{ currentProviderDef.label }} {{ __('Parameters') }}
                </h2>
                <span
                  v-if="currentProviderDef.badgeLabel"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  :class="[currentProviderDef.brandBg, currentProviderDef.brandColor]"
                >
                  {{ currentProviderDef.badgeLabel }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {{ __('Provide the credentials and endpoint URLs for the selected provider.') }}
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Token / API Key -->
            <div v-if="currentProviderDef.fields.includes('token')">
              <span class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {{ __('API Key / Token') }}
                <span v-if="currentProviderDef.required.includes('token')" class="text-red-500"
                  >*</span
                >
              </span>
              <div class="relative mt-1">
                <input
                  v-model="formState.token"
                  :type="showToken ? 'text' : 'password'"
                  autocomplete="new-password"
                  :aria-label="__('API Key or Token')"
                  class="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 pe-10 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  :placeholder="__('Enter your provider token or API key')"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  :aria-label="showToken ? __('Hide token') : __('Show token')"
                  @click="showToken = !showToken"
                >
                  <CommonIcon :name="showToken ? 'eye-slash' : 'eye'" class="size-4" />
                </button>
              </div>
            </div>

            <!-- Model -->
            <div v-if="currentProviderDef.fields.includes('model')">
              <span class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {{ __('Model Name') }}
                <span v-if="currentProviderDef.required.includes('model')" class="text-red-500"
                  >*</span
                >
              </span>
              <input
                v-model="formState.model"
                type="text"
                :aria-label="__('Model Name')"
                class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                :placeholder="currentProviderDef.defaultModel || __('e.g. gpt-4o')"
              />
              <p v-if="currentProviderDef.defaultModel" class="text-2xs mt-1 text-slate-400">
                {{ __('Default model:') }} {{ currentProviderDef.defaultModel }}
              </p>
            </div>

            <!-- Base URL (Ollama or Custom) -->
            <div v-if="currentProviderDef.fields.includes('url')">
              <span class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {{ __('Endpoint URL') }}
                <span v-if="currentProviderDef.required.includes('url')" class="text-red-500"
                  >*</span
                >
              </span>
              <input
                v-model="formState.url"
                type="text"
                :aria-label="__('Endpoint URL')"
                class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                :placeholder="currentProviderDef.urlPlaceholder || 'http://localhost:11434'"
              />
            </div>

            <!-- Azure Completions URL -->
            <div v-if="currentProviderDef.fields.includes('url_completions')">
              <span class="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {{ __('URL (Completions)') }}
                <span class="text-red-500">*</span>
              </span>
              <input
                v-model="formState.url_completions"
                type="text"
                :aria-label="__('Azure Completions URL')"
                class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                placeholder="https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview"
              />
            </div>

            <!-- OCR Text Recognition Switch -->
            <div
              v-if="currentProviderDef.fields.includes('ocr_active')"
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {{ __('Recognize Image Text (OCR)') }}
                  </span>
                  <p class="text-2xs text-slate-500 dark:text-slate-400">
                    {{
                      __(
                        'Automatically perform vision OCR analysis on image attachments in ticket articles.',
                      )
                    }}
                  </p>
                </div>
                <button
                  type="button"
                  class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                  :class="formState.ocr_active ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'"
                  :aria-label="__('Toggle OCR')"
                  @click="formState.ocr_active = !formState.ocr_active"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                    :class="
                      formState.ocr_active
                        ? 'ltr:translate-x-4 rtl:-translate-x-4'
                        : 'ltr:translate-x-0 rtl:translate-x-0'
                    "
                  />
                </button>
              </div>

              <!-- Dedicated OCR Model if active -->
              <div
                v-if="formState.ocr_active && currentProviderDef.fields.includes('ocr_model')"
                class="mt-3"
              >
                <span class="text-2xs block font-medium text-slate-600 dark:text-slate-400">
                  {{ __('Dedicated OCR Model (optional)') }}
                </span>
                <input
                  v-model="formState.ocr_model"
                  type="text"
                  :aria-label="__('Dedicated OCR Model')"
                  class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  :placeholder="__('Leave empty to use the base model')"
                />
              </div>
            </div>
          </div>

          <!-- Save Button -->
          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 focus:outline-hidden disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
              :disabled="isSavingConfig"
              :aria-label="__('Save Provider Settings')"
              @click="saveProviderConfig"
            >
              <CommonIcon
                v-if="isSavingConfig"
                name="loading"
                class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Save Settings') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 2: Feedback & Analytics -->
      <div v-else class="space-y-6">
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('AI Analytics & Audit Exports') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Download raw agent feedback ratings and inspect error logs from backend model executions.',
                )
              }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Card 1: Agent Feedback -->
            <div
              class="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <CommonIcon name="check2" class="size-4 text-purple-600 dark:text-purple-400" />
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('Agent Usage & Feedback') }}
                  </h3>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'Comprehensive spreadsheet of all prompt completions, tokens consumed, and agent thumbs-up/down ratings.',
                    )
                  }}
                </p>
              </div>
              <div class="mt-5">
                <button
                  type="button"
                  class="inline-flex cursor-pointer items-center rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 disabled:opacity-50"
                  :disabled="isDownloadingFeedback"
                  :aria-label="__('Download Feedback Report')"
                  @click="downloadAnalytics('with_usages')"
                >
                  <CommonIcon
                    v-if="isDownloadingFeedback"
                    name="loading"
                    class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                  />
                  <CommonIcon v-else name="download" class="size-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                  {{ __('Download Feedback (.xlsx)') }}
                </button>
              </div>
            </div>

            <!-- Card 2: Error Logs -->
            <div
              class="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <CommonIcon
                    name="exclamation-triangle"
                    class="size-4 text-amber-600 dark:text-amber-400"
                  />
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">
                    {{ __('AI Provider Error Logs') }}
                  </h3>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'Spreadsheet detailing failed API calls, HTTP error codes, model timeouts, and rate limit occurrences.',
                    )
                  }}
                </p>
              </div>
              <div class="mt-5">
                <button
                  type="button"
                  class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  :disabled="isDownloadingErrors"
                  :aria-label="__('Download Error Logs')"
                  @click="downloadAnalytics('errors')"
                >
                  <CommonIcon
                    v-if="isDownloadingErrors"
                    name="loading"
                    class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                  />
                  <CommonIcon v-else name="download" class="size-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                  {{ __('Download Errors (.xlsx)') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
