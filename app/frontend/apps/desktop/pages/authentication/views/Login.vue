<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ApolloError } from '@apollo/client/errors'
import { computed, ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CommonLink from '#shared/components/CommonLink/CommonLink.vue'
import CommonLogo from '#shared/components/CommonLogo/CommonLogo.vue'
import { useClearFormInput } from '#shared/components/Form/composables/useClearFormInput.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData, FormSchemaField, FormValues } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import useLoginTwoFactor from '#shared/composables/authentication/useLoginTwoFactor.ts'
import { useThirdPartyAuthentication } from '#shared/composables/authentication/useThirdPartyAuthentication.ts'
import type { LoginCredentials } from '#shared/entities/two-factor/types.ts'
import UserError from '#shared/errors/UserError.ts'
import { EnumAuthenticationProvider, EnumPublicLinksScreen } from '#shared/graphql/types.ts'
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useAuthenticationStore } from '#shared/stores/authentication.ts'

import fsbImg from '#desktop/assets/images/fsb.png'
import lsstImg from '#desktop/assets/images/lsst.png'
import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'
import ukbcImg from '#desktop/assets/images/ukbc.png'
import { useBetaUi } from '#desktop/components/BetaUi/composables/useBetaUi.ts'
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonPublicLinks from '#desktop/components/CommonPublicLinks/CommonPublicLinks.vue'
import LayoutPublicPage from '#desktop/components/layout/LayoutPublicPage/LayoutPublicPage.vue'

import { ensureAfterAuth } from '../after-auth/composable/useAfterAuthPlugins.ts'
import LoginRecoveryCode from '../components/LoginRecoveryCode.vue'
import LoginTwoFactor from '../components/LoginTwoFactor.vue'
import LoginTwoFactorMethods from '../components/LoginTwoFactorMethods.vue'
import { useAdminPasswordAuthVerify } from '../composables/useAdminPasswordAuthVerify.ts'

const application = useApplicationStore()

const router = useRouter()
const route = useRoute()

const authentication = useAuthenticationStore()

const { enabledProviders, hasEnabledProviders } = useThirdPartyAuthentication()

// Needed by the third-party sign-in forms (POST /auth/<provider>).
const csrfToken = getCSRFToken()

const passwordLoginErrorMessage = ref('')
const showLocalLogin = ref(false)

const showError = (error: UserError) => {
  passwordLoginErrorMessage.value = error.generalErrors[0]
}

const clearError = () => {
  passwordLoginErrorMessage.value = ''
}

const {
  loginFlow,
  askTwoFactor,
  twoFactorPlugin,
  twoFactorAllowedMethods,
  updateState,
  updateSecondFactor,
  hasAlternativeLoginMethod,
  loginPageTitle,
  cancelAndGoBack,
} = useLoginTwoFactor(clearError)

const { form, isDisabled, values } = useForm()

const { clearAndFocus: clearAndFocusPasswordField } = useClearFormInput(form, 'password')

const finishLogin = () => {
  const { redirect: redirectUrl } = route.query
  if (typeof redirectUrl === 'string') {
    router.replace(redirectUrl)
  } else {
    router.replace('/')
  }
}

const isLoggingIn = ref(false)

const login = async (credentials: LoginCredentials) => {
  isLoggingIn.value = true
  try {
    const { twoFactor, afterAuth } = await authentication.login(credentials)

    if (afterAuth) {
      ensureAfterAuth(router, afterAuth)
      return
    }

    if (twoFactor?.defaultTwoFactorAuthenticationMethod) {
      askTwoFactor(twoFactor, credentials)
      return
    }

    finishLogin()
  } catch (error) {
    let message: string

    if (error instanceof UserError) {
      message = error.generalErrors[0]
    } else if (error instanceof ApolloError) {
      const { message: apolloMessage } = error
      message = apolloMessage
    } else {
      message = String(error)
    }

    passwordLoginErrorMessage.value = message

    // Clear the password field on any error and refocus it, in order to facilitate easier retry.
    clearAndFocusPasswordField()
  } finally {
    isLoggingIn.value = false
  }
}

const passwordResetLink = computed(() => {
  return {
    name: 'PasswordReset',
    params: {
      login: values.value.login as Maybe<string>,
    },
  }
})

const loginSchema = [
  {
    name: 'login',
    type: 'text',
    label: __('Username / Email'),
    required: true,
  },
  {
    name: 'password',
    label: __('Password'),
    type: 'password',
    required: true,
  },
  {
    isLayout: true,
    element: 'div',
    attrs: {
      class: 'flex grow items-center justify-between',
    },
    children: [
      {
        type: 'checkbox',
        name: 'rememberMe',
        label: __('Remember me'),
        value: false,
      },
      {
        if: '$userLostPassword === true',
        isLayout: true,
        component: 'CommonLink',
        props: {
          class: 'text-right text-sm',
          link: passwordResetLink,
        },
        children: '$t("Forgot password?")',
      },
    ],
  },
]

