<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useLocaleStore } from '#shared/stores/locale.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface TranslationRecord {
  id: number
  source: string
  target: string
  target_initial?: string
  locale: string
  is_synchronized_from_codebase: boolean
}

interface SuggestionItem {
  id?: number
  source: string
  target_initial?: string
  is_synchronized_from_codebase?: boolean
}

const router = useRouter()
const localeStore = useLocaleStore()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Translations') },
]

const customizedTranslations = ref<TranslationRecord[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedLocaleFilter = ref('all')
const successMessage = ref('')
const errorMessage = ref('')

// New Translation Modal state
const newModal = ref<{
  isOpen: boolean
  locale: string
  searchQuery: string
  source: string
  target: string
  targetInitial: string
  suggestions: SuggestionItem[]
  isLoadingSuggestions: boolean
  isSaving: boolean
  totalSuggestionsCount: number
}>({
  isOpen: false,
  locale: 'en-us',
  searchQuery: '',
  source: '',
  target: '',
  targetInitial: '',
  suggestions: [],
  isLoadingSuggestions: false,
  isSaving: false,
  totalSuggestionsCount: 0,
})

// Edit Modal state
const editModal = ref<{
  isOpen: boolean
  id?: number
  locale: string
  source: string
  target: string
  targetInitial: string
  isSaving: boolean
}>({
  isOpen: false,
  locale: '',
  source: '',
  target: '',
  targetInitial: '',
  isSaving: false,
})

// Reset Modal state
const resetModal = ref<{
  isOpen: boolean
  item: TranslationRecord | null
  isResetting: boolean
}>({
  isOpen: false,
  item: null,
  isResetting: false,
})

// Delete Modal state
const deleteModal = ref<{
  isOpen: boolean
  item: TranslationRecord | null
  isDeleting: boolean
}>({
  isOpen: false,
  item: null,
  isDeleting: false,
})

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

const fallbackLocales = [
  { locale: 'en-us', name: __('English (United States)') },
  { locale: 'de-de', name: __('Deutsch') },
  { locale: 'fr-fr', name: __('Français') },
  { locale: 'es-es', name: __('Español') },
  { locale: 'it-it', name: __('Italiano') },
  { locale: 'nl-nl', name: __('Nederlands') },
  { locale: 'pt-br', name: __('Português (Brasil)') },
  { locale: 'ru-ru', name: __('Русский') },
  { locale: 'zh-cn', name: __('简体中文') },
  { locale: 'ja-jp', name: __('日本語') },
]

const availableLocales = computed(() => {
  if (localeStore.locales && localeStore.locales.length > 0) {
    return localeStore.locales.map((loc) => ({
      locale: loc.locale,
      name: loc.name || loc.alias || loc.locale,
    }))
  }
  return fallbackLocales
})

const getLocaleName = (locCode: string): string => {
  const found = availableLocales.value.find((l) => l.locale.toLowerCase() === locCode.toLowerCase())
  return found ? found.name : locCode
}

const fetchCustomizedTranslations = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/translations/customized', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data = await res.json()
    customizedTranslations.value = Array.isArray(data) ? data : []
  } catch (err: unknown) {
    errorMessage.value =
      err instanceof Error ? err.message : __('Failed to load customized translations.')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  try {
    await localeStore.loadLocales()
  } catch {
    // Keep fallback locales if GraphQL fails
  }
  await fetchCustomizedTranslations()
})

const filteredTranslations = computed(() => {
  return customizedTranslations.value.filter((tr) => {
    if (
      selectedLocaleFilter.value !== 'all' &&
      tr.locale.toLowerCase() !== selectedLocaleFilter.value.toLowerCase()
    ) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const matchSource = tr.source.toLowerCase().includes(q)
      const matchTarget = tr.target.toLowerCase().includes(q)
      const matchInitial = tr.target_initial ? tr.target_initial.toLowerCase().includes(q) : false
      if (!matchSource && !matchTarget && !matchInitial) return false
    }
    return true
  })
})

