<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { ErrorRouteType, redirectErrorRoute } from '#shared/router/error.ts'
import { MutationHandler } from '#shared/server/apollo/handler/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { ErrorStatusCodes } from '#shared/types/error.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

import { useCheckChangePassword } from '../composables/permission/useCheckChangePassword.ts'
import { useBreadcrumb } from '../composables/useBreadcrumb.ts'
import { usePersonalSettingTabs } from '../composables/usePersonalSettingTabs.ts'
import { useUserCurrentChangePasswordMutation } from '../graphql/mutations/userCurrentChangePassword.api.ts'

import type { ChangePasswordFormData } from '../types/change-password.ts'

const user = toRef(useSessionStore(), 'user')
const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

defineOptions({
  beforeRouteEnter() {
    const { canChangePassword } = useCheckChangePassword()

    if (!canChangePassword.value)
      return redirectErrorRoute({
        type: ErrorRouteType.AuthenticatedError,
        title: __('Forbidden'),
        message: __('Password change has been disabled by the administrator.'),
        statusCode: ErrorStatusCodes.Forbidden,
      })

    return true
  },
})

const { form, isDisabled } = useForm()

const schema = [
  {
    isLayout: true,
    element: 'div',
    attrs: {
      class: '@container grid grid-cols-2 gap-2.5',
    },
    children: [
      {
        name: 'current_password',
        label: __('Current password'),
        type: 'password',
        outerClass: 'col-span-full',
        props: {
          maxLength: 1001,
          autocomplete: 'current-password',
        },
        required: true,
      },
      {
        name: 'new_password',
        label: __('New password'),
        type: 'password',
        outerClass: 'col-span-full @md:col-span-1',
        props: {
          maxLength: 1001,
          autocomplete: 'new-password',
        },
        required: true,
      },
      {
        name: 'new_password_confirm',
        label: __('Confirm new password'),
        type: 'password',
        outerClass: 'col-span-full @md:col-span-1',
        validation: 'confirm',
        props: {
          maxLength: 1001,
          autocomplete: 'new-password',
        },
        required: true,
      },
    ],
  },
]

const { breadcrumbItems } = useBreadcrumb(__('Password'))

const { notify } = useNotifications()

const changePasswordMutation = new MutationHandler(useUserCurrentChangePasswordMutation(), {
  errorNotificationMessage: __('Password could not be changed.'),
})

const submitForm = async (formData: FormSubmitData<ChangePasswordFormData>) => {
  return changePasswordMutation
    .send({
      currentPassword: formData.current_password as string,
      newPassword: formData.new_password as string,
    })
    .then((data) => {
      if (data?.userCurrentChangePassword?.success) {
        notify({
          id: 'password-changed',
          type: NotificationTypes.Success,
          message: __('Password changed successfully.'),
        })
      }
    })
}

const { tabs, activeTab } = usePersonalSettingTabs()
</script>

<template>
  <!-- CUSTOMER REDESIGNED MICROSOFT 365 SECURITY VIEW -->
  <div v-if="isCustomer" class="max-w-2xl space-y-5">
    <!-- Header & Breadcrumb -->
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
        <router-link to="/" class="hover:text-slate-600 transition-colors">{{ $t('Dashboard') }}</router-link>
        <span>/</span>
        <span class="text-slate-600">{{ $t('Settings') }}</span>
        <span>/</span>
        <span class="text-[#15803d] font-bold">{{ $t('Security') }}</span>
      </div>
      <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
        {{ $t('Authentication & Security') }}
      </h1>
      <p class="text-xs sm:text-sm text-slate-500 mt-1">
        {{ $t('Your student portal account is securely managed through Microsoft 365 Single Sign-On.') }}
      </p>
    </div>

    <!-- Unified Sleek Card -->
    <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
      <!-- Section 1: Identity & Status -->
      <div class="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <!-- Microsoft 365 Logo Box -->
          <div class="w-11 h-11 rounded-xl bg-slate-50 p-2 border border-slate-200/70 flex items-center justify-center shrink-0 shadow-2xs">
            <svg class="w-full h-full" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                Microsoft 365 SSO
              </h2>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {{ $t('Connected') }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
              {{ user?.email || user?.login || 'Student Account' }}
              <span class="text-slate-300 mx-1">·</span>
              <span class="text-slate-400">LSST · FSB · UKBC</span>
            </p>
          </div>
        </div>

        <a
          href="https://myaccount.microsoft.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-98"
        >
          <span>{{ $t('Manage on Microsoft') }}</span>
          <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <!-- Section 2: Details List -->
      <div class="p-5 sm:p-6 space-y-4">
        <!-- Password row -->
        <div class="flex items-start gap-3.5">
          <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-xs sm:text-sm font-bold text-slate-900">
              {{ $t('Institutional Password') }}
            </h3>
            <p class="text-xs text-slate-500 leading-relaxed mt-0.5">
              {{ $t('Your password is authenticated through Microsoft 365. There is no separate portal password to change or update.') }}
            </p>
          </div>
        </div>

        <!-- 2FA row -->
        <div class="flex items-start gap-3.5">
          <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-xs sm:text-sm font-bold text-slate-900">
              {{ $t('Multi-Factor Authentication (MFA)') }}
            </h3>
            <p class="text-xs text-slate-500 leading-relaxed mt-0.5">
              {{ $t('Security prompts and verification codes are handled directly by Microsoft Authenticator or SMS as configured with your institution.') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Section 3: Recovery / Help Footer -->
      <div class="px-5 py-4 sm:px-6 bg-slate-50/70 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
        <svg class="w-4 h-4 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <span>{{ $t('Forgot your student password or locked out? Visit') }} </span>
          <a
            href="https://passwordreset.microsoftonline.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold text-[#15803d] hover:text-[#16a34a] hover:underline"
          >
            passwordreset.microsoftonline.com
          </a>
          <span> {{ $t('or contact your campus IT Helpdesk.') }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- AGENT UNTOUCHED PASSWORD VIEW -->
  <LayoutContent
    v-else
    :active-tab="activeTab"
    :tabs="tabs"
    :breadcrumb-items="breadcrumbItems"
    :help-text="$t('Enter your current password, insert a new one and confirm it.')"
    width="narrow"
  >
    <div class="mb-4">
      <Form
        ref="form"
        :schema="schema"
        clear-values-after-submit
        @submit="submitForm($event as FormSubmitData<ChangePasswordFormData>)"
      >
        <template #after-fields>
          <div class="mt-5 flex items-center justify-end gap-2">
            <CommonButton variant="submit" type="submit" size="medium" :disabled="isDisabled">
              {{ $t('Change password') }}
            </CommonButton>
          </div>
        </template>
      </Form>
    </div>
  </LayoutContent>
</template>