const userLostPassword = computed(() => application.config.user_lost_password)

const schemaData = reactive({
  userLostPassword,
})

const formInitialValues: FormValues = {}
const formChangeFields = reactive<Record<string, Partial<FormSchemaField>>>({})

const { verifyTokenResult, verifyTokenMessage, verifyTokenAlertVariant } =
  useAdminPasswordAuthVerify({
    formChangeFields,
    formInitialValues,
  })

const showPasswordLogin = computed(
  () =>
    application.config.user_show_password_login ||
    !hasEnabledProviders.value ||
    verifyTokenResult?.value,
)

const { switchValue, toggleBetaUiSwitch } = useBetaUi()
</script>

<template>
  <div
    class="grid min-h-screen bg-[var(--sh-page)] text-[var(--sh-ink)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
  >
    <!-- Brand panel in the application colour (Administration → Branding) -->
    <aside
      class="relative flex flex-col justify-between gap-8 overflow-hidden bg-app px-6 py-8 text-on-app md:px-11 md:py-12"
      :aria-label="$t('About Student Hub')"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -bottom-28 hidden h-[340px] w-[340px] rounded-full border-[56px] border-white/[0.07] md:block rtl:-left-28 ltr:-right-28"
      />
      <div class="relative z-10 flex flex-col gap-4">
        <div class="flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-white shadow-lg">
          <img :src="studentHubLogo" alt="Student Hub" class="h-[60px] w-[60px] object-contain" />
        </div>
        <p class="text-3xl leading-tight font-bold tracking-tight md:text-[34px]">Student Hub</p>
        <p class="text-lg text-white/90">{{ $t('Your support, simplified.') }}</p>
        <p class="max-w-[36ch] text-white/80">
          {{
            $t(
              'IT and student support for LSST, FSB and UKBC. Ask for help, follow your requests and find answers in one place.',
            )
          }}
        </p>
      </div>
      <div class="relative z-10 flex flex-col gap-2.5">
        <span class="text-[11.5px] font-semibold tracking-widest text-white/75 uppercase">
          {{ $t('Supported institutions') }}
        </span>
        <div class="studenthub-institutions flex flex-wrap items-center gap-2.5">
        <a href="https://www.lsst.ac/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
          <img :src="lsstImg" class="h-10 sm:h-11 w-auto object-contain" alt="LSST" />
        </a>
                <a href="https://fsb.ac.uk/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
          <img :src="fsbImg" class="h-10 sm:h-11 w-auto object-contain" alt="FSB" />
        </a>
                <a href="https://ukbusinesscollege.org/" target="_blank" rel="noopener noreferrer" class="hover:scale-105 transition-transform duration-150">
          <img :src="ukbcImg" class="h-10 sm:h-11 w-auto object-contain rounded-lg" alt="UKBC" />
        </a>
        </div>
      </div>
    </aside>

    <!-- Sign-in -->
    <main class="flex items-center justify-center px-5 py-10">
      <div class="card-enter flex w-full max-w-[400px] flex-col gap-4">
        <div>
          <h1 class="text-[26px] leading-tight font-bold tracking-tight">{{ $t('Sign in to Student Hub') }}</h1>
          <p class="mt-1 text-[var(--sh-ink-2)]">
            {{
              hasEnabledProviders
                ? $t('Use your college Microsoft account.')
                : $t('Sign in with your Student Hub account.')
            }}
          </p>
        </div>

      <!-- MAINTENANCE / ALERTS -->
      <div v-if="$c.maintenance_mode" class="mb-3 rounded-xl bg-red-500 px-4 py-2.5 text-xs text-white">
        {{
          $t(
            'Zammad is currently in maintenance mode. Only administrators can log in. Please wait until the maintenance window is over.',
          )
        }}
      </div>
      <!-- eslint-disable vue/no-v-html -->
      <div
        v-if="$c.maintenance_login && $c.maintenance_login_message"
        class="mb-3 rounded-xl bg-green-500 px-4 py-2.5 text-xs text-white"
        v-html="$c.maintenance_login_message"
      ></div>

      <CommonAlert v-if="verifyTokenMessage" class="mb-3" :variant="verifyTokenAlertVariant">{{
        $t(verifyTokenMessage)
      }}</CommonAlert>

      <!-- Third-party sign-in (Microsoft): posts to /auth/<provider> like Zammad's own buttons -->
      <div v-if="hasEnabledProviders && loginFlow.state === 'credentials'" class="flex w-full flex-col gap-2">
        <form v-for="provider in enabledProviders" :key="provider.name" method="post" :action="provider.url">
          <input type="hidden" name="authenticity_token" :value="csrfToken" />
          <button
            type="submit"
            class="flex h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-[#8c8c8c] bg-white text-[15px] font-semibold text-[#3b3b3b] transition-colors hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sh-app)]"
          >
            <svg
              v-if="provider.name === EnumAuthenticationProvider.MicrosoftOffice365"
              class="h-[19px] w-[19px]"
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              <rect width="8.5" height="8.5" fill="#f25022" />
              <rect x="9.5" width="8.5" height="8.5" fill="#7fba00" />
              <rect y="9.5" width="8.5" height="8.5" fill="#00a4ef" />
              <rect x="9.5" y="9.5" width="8.5" height="8.5" fill="#ffb900" />
            </svg>
            <CommonIcon v-else :name="provider.icon" size="small" decorative />
            <span>{{
              provider.name === EnumAuthenticationProvider.MicrosoftOffice365
                ? $t('Continue with Microsoft')
                : $t('Continue with %s', provider.label)
            }}</span>
          </button>
        </form>
      </div>

      <!-- DIVIDER -->
      <div v-if="hasEnabledProviders && showPasswordLogin && loginFlow.state === 'credentials'" class="flex items-center gap-3">
        <div class="h-px flex-1 bg-[var(--sh-line)]"></div>
        <span class="text-xs text-[var(--sh-muted)]">{{ $t('or') }}</span>
        <div class="h-px flex-1 bg-[var(--sh-line)]"></div>
      </div>

      <!-- ADMIN / LOCAL LOGIN SECTION -->
      <template v-if="showPasswordLogin">
        <CommonAlert v-if="passwordLoginErrorMessage" class="mb-3" variant="danger">{{
          $t(passwordLoginErrorMessage)
        }}</CommonAlert>

        <!-- ADMIN / LOCAL LOGIN TRIGGER (FIX 1) -->
        <div v-if="hasEnabledProviders && loginFlow.state === 'credentials'" class="w-full mb-2">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[var(--sh-line)] bg-white px-3.5 py-3 text-sm font-semibold text-[var(--sh-ink)] transition-colors hover:bg-[var(--sh-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sh-app)]"
            :aria-expanded="showLocalLogin"
            @click="showLocalLogin = !showLocalLogin"
          >
            <span>{{ $t('Admin / Local Login') }}</span>
            <svg
              class="h-4 w-4 text-[var(--sh-muted)] transition-transform duration-300"
              :class="{ 'rotate-180': showLocalLogin }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <!-- ACCORDION BODY -->
        <div
          class="accordion-body"
          :class="{ open: !hasEnabledProviders || !showPasswordLogin || showLocalLogin || loginFlow.state !== 'credentials' }"
        >
          <div class="pt-2">
            <Form
              v-if="loginFlow.state === 'credentials' && showPasswordLogin"
              id="login"
              ref="form"
              form-class="mb-2.5 space-y-3"
              :schema="loginSchema"
              :schema-data="schemaData"
              :initial-values="formInitialValues"
              :change-fields="formChangeFields"
              @submit="login($event as FormSubmitData<LoginCredentials>)"
            >
              <template #after-fields>
                <!-- REGISTER LINE STYLING -->
                <div v-if="$c.user_create_account" class="my-3 text-center text-sm text-[var(--sh-ink-2)]">
                  <span>{{ $t('New user?') }}</span>
                  <CommonLink link="/signup" class="studenthub-link rtl:mr-1 ltr:ml-1" size="medium">{{
                    $t('Register')
                  }}</CommonLink>
                </div>
                <button
                  type="submit"
                  :disabled="isDisabled || isLoggingIn"
                  class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-app text-sm font-semibold text-on-app transition-colors hover:bg-app-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sh-app)] disabled:cursor-not-allowed disabled:opacity-75"
                >
                  <template v-if="isLoggingIn">
                    <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{{ $t('Signing in...') }}</span>
                  </template>
                  <template v-else>
                    <span>{{ $t('Sign in') }}</span>
                  </template>
                </button>
              </template>
            </Form>

            <LoginTwoFactor
              v-else-if="loginFlow.state === '2fa' && twoFactorPlugin && loginFlow.credentials"
              :credentials="loginFlow.credentials"
              :two-factor="twoFactorPlugin"
              @error="showError"
              @clear-error="clearError"
              @finish="finishLogin"
            />
            <LoginRecoveryCode
              v-else-if="loginFlow.state === 'recovery-code' && loginFlow.credentials"
              :credentials="loginFlow.credentials"
              @error="showError"
              @clear-error="clearError"
              @finish="finishLogin"
            />
            <LoginTwoFactorMethods
              v-else-if="loginFlow.state === '2fa-select'"
              :methods="twoFactorAllowedMethods"
              :default-method="loginFlow.defaultMethod"
              :recovery-codes-available="loginFlow.recoveryCodesAvailable"
              @select="updateSecondFactor"
              @use-recovery-code="updateState('recovery-code')"
              @cancel="cancelAndGoBack()"
            />

            <section
              v-if="
                (loginFlow.state === '2fa' || loginFlow.state === 'recovery-code') &&
                hasAlternativeLoginMethod
              "
              class="mt-3 text-center"
            >
              <CommonLabel>
                {{ $t('Having problems?') }}
                <CommonLink link="#" class="studenthub-link select-none" size="medium" @click="updateState('2fa-select')">
                  {{ $t('Try another method') }}
                </CommonLink>
              </CommonLabel>
            </section>
          </div>
        </div>
      </template>

        <p class="text-center text-sm text-[var(--sh-ink-2)]">
          {{ $t('Trouble signing in? Contact the IT Service Desk.') }}
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-enter {
  animation: cardIn 350ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .card-enter {
    animation: none;
  }
}

