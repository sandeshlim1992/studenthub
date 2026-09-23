<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  title: string
  description: string
  state_current?: { value?: unknown }
  state_initial?: { value?: unknown }
}

interface GroupRecord {
  id: number
  name: string
  active: boolean
}

const router = useRouter()

// State
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const groups = ref<GroupRecord[]>([])
const settingsMap = ref<Record<string, SettingRecord>>({})

// Form Settings
const isFormEnabled = ref(false)
const selectedGroupId = ref<number>(1)
const isHoneypotEnabled = ref(true)
const captchaProvider = ref('')
const captchaOptions = ref({
  sitekey: '',
  secret: '',
  project_id: '',
  api_key: '',
  min_score: '0.5',
})

// Designer State
const messageTitle = ref(__('Feedback Form'))
const messageSubmit = ref(__('Submit'))
const messageThankYou = ref(__('Thank you for your inquiry! We\'ll contact you as soon as possible.'))
const isModal = ref(true)
const showTitle = ref(true)
const attachmentSupport = ref(true)
const noCSS = ref(false)
const debug = ref(false)
const scriptFormat = ref<'vanilla' | 'jquery'>('vanilla')

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Form') },
]

const captchaProviders = [
  { value: '', label: __('None') },
  { value: 'altcha', label: __('ALTCHA') },
  { value: 'turnstile', label: __('Cloudflare Turnstile') },
  { value: 'hcaptcha', label: __('hCaptcha') },
  { value: 'friendly_captcha', label: __('Friendly Captcha') },
  { value: 'recaptcha', label: __('Google reCAPTCHA') },
  { value: 'recaptcha_enterprise', label: __('Google reCAPTCHA Enterprise') },
]

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => { successMessage.value = '' }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  successMessage.value = ''
}

// Dynamic Captcha requirements
const captchaNeedsSiteKey = computed(() => {
  return ['altcha', 'turnstile', 'hcaptcha', 'friendly_captcha', 'recaptcha'].includes(captchaProvider.value)
})

const captchaNeedsSecret = computed(() => {
  return ['altcha', 'turnstile', 'hcaptcha', 'friendly_captcha', 'recaptcha'].includes(captchaProvider.value)
})

const captchaIsEnterprise = computed(() => {
  return captchaProvider.value === 'recaptcha_enterprise'
})

const captchaNeedsScore = computed(() => {
  return ['recaptcha', 'recaptcha_enterprise'].includes(captchaProvider.value)
})

// Generated Embed Snippet
const generatedEmbedSnippet = computed(() => {
  const host = window.location.origin
  const quote = (str: string) => str.replace(/'/g, "\\'")

  const closingScript = '<' + '/script>'

  if (scriptFormat.value === 'jquery') {
    return `<button id="feedback-form" type="button">${quote(messageTitle.value)}</button>
<script src="https://code.jquery.com/jquery-3.6.0.min.js">${closingScript}
<script id="zammad_form_script" src="${host}/assets/form/form.js">${closingScript}
<script>
$(function() {
  $('#feedback-form').ZammadForm({
    messageTitle: '${quote(messageTitle.value)}',
    messageSubmit: '${quote(messageSubmit.value)}',
    messageThankYou: '${quote(messageThankYou.value)}',
    modal: ${isModal.value},
    showTitle: ${showTitle.value},
    attachmentSupport: ${attachmentSupport.value},
    noCSS: ${noCSS.value},
    debug: ${debug.value}
  });
});
${closingScript}`
  }

  return `<button id="feedback-form" type="button">${quote(messageTitle.value)}</button>
<script id="zammad_form_script" src="${host}/assets/form/form.js">${closingScript}
<script>
document.addEventListener('DOMContentLoaded', function() {
  new ZammadForm({
    target: document.getElementById('feedback-form'),
    messageTitle: '${quote(messageTitle.value)}',
    messageSubmit: '${quote(messageSubmit.value)}',
    messageThankYou: '${quote(messageThankYou.value)}',
    modal: ${isModal.value},
    showTitle: ${showTitle.value},
    attachmentSupport: ${attachmentSupport.value},
    noCSS: ${noCSS.value},
    debug: ${debug.value}
  });
});
${closingScript}`
})

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(generatedEmbedSnippet.value)
    showSuccess(__('Embed code copied to clipboard.'))
  } catch (e) {
    showError(__('Failed to copy embed code.'))
    console.error(e)
  }
}

