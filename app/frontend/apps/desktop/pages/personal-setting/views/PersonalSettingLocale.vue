<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useLocaleUpdate } from '#shared/composables/useLocaleUpdate.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

import { useBreadcrumb } from '../composables/useBreadcrumb.ts'
import { usePersonalSettingTabs } from '../composables/usePersonalSettingTabs.ts'

const user = toRef(useSessionStore(), 'user')
const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

const { modelCurrentLocale, localeOptions, isSavingLocale, translation } = useLocaleUpdate()

const { breadcrumbItems } = useBreadcrumb(__('Language'))

const { tabs, activeTab } = usePersonalSettingTabs()
</script>

<template>
  <!-- CUSTOMER REDESIGNED LOCALE VIEW -->
  <div v-if="isCustomer" class="max-w-3xl space-y-6">
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
        <router-link to="/" class="hover:text-slate-600 transition-colors">{{ $t('Dashboard') }}</router-link>
        <span>/</span>
        <span class="text-slate-600">{{ $t('Settings') }}</span>
        <span>/</span>
        <span class="text-[#15803d] font-bold">{{ $t('Language') }}</span>
      </div>
      <h1 class="text-2xl font-black text-slate-900 tracking-tight">
        {{ $t('Language Preferences') }}
      </h1>
      <p class="text-sm text-slate-500 mt-1">
        {{ $t('Select the primary language you would like to use across the Student Support Portal.') }}
      </p>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-6">
      <div class="max-w-md">
        <FormKit
          v-model="modelCurrentLocale"
          type="select"
          name="locale"
          :label="$t('Your language')"
          :clearable="false"
          :disabled="isSavingLocale"
          :no-options-label-translation="true"
          sorting="value"
          :options="localeOptions"
        />
      </div>

      <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 text-xs text-slate-500">
        <svg class="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          {{ $t('Changes to your preferred language take effect immediately across all screens.') }}
        </span>
      </div>
    </div>
  </div>

  <!-- AGENT UNTOUCHED LOCALE VIEW -->
  <LayoutContent
    v-else
    :active-tab="activeTab"
    :tabs="tabs"
    :breadcrumb-items="breadcrumbItems"
    width="narrow"
    provide-default
  >
    <div class="mb-4">
      <FormKit
        v-model="modelCurrentLocale"
        type="select"
        name="locale"
        :clearable="false"
        :label="$t('Your language')"
        :disabled="isSavingLocale"
        :no-options-label-translation="true"
        sorting="value"
        :options="localeOptions"
      />

      <p class="mt-4 text-sm">
        {{ $t('Did you know?') }}
        <CommonLink :link="translation.link" size="medium" open-in-new-tab>
          {{ $t('You can help translating Zammad.') }}
        </CommonLink>
      </p>
    </div>
  </LayoutContent>
</template>