/* Institution logos sit on white tiles in the brand panel. */
.studenthub-institutions a {
  display: grid;
  place-items: center;
  height: 3.375rem;
  min-width: 5.25rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.625rem;
  background: #ffffff;
}

.studenthub-institutions img {
  max-height: 2.375rem;
  width: auto;
}

.studenthub-link {
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.accordion-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 300ms ease;
}

.accordion-body.open {
  max-height: 400px;
}

/* Clean up FormKit inner container to prevent double concentric boxes */
:deep(.formkit-inner) {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  position: relative !important;
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.formkit-wrapper) {
  width: 100% !important;
}

/* Style single clean input box */
:deep(.formkit-input),
:deep(input[type='text']),
:deep(input[type='password']),
:deep(input[type='email']) {
  width: 100% !important;
  height: 2.75rem !important;
  background-color: #ffffff !important;
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 0.5rem !important;
  padding-left: 1rem !important;
  padding-right: 2.5rem !important;
  font-size: 0.875rem !important;
  color: #0f172a !important; /* text-slate-900 */
  outline: none !important;
  box-shadow: none !important;
  transition: all 150ms ease !important;
  margin: 0 !important;
}

:deep(.formkit-input:focus),
:deep(input[type='text']:focus),
:deep(input[type='password']:focus),
:deep(input[type='email']:focus) {
  border-color: var(--sh-app) !important; /* border-blue-500 */
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--sh-app) 18%, transparent) !important;
}