const loadSuggestions = async () => {
  newModal.value.isLoadingSuggestions = true
  try {
    const { locale, searchQuery: q } = newModal.value
    const url = `/api/v1/translations/search/${encodeURIComponent(locale)}?query=${encodeURIComponent(q.trim())}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    const data = await res.json()
    newModal.value.suggestions = Array.isArray(data.items) ? data.items : []
    newModal.value.totalSuggestionsCount = data.total_count || 0
  } catch {
    newModal.value.suggestions = []
    newModal.value.totalSuggestionsCount = 0
  } finally {
    newModal.value.isLoadingSuggestions = false
  }
}

const openNewTranslationModal = () => {
  const defaultLocale = availableLocales.value[0]?.locale || 'en-us'
  newModal.value = {
    isOpen: true,
    locale: defaultLocale,
    searchQuery: '',
    source: '',
    target: '',
    targetInitial: '',
    suggestions: [],
    isLoadingSuggestions: false,
    isSaving: false,
    totalSuggestionsCount: 0,
  }
  void loadSuggestions()
}

const onSuggestionsSearchInput = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    void loadSuggestions()
  }, 350)
}

const selectSuggestion = (s: SuggestionItem) => {
  newModal.value.source = s.source
  newModal.value.targetInitial = s.target_initial || ''
  if (!newModal.value.target) {
    newModal.value.target = s.target_initial || ''
  }
}

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const saveNewTranslation = async () => {
  const { source, target, locale } = newModal.value
  if (!source.trim()) {
    errorMessage.value = __('Please enter or select a source string.')
    return
  }
  if (!target.trim()) {
    errorMessage.value = __('Please provide a custom translation.')
    return
  }

  newModal.value.isSaving = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/translations/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        source: source.trim(),
        target: target.trim(),
        locale,
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${res.status}`)
    }
    newModal.value.isOpen = false
    successMessage.value = __('Translation saved successfully.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchCustomizedTranslations()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to save translation.')
  } finally {
    newModal.value.isSaving = false
  }
}

const openEditModal = (tr: TranslationRecord) => {
  editModal.value = {
    isOpen: true,
    id: tr.id,
    locale: tr.locale,
    source: tr.source,
    target: tr.target,
    targetInitial: tr.target_initial || '',
    isSaving: false,
  }
}

const saveEditTranslation = async () => {
  const { source, target, locale } = editModal.value
  if (!target.trim()) {
    errorMessage.value = __('Please provide a custom translation.')
    return
  }

  editModal.value.isSaving = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/v1/translations/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        source,
        target: target.trim(),
        locale,
      }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error_human || errData.message || `HTTP error ${res.status}`)
    }
    editModal.value.isOpen = false
    successMessage.value = __('Custom translation updated.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchCustomizedTranslations()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to update translation.')
  } finally {
    editModal.value.isSaving = false
  }
}

const confirmResetTranslation = (tr: TranslationRecord) => {
  resetModal.value = {
    isOpen: true,
    item: tr,
    isResetting: false,
  }
}

const executeResetTranslation = async () => {
  if (!resetModal.value.item) return
  resetModal.value.isResetting = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/translations/reset/${resetModal.value.item.id}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    resetModal.value.isOpen = false
    successMessage.value = __('Translation reset to original value.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchCustomizedTranslations()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to reset translation.')
  } finally {
    resetModal.value.isResetting = false
  }
}

const confirmDeleteTranslation = (tr: TranslationRecord) => {
  deleteModal.value = {
    isOpen: true,
    item: tr,
    isDeleting: false,
  }
}

