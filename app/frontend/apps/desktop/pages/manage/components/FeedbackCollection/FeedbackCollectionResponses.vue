<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { feedbackApi, type ListParams } from './api.ts'
import FeedbackCollectionStars from './FeedbackCollectionStars.vue'

import type { FeedbackItem } from './types.ts'

const PAGE_SIZES = [10, 25, 50, 100]

const columns: { key: string; label: string; sortable: boolean }[] = [
  { key: 'rated_at', label: __('Date'), sortable: true },
  { key: 'ticket_number', label: __('Ticket'), sortable: true },
  { key: 'owner_name', label: __('Agent'), sortable: true },
  { key: 'customer_name', label: __('Customer'), sortable: true },
  { key: 'customer_email', label: __('Customer email'), sortable: true },
  { key: 'rating', label: __('Rating'), sortable: true },
  { key: 'comments', label: __('Comments'), sortable: false },
]

const states = [
  { value: 'submitted', label: __('Answered') },
  { value: 'sent', label: __('Waiting for answer') },
  { value: 'failed', label: __('Failed to send') },
  { value: 'pending', label: __('Queued') },
]

const params = reactive<ListParams>({
  page: 1,
  per_page: 25,
  sort_by: 'rated_at',
  order_by: 'desc',
  state: 'submitted',
  rating: '',
  from: '',
  to: '',
  query: '',
})

const items = ref<FeedbackItem[]>([])
const total = ref(0)
const isLoading = ref(false)
const errorText = ref('')
const selected = ref<FeedbackItem | null>(null)
const confirmDelete = ref(false)
const isDeleting = ref(false)

const dateColumn = computed(() => (params.state === 'submitted' ? 'rated_at' : 'created_at'))
const firstRow = computed(() => (total.value === 0 ? 0 : (params.page - 1) * params.per_page + 1))
const lastRow = computed(() => Math.min(params.page * params.per_page, total.value))
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / params.per_page)))
const exportUrl = computed(() => feedbackApi.exportUrl(params))

const formatDate = (value: string | null) => {
  if (!value) return '–'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const load = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const result = await feedbackApi.list(params)
    items.value = result.items
    total.value = result.total
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => params.query,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      params.page = 1
      load()
    }, 300)
  },
)

watch(
  () => [params.state, params.rating, params.from, params.to, params.per_page],
  () => {
    params.page = 1
    if (params.state !== 'submitted' && params.sort_by === 'rated_at') params.sort_by = 'created_at'
    if (params.state === 'submitted' && params.sort_by === 'created_at') params.sort_by = 'rated_at'
    load()
  },
)

const sortBy = (key: string) => {
  const column = key === 'rated_at' ? dateColumn.value : key
  if (params.sort_by === column) {
    params.order_by = params.order_by === 'asc' ? 'desc' : 'asc'
  } else {
    params.sort_by = column
    params.order_by = column === 'rated_at' || column === 'created_at' || column === 'rating' ? 'desc' : 'asc'
  }
  load()
}

const sortState = (key: string) => {
  const column = key === 'rated_at' ? dateColumn.value : key
  if (params.sort_by !== column) return 'none'
  return params.order_by === 'asc' ? 'ascending' : 'descending'
}

const goToPage = (page: number) => {
  params.page = Math.min(Math.max(page, 1), pageCount.value)
  load()
}

const open = (item: FeedbackItem) => {
  selected.value = item
  confirmDelete.value = false
}

const close = () => {
  selected.value = null
  confirmDelete.value = false
}

