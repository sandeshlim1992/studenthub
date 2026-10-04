<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

import { feedbackApi } from '../components/FeedbackCollection/api.ts'
import FeedbackCollectionReport from '../components/FeedbackCollection/FeedbackCollectionReport.vue'
import FeedbackCollectionResponses from '../components/FeedbackCollection/FeedbackCollectionResponses.vue'
import FeedbackCollectionSettings from '../components/FeedbackCollection/FeedbackCollectionSettings.vue'
import FeedbackCollectionTemplate from '../components/FeedbackCollection/FeedbackCollectionTemplate.vue'

import type { FeedbackSettings } from '../components/FeedbackCollection/types.ts'

type TabKey = 'responses' | 'report' | 'template' | 'settings'

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'responses', label: __('Feedback'), icon: 'chat-left-text' },
  { key: 'report', label: __('Report'), icon: 'star' },
  { key: 'template', label: __('Email template'), icon: 'envelope' },
  { key: 'settings', label: __('Settings'), icon: 'gear' },
]

const router = useRouter()
const route = useRoute()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Feedback Collection') },
]

const initialTab = tabs.find((tab) => tab.key === route.query.tab)?.key ?? 'responses'
const activeTab = ref<TabKey>(initialTab)
const settings = ref<FeedbackSettings | null>(null)
const loadError = ref('')

const selectTab = (key: TabKey) => {
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

const loadSettings = async () => {
  loadError.value = ''
  try {
    settings.value = await feedbackApi.settings()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(loadSettings)
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-7xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="mb-2 flex items-center gap-3">
            <button
              type="button"
              class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
              :title="$t('Back to Administration')"
              :aria-label="$t('Back to Administration')"
              @click="router.push('/manage')"
            >
              <CommonIcon name="arrow-left" class="h-4 w-4" />
            </button>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300"
            >
              <CommonIcon name="star-fill" class="h-4 w-4" />
            </div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {{ $t('Feedback Collection') }}
            </h1>
            <span
              v-if="settings"
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="
                settings.enabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              "
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="settings.enabled ? 'bg-emerald-600' : 'bg-slate-500'"
              />
              {{ settings.enabled ? $t('On') : $t('Off') }}
            </span>
          </div>
          <p class="text-sm text-slate-600 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
            {{
              $t(
                'Customers get a rating request by email when their ticket is closed. Their answers appear here and as an internal note on the ticket.',
              )
            }}
          </p>
        </div>
      </header>

      <div
        role="tablist"
        :aria-label="$t('Feedback Collection')"
        class="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700"
      >
        <button
          v-for="tab in tabs"
          :id="`feedback-tab-${tab.key}`"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :aria-controls="`feedback-panel-${tab.key}`"
          class="-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-800"
          :class="
            activeTab === tab.key
              ? 'border-blue-800 text-blue-800 dark:border-blue-400 dark:text-blue-300'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          "
          @click="selectTab(tab.key)"
        >
          <CommonIcon :name="tab.icon" class="h-4 w-4" />
          {{ $t(tab.label) }}
        </button>
      </div>

      <div
        v-if="loadError"
        role="alert"
        class="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
      >
        {{ loadError }}
      </div>

      <div
        v-if="settings && !settings.enabled && activeTab !== 'settings'"
        class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
      >
        <span>{{ $t('Feedback collection is off. No rating requests are being sent.') }}</span>
        <button
          type="button"
          class="cursor-pointer font-semibold underline underline-offset-2"
          @click="selectTab('settings')"
        >
          {{ $t('Open settings') }}
        </button>
      </div>

      <section
        :id="`feedback-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`feedback-tab-${activeTab}`"
      >
        <FeedbackCollectionResponses v-if="activeTab === 'responses'" />
        <FeedbackCollectionReport v-else-if="activeTab === 'report'" />
        <template v-else-if="settings">
          <FeedbackCollectionTemplate
            v-if="activeTab === 'template'"
            :settings="settings"
            @saved="settings = $event"
          />
          <FeedbackCollectionSettings
            v-else-if="activeTab === 'settings'"
            :settings="settings"
            @saved="settings = $event"
          />
        </template>
      </section>
    </div>
  </LayoutContent>
</template>