:deep(input[type='text']::placeholder),
:deep(input[type='password']::placeholder),
:deep(input[type='email']::placeholder) {
  color: #94a3b8 !important; /* text-slate-400 */
}

/* Password eye button - clean & transparent absolute positioning */
:deep(.formkit-suffix),
:deep(.formkit-icon),
:deep(.formkit-inner button),
:deep(div:has(> input[type='password']) button),
:deep(.form-field-password button),
:deep(button[tabindex='-1']) {
  position: absolute !important;
  right: 0.75rem !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #9ca3af !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: pointer !important;
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

/* REMEMBER ME - FormKit checkbox & label styling */
:deep(.formkit-outer[data-type='checkbox']),
:deep(.formkit-outer[data-type='checkbox'] .formkit-wrapper),
:deep(.formkit-outer[data-type='checkbox'] label),
:deep([data-test-id='checkbox-label']) {
  display: inline-flex !important;
  align-items: center !important;
  flex-direction: row !important;
  gap: 0.5rem !important;
  color: #4b5563 !important; /* text-gray-600 */
  font-size: 0.75rem !important; /* text-xs */
  font-weight: 500 !important;
  cursor: pointer !important;
  white-space: nowrap !important;
}

:deep(.formkit-outer[data-type='checkbox'] input[type='checkbox']) {
  position: absolute !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  pointer-events: none !important;
}

:deep(.formkit-outer[data-type='checkbox'] .formkit-label) {
  display: inline-block !important;
  color: #4b5563 !important;
  font-size: 0.75rem !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  margin: 0 !important;
}

:deep(.formkit-decorator) {
  width: 1rem !important;
  height: 1rem !important;
  min-width: 1rem !important;
  min-height: 1rem !important;
  border: 1.5px solid #d1d5db !important;
  border-radius: 0.25rem !important;
  background-color: #ffffff !important;
}

:deep([data-is-checked='true'] .formkit-decorator) {
  background-color: var(--sh-app) !important;
  border-color: var(--sh-app) !important;
  color: #ffffff !important;
}

:deep(a) {
  color: var(--sh-app) !important;
  font-size: 0.75rem !important;
  transition: color 150ms ease !important;
}

:deep(a:hover) {
  color: var(--sh-app-hover) !important;
}
</style>