// Load Data
const loadData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [settingsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/settings', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }

    if (settingsRes.ok) {
      const allSettings: SettingRecord[] = await settingsRes.json()
      const map: Record<string, SettingRecord> = {}
      allSettings.forEach((s) => {
        map[s.name] = s
      })
      settingsMap.value = map

      const cur = (key: string, fallback: unknown) => {
        return map[key]?.state_current?.value ?? map[key]?.state_initial?.value ?? fallback
      }

      isFormEnabled.value = Boolean(cur('form_ticket_create', false))
      selectedGroupId.value = Number(cur('form_ticket_create_group_id', groups.value[0]?.id || 1))
      isHoneypotEnabled.value = Boolean(cur('form_ticket_create_honeypot', true))
      captchaProvider.value = String(cur('form_ticket_create_captcha_provider', ''))

      const opts = (cur('form_ticket_create_captcha_options', {}) as Record<string, string>) || {}
      captchaOptions.value = {
        sitekey: opts.sitekey || '',
        secret: opts.secret || '',
        project_id: opts.project_id || '',
        api_key: opts.api_key || '',
        min_score: opts.min_score || '0.5',
      }
    }
  } catch (e) {
    showError(__('Failed to load Form channel settings.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Save Settings
const saveSettings = async () => {
  isSaving.value = true
  try {
    const updates: Array<{ name: string; value: unknown }> = [
      { name: 'form_ticket_create', value: isFormEnabled.value },
      { name: 'form_ticket_create_group_id', value: selectedGroupId.value },
      { name: 'form_ticket_create_honeypot', value: isHoneypotEnabled.value },
      { name: 'form_ticket_create_captcha_provider', value: captchaProvider.value },
      { name: 'form_ticket_create_captcha_options', value: captchaOptions.value },
    ]

    const promises = updates.map(({ name, value }) => {
      const s = settingsMap.value[name]
      if (!s) return Promise.resolve(true)
      return fetch(`/api/v1/settings/${s.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ state_current: { value } }),
      }).then((r) => r.ok)
    })

    const results = await Promise.all(promises)
    if (results.every(Boolean)) {
      showSuccess(__('Form settings saved successfully.'))
    } else {
      showError(__('Some settings could not be updated.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving form settings.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-5xl mx-auto">
      
      <!-- Top Navigation & Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <button
              type="button"
              class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              :title="__('Back to Administration')"
              :aria-label="__('Back to Administration')"
              @click="router.push('/manage')"
            >
              <CommonIcon name="arrow-left" class="w-4 h-4" />
            </button>
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <CommonIcon name="file" class="w-4 h-4" />
              </div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {{ __('Ticket Form Channel') }}
              </h1>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Embed interactive contact and ticket submission forms directly into your external websites.') }}
          </p>
        </div>

        <button
          type="button"
          class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          :disabled="isSaving"
          @click="saveSettings"
        >
          {{ isSaving ? __('Saving...') : __('Save Settings') }}
        </button>
      </div>

      <!-- Feedback Alerts -->
      <div v-if="successMessage" class="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="check-circle" class="w-4 h-4 shrink-0 text-emerald-500" />
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="alert-triangle" class="w-4 h-4 shrink-0 text-rose-500" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Loading Form channel settings...') }}</p>
      </div>

      <div v-else class="space-y-6">

        <!-- Master Switch Card -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Form Service Status') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('When enabled, web visitors can submit new tickets through embedded web forms.') }}
            </p>
          </div>

          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="isFormEnabled"
              type="checkbox"
              class="sr-only peer"
              :aria-label="__('Toggle Form Service')"
            />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <!-- Settings & Group Routing -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Routing Settings') }}</h2>

          <div class="max-w-md">
            <label for="form-group-select" class="block text-xs font-semibold mb-1">
              {{ __('Group selection for Ticket creation') }} <span class="text-rose-500">*</span>
            </label>
            <select
              id="form-group-select"
              v-model="selectedGroupId"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
            >
              <option v-for="g in groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
            <p class="text-[11px] text-slate-400 mt-1">
              {{ __('Tickets created through web forms will automatically be assigned to this department.') }}
            </p>
          </div>
        </div>

        <!-- Spam Protection Section -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{{ __('Spam Protection') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Protect ticket queues from automated bots and form submission spam.') }}
            </p>
          </div>

          <!-- Honeypot -->
          <div class="flex items-center gap-3">
            <input
              id="form-honeypot-check"
              v-model="isHoneypotEnabled"
              type="checkbox"
              class="w-4 h-4 rounded text-blue-600 cursor-pointer"
            />
            <label for="form-honeypot-check" class="text-xs font-medium cursor-pointer">
              {{ __('Enable honeypot protection (an invisible field that traps automated bots).') }}
            </label>
          </div>

          <!-- Captcha Provider -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label for="form-captcha-provider-select" class="block text-xs font-semibold mb-1">
                {{ __('CAPTCHA Provider') }}
              </label>
              <select
                id="form-captcha-provider-select"
                v-model="captchaProvider"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="opt in captchaProviders" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Site Key -->
            <div v-if="captchaNeedsSiteKey">
              <label for="form-captcha-site-key-input" class="block text-xs font-semibold mb-1">{{ __('Site Key') }}</label>
              <input
                id="form-captcha-site-key-input"
                v-model="captchaOptions.sitekey"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <!-- Secret Key -->
            <div v-if="captchaNeedsSecret">
              <label for="form-captcha-secret-input" class="block text-xs font-semibold mb-1">{{ __('Secret Key') }}</label>
              <input
                id="form-captcha-secret-input"
                v-model="captchaOptions.secret"
                type="password"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <!-- Enterprise Project ID -->
            <div v-if="captchaIsEnterprise">
              <label for="form-captcha-project-input" class="block text-xs font-semibold mb-1">{{ __('Project ID') }}</label>
              <input
                id="form-captcha-project-input"
                v-model="captchaOptions.project_id"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <!-- Enterprise API Key -->
            <div v-if="captchaIsEnterprise">
              <label for="form-captcha-api-key-input" class="block text-xs font-semibold mb-1">{{ __('API Key') }}</label>
              <input
                id="form-captcha-api-key-input"
                v-model="captchaOptions.api_key"
                type="password"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <!-- Minimum Score -->
            <div v-if="captchaNeedsScore">
              <label for="form-captcha-score-input" class="block text-xs font-semibold mb-1">{{ __('Minimum Score (0.0 - 1.0)') }}</label>
              <input
                id="form-captcha-score-input"
                v-model="captchaOptions.min_score"
                type="text"
                placeholder="0.5"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <!-- Designer & Live Simulator -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{{ __('Form Designer & Preview') }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Customize form copy, behavior, and preview how it appears to visitors.') }}
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            <!-- Designer Controls -->
            <div class="space-y-4">
              <div>
                <label for="designer-form-title" class="block text-xs font-semibold mb-1">{{ __('Title of the Form') }}</label>
                <input
                  id="designer-form-title"
                  v-model="messageTitle"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label for="designer-form-submit" class="block text-xs font-semibold mb-1">{{ __('Submit Button Text') }}</label>
                <input
                  id="designer-form-submit"
                  v-model="messageSubmit"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label for="designer-form-thankyou" class="block text-xs font-semibold mb-1">{{ __('Confirmation / Thank You Message') }}</label>
                <textarea
                  id="designer-form-thankyou"
                  v-model="messageThankYou"
                  rows="2"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                ></textarea>
              </div>

              <!-- Options checkboxes -->
              <div class="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input v-model="isModal" type="checkbox" class="w-4 h-4 rounded text-blue-600" />
                  <span>{{ __('Start modal dialog for form') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input v-model="showTitle" type="checkbox" class="w-4 h-4 rounded text-blue-600" />
                  <span>{{ __('Show title inside the form') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input v-model="attachmentSupport" type="checkbox" class="w-4 h-4 rounded text-blue-600" />
                  <span>{{ __('Allow file attachments upload') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input v-model="noCSS" type="checkbox" class="w-4 h-4 rounded text-blue-600" />
                  <span>{{ __('Don\'t load CSS (use your website custom styling)') }}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs">
                  <input v-model="debug" type="checkbox" class="w-4 h-4 rounded text-blue-600" />
                  <span>{{ __('Enable console debugging') }}</span>
                </label>
              </div>
            </div>

            <!-- Live Form Simulator Preview -->
            <div class="bg-slate-100 dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-750 flex flex-col items-center justify-center">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 self-start">
                {{ __('Live Form Preview') }}
              </span>

              <div class="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg space-y-3.5">
                <div v-if="showTitle" class="border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ messageTitle }}</h4>
                </div>

                <div>
                  <label for="sim-name" class="block text-[11px] font-medium text-slate-500 mb-1">{{ __('Your Name') }}</label>
                  <input id="sim-name" type="text" disabled placeholder="Jane Doe" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400" />
                </div>

                <div>
                  <label for="sim-email" class="block text-[11px] font-medium text-slate-500 mb-1">{{ __('Email Address') }}</label>
                  <input id="sim-email" type="email" disabled placeholder="jane@example.com" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400" />
                </div>

                <div>
                  <label for="sim-msg" class="block text-[11px] font-medium text-slate-500 mb-1">{{ __('Message') }}</label>
                  <textarea id="sim-msg" rows="3" disabled placeholder="How can we help you?" class="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400"></textarea>
                </div>

                <div v-if="attachmentSupport" class="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CommonIcon name="file" class="w-3.5 h-3.5" />
                  <span>{{ __('Attach file (optional)') }}</span>
                </div>

                <div v-if="captchaProvider" class="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                  <CommonIcon name="check-circle" class="w-3 h-3 text-emerald-500" />
                  <span>{{ __('Protected by') }} {{ captchaProvider }}</span>
                </div>

                <button
                  type="button"
                  class="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs cursor-default"
                >
                  {{ messageSubmit }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Embed Code Snippet Generator -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Website Embed Code') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Paste this code snippet into your web page right before the closing </body> tag.') }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <div class="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors"
                  :class="scriptFormat === 'vanilla' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500'"
                  @click="scriptFormat = 'vanilla'"
                >
                  Vanilla JS
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors"
                  :class="scriptFormat === 'jquery' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500'"
                  @click="scriptFormat = 'jquery'"
                >
                  jQuery
                </button>
              </div>

              <button
                type="button"
                class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                @click="copySnippet"
              >
                <CommonIcon name="clipboard" class="w-3.5 h-3.5" />
                {{ __('Copy Code') }}
              </button>
            </div>
          </div>

          <div class="relative">
            <pre class="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">{{ generatedEmbedSnippet }}</pre>
          </div>
        </div>

      </div>

    </div>
  </LayoutContent>
</template>
