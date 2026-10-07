<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaNode, FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import UserError from '#shared/errors/UserError.ts'
import { EnumPublicLinksScreen } from '#shared/graphql/types.ts'
import MutationHandler from '#shared/server/apollo/handler/MutationHandler.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import lsstImg from '#desktop/assets/images/lsst.png'
import fsbImg from '#desktop/assets/images/fsb.png'
import ukbcImg from '#desktop/assets/images/ukbc.png'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonPublicLinks from '#desktop/components/CommonPublicLinks/CommonPublicLinks.vue'
import LayoutPublicPage from '#desktop/components/layout/LayoutPublicPage/LayoutPublicPage.vue'

import { useUserPasswordResetSendMutation } from '../graphql/mutations/userPasswordResetSend.api.ts'

interface Props {
  login?: string
}

const props = defineProps<Props>()

defineOptions({
  beforeRouteEnter(to) {
    const application = useApplicationStore()
    if (!application.config.user_lost_password) {
      return to.redirectedFrom ? false : '/'
    }
    return true
  },
})

const router = useRouter()

interface FormValues {
  login: string
}

const formSchema: FormSchemaNode[] = [
  {
    type: 'text',
    label: __('Username / Email'),
    name: 'login',
    required: true,
    value: props.login,
  },
]

const { form, isDisabled } = useForm()

const showSuccessScreen = ref(false)
const resetHandler = new MutationHandler(useUserPasswordResetSendMutation())
const { notify } = useNotifications()

const resetPassword = async (form: FormSubmitData<FormValues>) => {
  try {
    const result = await resetHandler.send({ username: form.login })
    if (result?.userPasswordResetSend?.success) {
      showSuccessScreen.value = true
    }
  } catch (error) {
    if (error instanceof UserError) {
      notify({
        id: 'password-reset',
        type: NotificationTypes.Error,
        message: error.generalErrors[0],
      })
    }
  }
}

const resetForm = () => {
  showSuccessScreen.value = false
}

const goToLogin = () => {
  router.replace('/login')
}
</script>

<template>
  <LayoutPublicPage
    box-size="small"
    show-logo
    :title="
      showSuccessScreen
        ? __('The password reset request was successful.')
        : __('Forgot your password?')
    "
  >
    <Form
      v-if="!showSuccessScreen"
      id="password-reset"
      ref="form"
      form-class="mb-2.5"
      :schema="formSchema"
      @submit="resetPassword($event as FormSubmitData<FormValues>)"
    />
    <section v-else>
      <CommonLabel class="mb-5 text-center">
        {{ $t('Password reset instructions were sent to your email address.') }}
      </CommonLabel>
      <CommonLabel class="text-center">
        {{
          $t(
            "If you don't receive instructions within a minute or two, check your email's spam and junk filters, or try resending your request.",
          )
        }}
      </CommonLabel>
    </section>
    <template #boxActions>
      <CommonButton variant="secondary" size="medium" :disabled="isDisabled" @click="goToLogin()">
        {{ $t('Cancel & go back') }}
      </CommonButton>
      <button
        v-if="!showSuccessScreen"
        type="submit"
        form="password-reset"
        :disabled="isDisabled"
        class="py-3.5 px-6 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {{ $t('Submit') }}
      </button>
      <button
        v-else
        type="button"
        :disabled="isDisabled"
        class="py-3.5 px-6 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        @click="resetForm"
      >
        {{ $t('Try again') }}
      </button>
    </template>
    <template #bottomContent>
      <!-- INSTITUTION LOGOS SECTION (ENLARGED WHITE CARD) -->
      <div class="mt-4 bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100 w-full max-w-[400px] mx-auto">
        <p class="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Supported Institutions
        </p>
        <div class="flex items-center justify-center gap-6">
          <a href="https://www.lsst.ac/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
            <img :src="lsstImg" class="h-10 sm:h-11 w-auto object-contain" alt="LSST" />
          </a>
          <div class="w-px h-6 bg-gray-200"></div>
          <a href="https://fsb.ac.uk/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
            <img :src="fsbImg" class="h-10 sm:h-11 w-auto object-contain" alt="FSB" />
          </a>
          <div class="w-px h-6 bg-gray-200"></div>
          <a href="https://ukbusinesscollege.org/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
            <img :src="ukbcImg" class="h-10 sm:h-11 w-auto object-contain rounded-lg" alt="UKBC" />
          </a>
        </div>
      </div>
      <!-- Student Hub: links admins add under Administration → Public Links -->
      <CommonPublicLinks :screen="EnumPublicLinksScreen.PasswordReset" />
    </template>
  </LayoutPublicPage>
</template>

<style scoped>
:deep(.formkit-inner) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  position: relative !important;
  width: 100% !important;
}

:deep(.formkit-input),
:deep(input[type='text']),
:deep(input[type='password']),
:deep(input[type='email']) {
  width: 100% !important;
  height: 2.75rem !important;
  background-color: #ffffff !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 0.75rem !important;
  padding-left: 1rem !important;
  padding-right: 2.5rem !important;
  font-size: 0.875rem !important;
  color: #0f172a !important;
  outline: none !important;
  box-shadow: none !important;
  transition: all 150ms ease !important;
}

:deep(.formkit-input:focus),
:deep(input[type='text']:focus),
:deep(input[type='password']:focus),
:deep(input[type='email']:focus) {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1) !important;
}

:deep(input[type='text']::placeholder),
:deep(input[type='password']::placeholder),
:deep(input[type='email']::placeholder) {
  color: #94a3b8 !important;
}

:deep(label) {
  color: #334155 !important;
  font-weight: 500 !important;
  font-size: 0.875rem !important;
}

/* Hide required dots */
:deep(.text-orange-500),
:deep(.text-red-500),
:deep(span[class*='text-orange']),
:deep(span[class*='text-red']),
:deep(label::after),
:deep(span.required) {
  display: none !important;
}
</style>
