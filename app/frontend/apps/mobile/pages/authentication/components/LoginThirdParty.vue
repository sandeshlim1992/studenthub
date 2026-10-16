<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'
import type { ThirdPartyAuthProvider } from '#shared/types/authentication.ts'

export interface Props {
  providers: ThirdPartyAuthProvider[]
}

defineProps<Props>()

const csrfToken = getCSRFToken()
</script>

<template>
  <!-- Student Hub: shown first, above the local login (design option 5). -->
  <section class="w-full max-w-md" data-test-id="loginThirdParty">
    <p class="mb-5 text-base text-gray">
      {{ $t('Use your college Microsoft account.') }}
    </p>
    <div class="-m-2 flex flex-wrap p-1">
      <form
        v-for="provider of providers"
        :key="provider.name"
        class="flex min-w-1/2 grow"
        method="post"
        :action="provider.url"
      >
        <input type="hidden" name="authenticity_token" :value="csrfToken" />
        <button
          class="m-1 flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-blue px-4 py-2 font-semibold select-none"
        >
          <CommonIcon
            :name="provider.icon"
            size="base"
            decorative
            class="shrink-0 ltr:mr-2.5 rtl:ml-2.5"
          />
          <span class="truncate text-lg leading-7">
            {{ $t('Sign in with %s', $t(provider.label)) }}
          </span>
        </button>
      </form>
    </div>
  </section>
</template>
