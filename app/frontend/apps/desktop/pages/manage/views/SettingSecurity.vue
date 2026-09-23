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
  area: string
  state_current?: { value?: unknown }
  state_initial?: { value?: unknown }
  preferences?: {
    controller?: string
    sub?: string[]
    title_i18n?: string[]
  }
}

interface RoleRecord {
  id: number
  name: string
  active?: boolean
}

interface SslCertRecord {
  id: number
  subject: string
  fingerprint: string
  not_before: string
  not_after: string
  ca?: boolean
}

interface ProviderModalState {
  isOpen: boolean
  providerName: string
  providerTitle: string
  subSettingName: string
  subSettingId?: number
  clientId: string
  clientSecret: string
  site?: string
  callbackUrl: string
  isSaving: boolean
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Settings') },
  { label: __('Security') },
]

const activeTab = ref<'base' | 'password' | 'two_factor' | 'ssl' | 'third_party'>('base')
const isLoading = ref(true)
const successMessage = ref('')
const errorMessage = ref('')
const isSaving = ref<Record<string, boolean>>({})

const allSettings = ref<Record<string, SettingRecord>>({})
const rolesList = ref<RoleRecord[]>([])
const sslCertificates = ref<SslCertRecord[]>([])

// Add SSL Modal
const showAddCertModal = ref(false)
const newCertContent = ref('')
const isSavingCert = ref(false)

// Third-Party Provider Modal
const providerModal = ref<ProviderModalState>({
  isOpen: false,
  providerName: '',
  providerTitle: '',
  subSettingName: '',
  clientId: '',
  clientSecret: '',
  site: '',
  callbackUrl: '',
  isSaving: false,
})

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
  setTimeout(() => { errorMessage.value = '' }, 6000)
}

const fetchAllData = async () => {
  isLoading.value = true
  try {
    const [settingsRes, rolesRes, sslRes] = await Promise.all([
      fetch('/api/v1/settings', { headers: { 'Accept': 'application/json' } }),
      fetch('/api/v1/roles', { headers: { 'Accept': 'application/json' } }),
      fetch('/api/v1/ssl_certificates', { headers: { 'Accept': 'application/json' } }),
    ])

    if (settingsRes.ok) {
      const data: SettingRecord[] = await settingsRes.json()
      const dict: Record<string, SettingRecord> = {}
      for (const item of data) {
        dict[item.name] = item
      }
      allSettings.value = dict
    }

    if (rolesRes.ok) {
      const rData: RoleRecord[] = await rolesRes.json()
      rolesList.value = rData.filter(r => r.active !== false)
    }

    if (sslRes.ok) {
      const sslData = await sslRes.json()
      if (sslData.SSLCertificate) {
        sslCertificates.value = Object.values(sslData.SSLCertificate)
      } else if (Array.isArray(sslData)) {
        sslCertificates.value = sslData
      }
    }
  } catch {
    showError(__('Failed to load security settings.'))
  } finally {
    isLoading.value = false
  }
}

const saveSetting = async (name: string, value: unknown) => {
  const setting = allSettings.value[name]
  if (!setting) return

  isSaving.value[name] = true
  try {
    const res = await fetch(`/api/v1/settings/${setting.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        state_current: { value },
      }),
    })

    if (res.ok) {
      const updated: SettingRecord = await res.json()
      allSettings.value[name] = updated
      showSuccess(__('Setting updated successfully.'))
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update setting.'))
    }
  } catch {
    showError(__('An unexpected error occurred while saving.'))
  } finally {
    isSaving.value[name] = false
  }
}

const toggleBooleanSetting = async (name: string) => {
  const cur = !!allSettings.value[name]?.state_current?.value
  await saveSetting(name, !cur)
}

// 2FA Role Enforcement
const enforcedRoleIds = computed(() => {
  const val = allSettings.value.two_factor_authentication_enforce_role_ids?.state_current?.value
  return Array.isArray(val) ? (val as number[]) : []
})

const toggleEnforceRole = async (roleId: number) => {
  const current = [...enforcedRoleIds.value]
  const idx = current.indexOf(roleId)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(roleId)
  }
  await saveSetting('two_factor_authentication_enforce_role_ids', current)
}

// SSL Certificates Actions
const handleCertFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    newCertContent.value = String(e.target?.result || '')
  }
  reader.readAsText(file)
}

const addCertificate = async () => {
  if (!newCertContent.value.trim()) {
    showError(__('Please provide a valid PEM certificate.'))
    return
  }

  isSavingCert.value = true
  try {
    const res = await fetch('/api/v1/ssl_certificates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        certificate: newCertContent.value.trim(),
      }),
    })

    if (res.ok) {
      showSuccess(__('SSL certificate added successfully.'))
      showAddCertModal.value = false
      newCertContent.value = ''
      await fetchAllData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to add SSL certificate.'))
    }
  } catch {
    showError(__('An error occurred while uploading SSL certificate.'))
  } finally {
    isSavingCert.value = false
  }
}

const deleteCertificate = async (id: number) => {
  if (!confirm(__('Are you sure you want to delete this certificate?'))) return

  try {
    const res = await fetch(`/api/v1/ssl_certificates/${id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrf(),
      },
    })

    if (res.ok) {
      showSuccess(__('Certificate removed successfully.'))
      await fetchAllData()
    } else {
      showError(__('Failed to delete certificate.'))
    }
  } catch {
    showError(__('An error occurred while deleting certificate.'))
  }
}

