<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import type { SignupFormData } from '#shared/entities/user/types.ts'
import { EnumPublicLinksScreen } from '#shared/graphql/types.ts'
import { i18n } from '#shared/i18n.ts'
import { MutationHandler } from '#shared/server/apollo/handler/index.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import lsstImg from '#desktop/assets/images/lsst.png'
import fsbImg from '#desktop/assets/images/fsb.png'
import ukbcImg from '#desktop/assets/images/ukbc.png'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonPublicLinks from '#desktop/components/CommonPublicLinks/CommonPublicLinks.vue'
import LayoutPublicPage from '#desktop/components/layout/LayoutPublicPage/LayoutPublicPage.vue'
import { useSignupForm } from '#desktop/composables/authentication/useSignupForm.ts'
import { useUserSignupResendMutation } from '#desktop/entities/user/graphql/mutations/userSignupResend.api.ts'

import { useUserSignupMutation } from '../graphql/mutations/userSignup.api.ts'

defineOptions({
  beforeRouteEnter(to) {
    const application = useApplicationStore()
    if (!application.config.user_create_account) {
      return to.redirectedFrom ? false : '/'
    }
    return true
  },
})

const application = useApplicationStore()

const router = useRouter()

const { signupSchema } = useSignupForm()

const { form, isDisabled } = useForm()

const signupSent = ref(false)
const signupEmail = ref('')

const pageTitle = computed(() => {
  if (signupSent.value) return __('Registration successful!')

  return i18n.t('Join %s', application.config.product_name)
})

const singup = async (data: SignupFormData) => {
  const sendSignup = new MutationHandler(useUserSignupMutation())

  return sendSignup
    .send({
      input: {
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        password: data.password,
      },
    })
    .then(() => {
      signupSent.value = true
      signupEmail.value = data.email
    })
}

const { notify } = useNotifications()

const resendVerifyEmail = () => {
  const resendVerifyEmail = new MutationHandler(
    useUserSignupResendMutation({
      variables: {
        email: signupEmail.value,
      },
    }),
    {
      errorShowNotification: false,
    },
  )

  resendVerifyEmail
    .send()
    .then(() => {
      notify({
        id: 'resend-verify-email',
        type: NotificationTypes.Success,
        message: __('Email sent to "%s". Please verify your email account.'),
        messagePlaceholder: [signupEmail.value],
      })
    })
    .catch(() => {
      notify({
        id: 'resend-verify-email-error',
        type: NotificationTypes.Error,
        message: __('The verification email could not be resent.'),
      })
    })
}

const goToLogin = () => {
  router.replace('login')
}
</script>

<template>
  <LayoutPublicPage box-size="medium" show-logo :title="pageTitle">
    <Form
      v-if="!signupSent"
      id="signup"
      ref="form"
      form-class="mb-2.5"
      :schema="signupSchema"
      @submit="singup($event as FormSubmitData<SignupFormData>)"
    />

    <div v-else class="flex flex-col items-center gap-2.5">
      <CommonLabel class="py-5 text-center">
        {{ $t('Thanks for joining. Email sent to "%s".', signupEmail) }}
      </CommonLabel>
      <CommonLabel class="py-5 text-center">
        {{
          $t(
            "Please click on the link in the verification email. If you don't see the email, check other places it might be, like your junk, spam, social, or other folders.",
          )
        }}
      </CommonLabel>
    </div>

    <template #boxActions>
      <CommonButton variant="secondary" size="medium" :disabled="isDisabled" @click="goToLogin()">
        {{ $t('Cancel & go back') }}
      </CommonButton>

      <button
        v-if="!signupSent"
        type="submit"
        form="signup"
        :disabled="isDisabled"
        class="py-3.5 px-6 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {{ $t('Create my account') }}
      </button>
      <button
        v-else
        type="button"
        :disabled="isDisabled"
        class="py-3.5 px-6 rounded-xl text-white font-semibold text-sm bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all duration-200 shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        @click="resendVerifyEmail()"
      >
        {{ $t('Resend verification email') }}
      </button>
    </template>

    <template #bottomContent>
      <div class="inline-flex flex-wrap items-center justify-center p-2 text-sm">
        <CommonLabel class="max-w-90 text-center text-slate-400">
          {{
            $t(
              "You're already registered with your email address if you've been in touch with our Support team.",
            )
          }}
        </CommonLabel>
        <CommonLink v-if="$c.user_lost_password" link="/reset-password" size="medium" class="text-slate-300 hover:text-white">
          {{ $t('You can request your password here.') }}
        </CommonLink>
      </div>

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