const remove = async () => {
  if (!selected.value) return
  isDeleting.value = true
  try {
    await feedbackApi.remove(selected.value.id)
    close()
    if (items.value.length === 1 && params.page > 1) params.page -= 1
    await load()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    isDeleting.value = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

watch(selected, (value) => {
  if (value) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const stateLabel = (state: string) => states.find((entry) => entry.value === state)?.label ?? state

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <label for="feedback-filter-query" class="flex min-w-56 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('Search') }}
        <span class="relative">
          <CommonIcon name="search" class="pointer-events-none absolute top-2.5 h-4 w-4 text-slate-500 ltr:left-3 rtl:right-3" />
          <input
            id="feedback-filter-query"
            v-model="params.query"
            type="search"
            :placeholder="$t('Ticket, customer, agent or comment')"
            class="h-9 w-full rounded-lg border border-slate-300 bg-white text-sm font-normal text-slate-800 ltr:pl-9 ltr:pr-3 rtl:pl-3 rtl:pr-9 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </span>
      </label>
      <label for="feedback-filter-state" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('Status') }}
        <select
          id="feedback-filter-state"
            v-model="params.state"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option v-for="state in states" :key="state.value" :value="state.value">{{ $t(state.label) }}</option>
        </select>
      </label>
      <label for="feedback-filter-rating" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('Rating') }}
        <select
          id="feedback-filter-rating"
            v-model="params.rating"
          :disabled="params.state !== 'submitted'"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">{{ $t('All ratings') }}</option>
          <option v-for="value in [5, 4, 3, 2, 1]" :key="value" :value="value">{{ $t('%s stars', value) }}</option>
        </select>
      </label>
      <label for="feedback-filter-from" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('From') }}
        <input
          id="feedback-filter-from"
            v-model="params.from"
          type="date"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
      <label for="feedback-filter-to" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('To') }}
        <input
          id="feedback-filter-to"
            v-model="params.to"
          type="date"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
      <a
        :href="exportUrl"
        download
        class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <CommonIcon name="download" class="h-4 w-4" />
        {{ $t('Export CSV') }}
      </a>
    </div>

    <div
      v-if="errorText"
      role="alert"
      class="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
    >
      {{ errorText }}
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table class="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr class="bg-slate-50 dark:bg-slate-800">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              :aria-sort="column.sortable ? sortState(column.key) : undefined"
              class="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                @click="sortBy(column.key)"
              >
                {{ column.key === 'rated_at' && params.state !== 'submitted' ? $t('Sent') : $t(column.label) }}
                <CommonIcon
                  v-if="sortState(column.key) !== 'none'"
                  :name="sortState(column.key) === 'ascending' ? 'arrow-up-short' : 'arrow-down-short'"
                  class="h-4 w-4 text-blue-800 dark:text-blue-300"
                />
              </button>
              <span v-else>{{ $t(column.label) }}</span>
            </th>
            <th scope="col" class="border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
              <span class="sr-only">{{ $t('Actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading && items.length === 0">
            <td :colspan="columns.length + 1" class="px-3 py-10 text-center text-slate-500">{{ $t('Loading…') }}</td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td :colspan="columns.length + 1" class="px-3 py-10 text-center text-slate-600 dark:text-slate-400">
              {{ params.state === 'submitted' ? $t('No feedback matches these filters yet.') : $t('No requests match these filters.') }}
            </td>
          </tr>
          <tr
            v-for="item in items"
            :key="item.id"
            class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
            :class="{ 'opacity-60': isLoading }"
          >
            <td class="whitespace-nowrap px-3 py-2.5 text-slate-600 tabular-nums dark:text-slate-400">
              {{ formatDate(params.state === 'submitted' ? item.rated_at : item.sent_at || item.created_at) }}
            </td>
            <td class="whitespace-nowrap px-3 py-2.5">
              <a
                v-if="item.ticket_id"
                :href="`/#ticket/zoom/${item.ticket_id}`"
                class="font-mono text-xs font-semibold text-blue-800 underline-offset-2 hover:underline dark:text-blue-300"
              >#{{ item.ticket_number }}</a>
              <span v-else class="font-mono text-xs text-slate-600 dark:text-slate-400" :title="$t('Ticket not found in this system')">#{{ item.ticket_number }}</span>
            </td>
            <td class="whitespace-nowrap px-3 py-2.5">{{ item.owner_name || '–' }}</td>
            <td class="whitespace-nowrap px-3 py-2.5">{{ item.customer_name || '–' }}</td>
            <td class="max-w-[220px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400">{{ item.customer_email }}</td>
            <td class="whitespace-nowrap px-3 py-2.5">
              <FeedbackCollectionStars v-if="item.state === 'submitted'" :rating="item.rating" />
              <span
                v-else
                class="rounded px-2 py-0.5 text-xs font-semibold"
                :class="
                  item.state === 'failed'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                "
              >{{ $t(stateLabel(item.state)) }}</span>
            </td>
            <td class="max-w-[320px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-300">
              {{ item.state === 'failed' ? item.error : item.comments || '' }}
            </td>
            <td class="px-3 py-2.5 text-right">
              <button
                type="button"
                class="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
                @click="open(item)"
              >
                {{ $t('Details') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
      <label for="feedback-per-page" class="flex items-center gap-2">
        {{ $t('Rows per page') }}
        <select
          id="feedback-per-page"
            v-model.number="params.per_page"
          class="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <div class="flex items-center gap-3">
        <span class="tabular-nums">{{ $t('%s–%s of %s', firstRow, lastRow, total) }}</span>
        <div class="flex gap-1">
          <button
            type="button"
            :disabled="params.page <= 1"
            :aria-label="$t('Previous page')"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white disabled:cursor-default disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
            @click="goToPage(params.page - 1)"
          >
            <CommonIcon name="chevron-left" class="h-4 w-4" />
          </button>
          <button
            type="button"
            :disabled="params.page >= pageCount"
            :aria-label="$t('Next page')"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white disabled:cursor-default disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
            @click="goToPage(params.page + 1)"
          >
            <CommonIcon name="chevron-right" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="selected" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabindex="-1"
        :aria-label="$t('Close')"
        class="absolute inset-0 cursor-default bg-slate-900/50"
        @click="close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-detail-title"
        class="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="feedback-detail-title" class="text-lg font-bold">
              {{ $t('Ticket #%s', selected.ticket_number) }}
            </h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ selected.ticket_title }}</p>
          </div>
          <button
            type="button"
            :aria-label="$t('Close')"
            class="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="close"
          >
            <CommonIcon name="x-lg" class="h-4 w-4" />
          </button>
        </div>
        <dl class="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Rating') }}</dt>
          <dd><FeedbackCollectionStars :rating="selected.rating" /></dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Comments') }}</dt>
          <dd class="whitespace-pre-wrap break-words">{{ selected.comments || '–' }}</dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Customer') }}</dt>
          <dd class="break-words">{{ selected.customer_name || '–' }} · {{ selected.customer_email }}</dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Agent') }}</dt>
          <dd>{{ selected.owner_name || '–' }}</dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Group') }}</dt>
          <dd>{{ selected.group_name || '–' }}</dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Status') }}</dt>
          <dd>{{ $t(stateLabel(selected.state)) }}<span v-if="selected.source === 'import'" class="text-slate-500"> · {{ $t('imported') }}</span></dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Sent') }}</dt>
          <dd>{{ formatDate(selected.sent_at) }}</dd>
          <dt class="text-slate-600 dark:text-slate-400">{{ $t('Answered') }}</dt>
          <dd>{{ formatDate(selected.rated_at) }}</dd>
          <template v-if="selected.error">
            <dt class="text-slate-600 dark:text-slate-400">{{ $t('Error') }}</dt>
            <dd class="break-words text-rose-700 dark:text-rose-300">{{ selected.error }}</dd>
          </template>
        </dl>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <a
            v-if="selected.ticket_id"
            :href="`/#ticket/zoom/${selected.ticket_id}`"
            class="text-sm font-semibold text-blue-800 underline underline-offset-2 dark:text-blue-300"
          >{{ $t('Open ticket') }}</a>
          <span v-else />
          <div v-if="!confirmDelete">
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-slate-600 dark:text-rose-300 dark:hover:bg-rose-900/20"
              @click="confirmDelete = true"
            >
              <CommonIcon name="trash3" class="h-4 w-4" />
              {{ $t('Delete') }}
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <span class="text-sm text-slate-700 dark:text-slate-300">{{ $t("Delete this entry? This can't be undone.") }}</span>
            <button
              type="button"
              class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="confirmDelete = false"
            >
              {{ $t('Cancel') }}
            </button>
            <button
              type="button"
              :disabled="isDeleting"
              class="cursor-pointer rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              @click="remove"
            >
              {{ $t('Delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