// Third-party providers list
const thirdPartyProviders = [
  { name: 'auth_google_oauth2', title: __('Google'), icon: 'google', sub: 'auth_google_oauth2_credentials' },
  { name: 'auth_microsoft_office365', title: __('Microsoft 365'), icon: 'microsoft', sub: 'auth_microsoft_office365_credentials' },
  { name: 'auth_github', title: __('GitHub'), icon: 'github', sub: 'auth_github_credentials' },
  { name: 'auth_gitlab', title: __('GitLab'), icon: 'code', sub: 'auth_gitlab_credentials' },
  { name: 'auth_twitter', title: __('Twitter / X'), icon: 'twitter', sub: 'auth_twitter_credentials' },
  { name: 'auth_facebook', title: __('Facebook'), icon: 'facebook', sub: 'auth_facebook_credentials' },
  { name: 'auth_linkedin', title: __('LinkedIn'), icon: 'linkedin', sub: 'auth_linkedin_credentials' },
  { name: 'auth_saml', title: __('SAML'), icon: 'shield-lock', sub: 'auth_saml_credentials' },
  { name: 'auth_openid_connect', title: __('OpenID Connect'), icon: 'link-45deg', sub: 'auth_openid_connect_credentials' },
]

const openProviderModal = (prov: typeof thirdPartyProviders[0]) => {
  const subSetting = allSettings.value[prov.sub]
  const creds = (subSetting?.state_current?.value || {}) as Record<string, string>

  providerModal.value = {
    isOpen: true,
    providerName: prov.name,
    providerTitle: prov.title,
    subSettingName: prov.sub,
    subSettingId: subSetting?.id,
    clientId: creds.client_id || creds.app_id || creds.idp_sso_target_url || '',
    clientSecret: creds.client_secret || creds.app_secret || creds.idp_cert || '',
    site: creds.site || creds.idp_sso_target_url || '',
    callbackUrl: `${window.location.origin}/auth/${prov.name.replace('auth_', '')}/callback`,
    isSaving: false,
  }
}