const executeDeleteTranslation = async () => {
  if (!deleteModal.value.item) return
  deleteModal.value.isDeleting = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/translations/${deleteModal.value.item.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    deleteModal.value.isOpen = false
    successMessage.value = __('Custom translation removed.')
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
    await fetchCustomizedTranslations()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : __('Failed to delete translation.')
  } finally {
    deleteModal.value.isDeleting = false
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <button
                type="button"
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                :title="__('Back to Administration')"
                :aria-label="__('Back to Administration')"
                @click="router.push('/manage')"
              >
                <CommonIcon name="arrow-left" class="h-4 w-4" />
              </button>
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                >
                  <CommonIcon name="translate" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Translations') }}
                </h1>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ __('System') }}
              </span>
            </div>
            <p class="text-sm text-slate-500 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
              {{
                __(
                  'Customize UI phrases, localize terminology, and adapt application strings for your organization.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              :aria-label="__('New Translation')"
              @click="openNewTranslationModal"
            >
              <CommonIcon name="plus" class="h-4 w-4" />
              {{ __('New Translation') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div
        v-if="successMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        role="status"
      >
        <CommonIcon name="check2" class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span class="flex-1">{{ successMessage }}</span>
        <button
          type="button"
          class="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
        role="alert"
      >
        <CommonIcon
          name="exclamation-triangle"
          class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <span class="flex-1">{{ errorMessage }}</span>
        <button
          type="button"
          class="text-red-600 hover:text-red-800 dark:text-red-400"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="h-4 w-4" />
        </button>
      </div>

      <!-- Community Callout Box -->
      <div
        class="mb-6 flex items-start justify-between rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200"
      >
        <div class="flex items-start space-x-3 rtl:space-x-reverse">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
          >
            <CommonIcon name="weblate" class="h-5 w-5" />
          </div>
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <span class="text-sm font-bold">
                {{ __('Contribute translations to the community!') }}
              </span>
              <span
                class="text-3xs rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
              >
                Weblate
              </span>
            </div>
            <p class="mt-0.5 text-blue-800/90 dark:text-blue-300/80">
              {{
                __(
                  'Did you know that system translations can be contributed and shared with everyone on our public platform translations.zammad.org? It sports a convenient user interface based on Weblate.',
                )
              }}
            </p>
          </div>
        </div>
        <a
          href="https://translations.zammad.org"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex shrink-0 items-center rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-xs transition hover:bg-blue-50 ltr:ml-4 rtl:mr-4 dark:border-blue-700 dark:bg-[#1e293b] dark:text-blue-300 dark:hover:bg-slate-800"
        >
          <CommonIcon name="weblate" class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
          <span>{{ __('Weblate Portal') }}</span>
          <CommonIcon name="box-arrow-up-right" class="h-3 w-3 ltr:ml-1.5 rtl:mr-1.5" />
        </a>
      </div>

      <!-- Filters & Search -->
      <div
        class="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="relative w-full max-w-sm">
          <div class="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
            <CommonIcon name="search" class="h-4 w-4 text-slate-400 dark:text-slate-500" />
          </div>
          <input
            id="search-translations"
            v-model="searchQuery"
            type="search"
            class="block w-full rounded-xl border border-slate-300 bg-slate-50/60 py-2 ps-9 pe-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-500"
            :placeholder="__('Filter customized translations...')"
            :aria-label="__('Filter customized translations')"
          />
        </div>

        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <label for="filter-locale" class="text-xs font-medium text-slate-500 dark:text-slate-400">
            {{ __('Target Language:') }}
          </label>
          <select
            id="filter-locale"
            v-model="selectedLocaleFilter"
            class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            :aria-label="__('Filter by language')"
          >
            <option value="all">{{ __('All Languages') }}</option>
            <option v-for="loc in availableLocales" :key="loc.locale" :value="loc.locale">
              {{ loc.name }} ({{ loc.locale }})
            </option>
          </select>
        </div>
      </div>

      <!-- Translations Table -->
      <div
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div v-if="isLoading" class="p-12 text-center">
          <CommonIcon name="loading" class="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {{ __('Loading customized translations...') }}
          </p>
        </div>

        <div v-else-if="filteredTranslations.length === 0" class="p-12 text-center">
          <div
            class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          >
            <CommonIcon name="translate" class="h-6 w-6" />
          </div>
          <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
            {{ __('No customized translations found') }}
          </h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{
              searchQuery
                ? __('No translations matched your filter.')
                : __('All terms currently use the default codebase translations.')
            }}
          </p>
          <button
            v-if="!searchQuery"
            type="button"
            class="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
            :aria-label="__('Add Custom Translation')"
            @click="openNewTranslationModal"
          >
            <CommonIcon name="plus" class="h-4 w-4" />
            {{ __('Add Custom Translation') }}
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-start text-sm text-slate-600 dark:text-slate-300">
            <thead
              class="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Translation Source') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Original Translation') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Custom Translation') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-start">
                  {{ __('Target Language') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Type') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-end">
                  {{ __('Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
              <tr
                v-for="tr in filteredTranslations"
                :key="tr.id"
                class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
              >
                <!-- Source -->
                <td class="max-w-xs px-6 py-4 font-medium text-slate-900 dark:text-white">
                  <div class="line-clamp-2" :title="tr.source">
                    {{ tr.source }}
                  </div>
                </td>

                <!-- Original -->
                <td class="max-w-xs px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                  <div class="line-clamp-2" :title="tr.target_initial || tr.source">
                    {{ tr.target_initial || tr.source }}
                  </div>
                </td>

                <!-- Custom Translation -->
                <td
                  class="max-w-xs px-6 py-4 text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  <div class="line-clamp-2" :title="tr.target">
                    {{ tr.target }}
                  </div>
                </td>

                <!-- Target Language -->
                <td class="px-6 py-4 text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                  <span
                    class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {{ getLocaleName(tr.locale) }}
                  </span>
                </td>

                <!-- Type -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="
                      tr.is_synchronized_from_codebase
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                    "
                  >
                    {{ tr.is_synchronized_from_codebase ? __('system') : __('custom') }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-end whitespace-nowrap">
                  <div class="flex items-center justify-end space-x-1 rtl:space-x-reverse">
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      :title="__('Edit')"
                      :aria-label="__('Edit translation %s', tr.source)"
                      @click="openEditModal(tr)"
                    >
                      <CommonIcon name="pen" class="h-4 w-4" />
                    </button>
                    <!-- Reset button for synchronized translations -->
                    <button
                      v-if="tr.is_synchronized_from_codebase"
                      type="button"
                      class="rounded-lg p-1.5 text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      :title="__('Reset to Original')"
                      :aria-label="__('Reset translation %s', tr.source)"
                      @click="confirmResetTranslation(tr)"
                    >
                      <CommonIcon name="reload" class="h-4 w-4" />
                    </button>
                    <!-- Delete button for purely custom non-codebase translations -->
                    <button
                      v-else
                      type="button"
                      class="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      :title="__('Remove')"
                      :aria-label="__('Remove translation %s', tr.source)"
                      @click="confirmDeleteTranslation(tr)"
                    >
                      <CommonIcon name="trash" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- New Translation Modal -->
      <div
        v-if="newModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('New Translation')"
      >
        <div
          class="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800"
          >
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                {{ __('New Custom Translation') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Select an existing UI phrase to override or enter a custom translation.') }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              :aria-label="__('Close')"
              @click="newModal.isOpen = false"
            >
              <CommonIcon name="close" class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-4 space-y-4">
            <!-- Language Selector -->
            <div>
              <label
                for="new-locale-select"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Target Language') }} *
              </label>
              <select
                id="new-locale-select"
                v-model="newModal.locale"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                @change="loadSuggestions"
              >
                <option v-for="loc in availableLocales" :key="loc.locale" :value="loc.locale">
                  {{ loc.name }} ({{ loc.locale }})
                </option>
              </select>
            </div>

            <!-- Search phrase suggestions -->
            <div>
              <label
                for="search-phrase-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Search System Phrases') }}
              </label>
              <div class="relative mt-1">
                <input
                  id="search-phrase-input"
                  v-model="newModal.searchQuery"
                  type="search"
                  class="block w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  :placeholder="__('Type to search source text in codebase...')"
                  @input="onSuggestionsSearchInput"
                />
                <div
                  v-if="newModal.isLoadingSuggestions"
                  class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3"
                >
                  <CommonIcon name="loading" class="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>

              <!-- Suggestions List -->
              <div
                v-if="newModal.suggestions.length > 0"
                class="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1 text-xs dark:border-slate-700 dark:bg-slate-800/50"
              >
                <button
                  v-for="(sug, idx) in newModal.suggestions"
                  :key="idx"
                  type="button"
                  class="w-full rounded-lg px-2.5 py-1.5 text-start transition hover:bg-blue-50 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                  :class="
                    newModal.source === sug.source
                      ? 'bg-blue-100 font-medium text-blue-900 dark:bg-blue-900/50 dark:text-blue-200'
                      : 'text-slate-700 dark:text-slate-300'
                  "
                  :aria-label="__('Select suggestion %s', sug.source)"
                  @click="selectSuggestion(sug)"
                >
                  <div class="flex items-center justify-between">
                    <span class="truncate">{{ sug.source }}</span>
                    <span class="text-2xs shrink-0 text-slate-400 italic ltr:ml-2 rtl:mr-2">
                      {{ sug.target_initial || __('No translation') }}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Source String -->
            <div>
              <label
                for="new-source-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Translation Source (Original Key/String)') }} *
              </label>
              <textarea
                id="new-source-input"
                v-model="newModal.source"
                rows="2"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                :placeholder="__('e.g. Ticket')"
                required
              />
            </div>

            <!-- Custom Translation -->
            <div>
              <label
                for="new-target-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Custom Translation') }} *
              </label>
              <textarea
                id="new-target-input"
                v-model="newModal.target"
                rows="2"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                :placeholder="newModal.targetInitial || __('Enter customized phrase here...')"
                required
              />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Cancel')"
              @click="newModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              :disabled="newModal.isSaving"
              :aria-label="__('Save Translation')"
              @click="saveNewTranslation"
            >
              <CommonIcon
                v-if="newModal.isSaving"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Save Translation') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <div
        v-if="editModal.isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Edit Translation')"
      >
        <div
          class="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div
            class="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800"
          >
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                {{ __('Edit Translation') }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ getLocaleName(editModal.locale) }} ({{ editModal.locale }})
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              :aria-label="__('Close')"
              @click="editModal.isOpen = false"
            >
              <CommonIcon name="close" class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-4 space-y-4">
            <div>
              <label
                for="edit-source-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Translation Source') }}
              </label>
              <textarea
                id="edit-source-input"
                readonly
                :value="editModal.source"
                rows="2"
                class="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              />
            </div>

            <div v-if="editModal.targetInitial">
              <label
                for="edit-initial-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Original Translation') }}
              </label>
              <input
                id="edit-initial-input"
                readonly
                type="text"
                :value="editModal.targetInitial"
                class="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>

            <div>
              <label
                for="edit-target-input"
                class="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {{ __('Custom Translation') }} *
              </label>
              <textarea
                id="edit-target-input"
                v-model="editModal.target"
                rows="3"
                class="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              :aria-label="__('Cancel')"
              @click="editModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              :disabled="editModal.isSaving"
              :aria-label="__('Save Changes')"
              @click="saveEditTranslation"
            >
              <CommonIcon
                v-if="editModal.isSaving"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Save Changes') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Reset Confirmation Modal -->
      <div
        v-if="resetModal.isOpen && resetModal.item"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Reset Translation Confirmation')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            >
              <CommonIcon name="reload" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Reset Translation?') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Are you sure you want to reset "%s" to its original translation ("%s")?',
                    resetModal.item.source,
                    resetModal.item.target_initial || resetModal.item.source,
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="resetModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
              :disabled="resetModal.isResetting"
              :aria-label="__('Reset Translation')"
              @click="executeResetTranslation"
            >
              <CommonIcon
                v-if="resetModal.isResetting"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Reset Translation') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div
        v-if="deleteModal.isOpen && deleteModal.item"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Confirm Deletion')"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex items-center space-x-3 rtl:space-x-reverse">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              <CommonIcon name="trash" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                {{ __('Delete Translation') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{
                  __(
                    'Are you sure you want to remove the custom translation for "%s"?',
                    deleteModal.item.source,
                  )
                }}
              </p>
            </div>
          </div>
          <div class="mt-6 flex items-center justify-end space-x-3 rtl:space-x-reverse">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              :aria-label="__('Cancel')"
              @click="deleteModal.isOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:opacity-50"
              :disabled="deleteModal.isDeleting"
              :aria-label="__('Delete Translation')"
              @click="executeDeleteTranslation"
            >
              <CommonIcon
                v-if="deleteModal.isDeleting"
                name="loading"
                class="h-3.5 w-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
              />
              {{ __('Delete Translation') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