const saveProviderCredentials = async () => {
  if (!providerModal.value.subSettingId) return

  providerModal.value.isSaving = true
  try {
    const payload: Record<string, string> = {
      client_id: providerModal.value.clientId,
      client_secret: providerModal.value.clientSecret,
    }
    if (providerModal.value.site) {
      payload.site = providerModal.value.site
    }

    const res = await fetch(`/api/v1/settings/${providerModal.value.subSettingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        state_current: { value: payload },
      }),
    })

    if (res.ok) {
      showSuccess(__('Provider credentials updated successfully.'))
      providerModal.value.isOpen = false
      await fetchAllData()
    } else {
      const err = await res.json()
      showError(err.message || __('Failed to update credentials.'))
    }
  } catch {
    showError(__('Failed to save provider configuration.'))
  } finally {
    providerModal.value.isSaving = false
  }
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Callback URL copied to clipboard.'))
  } catch {
    showError(__('Unable to copy to clipboard.'))
  }
}

onMounted(() => {
  fetchAllData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-5xl">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back')"
            @click="router.back()"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CommonIcon name="shield-lock" class="w-4 h-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ __('Security') }}</h1>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ __('Manage password policies, authentication methods, two-factor authentication, SSL certificates, and external providers.') }}
        </p>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3">
        <CommonIcon name="check2" class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-sm flex items-center gap-3">
        <CommonIcon name="exclamation-triangle" class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Tabs Navigation -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-[#1e293b] mb-6 overflow-x-auto">
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'base' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'base'"
        >
          {{ __('Base') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'password' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'password'"
        >
          {{ __('Password') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'two_factor' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'two_factor'"
        >
          {{ __('Two-factor Authentication') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'ssl' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'ssl'"
        >
          {{ __('SSL Certificates') }}
        </button>
        <button
          type="button"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap"
          :class="activeTab === 'third_party' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="activeTab = 'third_party'"
        >
          {{ __('Third-party Applications') }}
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="space-y-6">
        <div class="h-36 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
        <div class="h-36 rounded-2xl bg-slate-100 dark:bg-[#1e293b] animate-pulse" />
      </div>

      <div v-else>
        <!-- TAB 1: Base -->
        <div v-if="activeTab === 'base'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ __('User Login & Registration') }}
            </h2>

            <!-- Password Login Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Password Login') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Allow users to authenticate with local password.') }}</p>
              </div>
              <input
                id="setting-user-show-password-login"
                type="checkbox"
                :checked="!!allSettings.user_show_password_login?.state_current?.value"
                :aria-label="__('Password Login')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('user_show_password_login')"
              />
            </div>

            <!-- New User Accounts Toggle -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('New User Accounts') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Allow customers to register new accounts via web portal.') }}</p>
              </div>
              <input
                id="setting-user-create-account"
                type="checkbox"
                :checked="!!allSettings.user_create_account?.state_current?.value"
                :aria-label="__('New User Accounts')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('user_create_account')"
              />
            </div>

            <!-- Lost Password Toggle -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Lost Password') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Enable lost password recovery links on the sign in page.') }}</p>
              </div>
              <input
                id="setting-user-lost-password"
                type="checkbox"
                :checked="!!allSettings.user_lost_password?.state_current?.value"
                :aria-label="__('Lost Password')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('user_lost_password')"
              />
            </div>
          </div>
        </div>

        <!-- TAB 2: Password Policies -->
        <div v-if="activeTab === 'password'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ __('Password Complexity Rules') }}
            </h2>

            <!-- Minimum Size -->
            <div class="flex items-center justify-between">
              <div>
                <label for="setting-password-min-size" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                  {{ __('Minimum Length') }}
                </label>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Minimum character length for user passwords.') }}</p>
              </div>
              <input
                id="setting-password-min-size"
                type="number"
                min="4"
                max="64"
                :value="allSettings.password_min_size?.state_current?.value || 10"
                class="w-24 px-3 py-1.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 text-center"
                @change="saveSetting('password_min_size', Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <!-- 2 Lower / 2 Upper -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('2 Lower and 2 Upper Case Characters') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Require both lowercase and uppercase letters.') }}</p>
              </div>
              <input
                id="setting-password-min-lower-upper"
                type="checkbox"
                :checked="!!allSettings.password_min_2_lower_2_upper_characters?.state_current?.value"
                :aria-label="__('2 Lower and 2 Upper Case Characters')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('password_min_2_lower_2_upper_characters')"
              />
            </div>

            <!-- Digit Required -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Digit Required') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Require at least one numeric digit (0-9).') }}</p>
              </div>
              <input
                id="setting-password-need-digit"
                type="checkbox"
                :checked="!!allSettings.password_need_digit?.state_current?.value"
                :aria-label="__('Digit Required')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('password_need_digit')"
              />
            </div>

            <!-- Special Character Required -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Special Character Required') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Require at least one non-alphanumeric character (!@#$%^&*).') }}</p>
              </div>
              <input
                id="setting-password-need-special-char"
                type="checkbox"
                :checked="!!allSettings.password_need_special_character?.state_current?.value"
                :aria-label="__('Special Character Required')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('password_need_special_character')"
              />
            </div>

            <!-- Maximum Failed Logins -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <label for="setting-password-max-failed" class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                  {{ __('Maximum Failed Logins') }}
                </label>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Number of consecutive failed logins before user account is temporarily locked.') }}</p>
              </div>
              <input
                id="setting-password-max-failed"
                type="number"
                min="1"
                max="20"
                :value="allSettings.password_max_login_failed?.state_current?.value || 5"
                class="w-24 px-3 py-1.5 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-sm text-slate-900 dark:text-slate-100 text-center"
                @change="saveSetting('password_max_login_failed', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>
        </div>

        <!-- TAB 3: Two-Factor Authentication -->
        <div v-if="activeTab === 'two_factor'" class="space-y-6">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ __('Allowed Authentication Methods') }}
            </h2>

            <!-- Security Keys (WebAuthn) -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Security Keys (WebAuthn)') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Hardware security keys like YubiKey or Passkeys.') }}</p>
              </div>
              <input
                id="setting-2fa-security-keys"
                type="checkbox"
                :checked="!!allSettings.two_factor_authentication_method_security_keys?.state_current?.value"
                :aria-label="__('Security Keys (WebAuthn)')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('two_factor_authentication_method_security_keys')"
              />
            </div>

            <!-- Authenticator App (TOTP) -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Authenticator App (TOTP)') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('One-time passcodes generated by apps like Google Authenticator or 1Password.') }}</p>
              </div>
              <input
                id="setting-2fa-authenticator-app"
                type="checkbox"
                :checked="!!allSettings.two_factor_authentication_method_authenticator_app?.state_current?.value"
                :aria-label="__('Authenticator App (TOTP)')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('two_factor_authentication_method_authenticator_app')"
              />
            </div>

            <!-- Recovery Codes -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Enable Recovery Codes') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Allow users to generate backup recovery codes in case their 2FA device is lost.') }}</p>
              </div>
              <input
                id="setting-2fa-recovery-codes"
                type="checkbox"
                :checked="!!allSettings.two_factor_authentication_recovery_codes?.state_current?.value"
                :aria-label="__('Enable Recovery Codes')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('two_factor_authentication_recovery_codes')"
              />
            </div>
          </div>

          <!-- Role Enforcement -->
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-4">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
              {{ __('Enforce 2FA for Specific Roles') }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ __('Users belonging to the selected roles will be prompted to set up two-factor authentication upon their next login.') }}
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              <label
                v-for="role in rolesList"
                :key="role.id"
                class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  :checked="enforcedRoleIds.includes(role.id)"
                  :aria-label="role.name"
                  class="w-4 h-4 accent-blue-600 cursor-pointer"
                  @change="toggleEnforceRole(role.id)"
                />
                <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ role.name }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- TAB 4: SSL Certificates -->
        <div v-if="activeTab === 'ssl'" class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Installed Certificates') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Manage custom trusted SSL certificates for external API integrations and mailboxes.') }}</p>
            </div>
            <button
              type="button"
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              @click="showAddCertModal = true"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('Add Certificate') }}</span>
            </button>
          </div>

          <!-- Certificate Table -->
          <div v-if="sslCertificates.length > 0" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-[#1e293b]/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th class="px-5 py-3.5">{{ __('Subject') }}</th>
                  <th class="px-5 py-3.5">{{ __('Fingerprint') }}</th>
                  <th class="px-5 py-3.5">{{ __('Valid Until') }}</th>
                  <th class="px-5 py-3.5 text-right">{{ __('Actions') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="cert in sslCertificates" :key="cert.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td class="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{{ cert.subject }}</td>
                  <td class="px-5 py-3.5 font-mono text-[11px] text-slate-500">{{ cert.fingerprint }}</td>
                  <td class="px-5 py-3.5">{{ new Date(cert.not_after).toLocaleDateString() }}</td>
                  <td class="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 font-medium cursor-pointer"
                      @click="deleteCertificate(cert.id)"
                    >
                      {{ __('Delete') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40">
            <CommonIcon name="shield-lock" class="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ __('No SSL certificates installed') }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{{ __('Upload trusted CA certificates for self-signed mail servers or secure internal connections.') }}</p>
          </div>
        </div>

        <!-- TAB 5: Third-Party Applications -->
        <div v-if="activeTab === 'third_party'" class="space-y-6">
          <!-- General Third-party Options -->
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs space-y-6">
            <h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{{ __('Third-party Authentication Rules') }}</h2>

            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Automatic Account Link on Initial Logon') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Automatically link external identity if verified email matches an existing local user.') }}</p>
              </div>
              <input
                id="setting-third-party-auto-link"
                type="checkbox"
                :checked="!!allSettings.auth_third_party_auto_link_at_inital_login?.state_current?.value"
                :aria-label="__('Automatic Account Link on Initial Logon')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('auth_third_party_auto_link_at_inital_login')"
              />
            </div>

            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Automatic Account Linking Notification') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Send security alert email to user when a third-party account is linked.') }}</p>
              </div>
              <input
                id="setting-third-party-linking-notification"
                type="checkbox"
                :checked="!!allSettings.auth_third_party_linking_notification?.state_current?.value"
                :aria-label="__('Automatic Account Linking Notification')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('auth_third_party_linking_notification')"
              />
            </div>

            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('No User Creation on Logon') }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Only allow existing users to sign in via external providers; do not auto-create accounts.') }}</p>
              </div>
              <input
                id="setting-third-party-no-create-user"
                type="checkbox"
                :checked="!!allSettings.auth_third_party_no_create_user?.state_current?.value"
                :aria-label="__('No User Creation on Logon')"
                class="w-5 h-5 accent-blue-600 cursor-pointer"
                @change="toggleBooleanSetting('auth_third_party_no_create_user')"
              />
            </div>
          </div>

          <!-- Provider Cards Grid -->
          <div>
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-1">{{ __('External Identity Providers') }}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div
                v-for="prov in thirdPartyProviders"
                :key="prov.name"
                class="p-5 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 shadow-xs flex flex-col justify-between gap-4"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <CommonIcon :name="prov.icon" class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ prov.title }}</h4>
                      <span
                        class="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        :class="allSettings[prov.name]?.state_current?.value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
                      >
                        {{ allSettings[prov.name]?.state_current?.value ? __('Enabled') : __('Disabled') }}
                      </span>
                    </div>
                  </div>
                  <input
                    :id="'toggle-' + prov.name"
                    type="checkbox"
                    :checked="!!allSettings[prov.name]?.state_current?.value"
                    :aria-label="prov.title"
                    class="w-4 h-4 accent-blue-600 cursor-pointer mt-1"
                    @change="toggleBooleanSetting(prov.name)"
                  />
                </div>

                <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    class="w-full py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    @click="openProviderModal(prov)"
                  >
                    {{ __('Configure') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Add SSL Certificate -->
    <div
      v-if="showAddCertModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">{{ __('Add SSL Certificate') }}</h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showAddCertModal = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3">
          <label for="new-cert-content" class="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            {{ __('Paste PEM Certificate') }}
          </label>
          <textarea
            id="new-cert-content"
            v-model="newCertContent"
            rows="6"
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
          />

          <div class="flex items-center gap-3 pt-1">
            <label
              for="cert-file-picker"
              class="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {{ __('Or Choose .crt / .pem File') }}
              <input
                id="cert-file-picker"
                type="file"
                accept=".crt,.pem,.cer"
                class="sr-only"
                @change="handleCertFileSelect"
              />
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="showAddCertModal = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
            :disabled="isSavingCert"
            @click="addCertificate"
          >
            <CommonIcon v-if="isSavingCert" name="arrow-clockwise" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSavingCert ? __('Adding...') : __('Add Certificate') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Provider Credentials Configuration -->
    <div
      v-if="providerModal.isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-[#1e293b] shadow-2xl p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">
            {{ __('Configure %s', providerModal.providerTitle) }}
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="providerModal.isOpen = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs">
          <!-- Callback URL notice -->
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#1e293b]/70 border border-slate-200 dark:border-slate-700">
            <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ __('Callback URL') }}</p>
            <div class="flex items-center justify-between gap-2">
              <code class="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all">{{ providerModal.callbackUrl }}</code>
              <button
                type="button"
                class="p-1.5 text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                :title="__('Copy URL')"
                @click="copyToClipboard(providerModal.callbackUrl)"
              >
                <CommonIcon name="copy" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Client ID -->
          <div class="space-y-1.5">
            <label for="provider-client-id" class="font-semibold text-slate-700 dark:text-slate-300 block">
              {{ __('Client ID / App ID') }}
            </label>
            <input
              id="provider-client-id"
              v-model="providerModal.clientId"
              type="text"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <!-- Client Secret -->
          <div class="space-y-1.5">
            <label for="provider-client-secret" class="font-semibold text-slate-700 dark:text-slate-300 block">
              {{ __('Client Secret / Key') }}
            </label>
            <input
              id="provider-client-secret"
              v-model="providerModal.clientSecret"
              type="password"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <!-- Site / Endpoint if applicable -->
          <div v-if="providerModal.providerName.includes('gitlab') || providerModal.providerName.includes('saml') || providerModal.providerName.includes('openid')" class="space-y-1.5">
            <label for="provider-site" class="font-semibold text-slate-700 dark:text-slate-300 block">
              {{ __('Site / IDP SSO Target URL') }}
            </label>
            <input
              id="provider-site"
              v-model="providerModal.site"
              type="text"
              placeholder="https://..."
              class="w-full px-3 py-2 bg-slate-50 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            @click="providerModal.isOpen = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
            :disabled="providerModal.isSaving"
            @click="saveProviderCredentials"
          >
            <CommonIcon v-if="providerModal.isSaving" name="arrow-clockwise" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ providerModal.isSaving ? __('Saving...') : __('Save Configuration') }}</span>
          </button>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
