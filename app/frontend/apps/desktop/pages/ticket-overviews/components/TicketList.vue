<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { watchPausable } from '@vueuse/core'
import { isEqual } from 'lodash-es'
import { storeToRefs } from 'pinia'
import {
  computed,
  onActivated,
  onDeactivated,
  readonly,
  ref,
  type Ref,
  toRef,
  useTemplateRef,
  watch,
} from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router'

import { useSorting } from '#shared/composables/list/useSorting.ts'
import { usePagination } from '#shared/composables/usePagination.ts'
import { useQueryPolling } from '#shared/composables/useQueryPolling.ts'
import {
  EnumOrderDirection,
  type TicketsCachedByOverviewQueryVariables,
} from '#shared/graphql/types.ts'
import { QueryHandler } from '#shared/server/apollo/handler/index.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import hasPermission from '#shared/utils/hasPermission.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonEmptyMessage from '#desktop/components/CommonEmptyMessage/CommonEmptyMessage.vue'
import { useSkeletonLoadingCount } from '#desktop/components/CommonTable/composables/useSkeletonLoadingCount.ts'
import { useTicketBulkEdit } from '#desktop/components/Ticket/TicketBulkEditFlyout/useTicketBulkEdit.ts'
import TicketListTable from '#desktop/components/Ticket/TicketListTable.vue'
import { useElementScroll } from '#desktop/composables/useElementScroll.ts'
import { useScrollPosition } from '#desktop/composables/useScrollPosition.ts'
import { useTicketsCachedByOverviewCache } from '#desktop/entities/ticket/composables/useTicketsCachedByOverviewCache.ts'
import { useTicketsCachedByOverviewQuery } from '#desktop/entities/ticket/graphql/queries/ticketsCachedByOverview.api.ts'
import { useTicketOverviewsStore } from '#desktop/entities/ticket/stores/ticketOverviews.ts'
import { useLifetimeCustomerTicketsCount } from '#desktop/entities/user/current/composables/useLifetimeCustomerTicketsCount.ts'

const MAX_ITEMS = 2000

interface Props {
  overviewId: string
  orderBy: string
  orderDirection: EnumOrderDirection
  headers: string[]
  overviewName: string
  groupBy?: string
  overviewCount?: number
}

const props = defineProps<Props>()

const router = useRouter()

const { readTicketsByOverviewCache, forceTicketsByOverviewCacheOnlyFirstPage } =
  useTicketsCachedByOverviewCache()

const { queryPollingConfig } = storeToRefs(useTicketOverviewsStore())

let lastFirstPageCollectionSignature: string
const foreground = ref(true)
const pollingInterval = computed(
  () =>
    (foreground.value
      ? queryPollingConfig.value.foreground.interval_sec
      : queryPollingConfig.value.background.interval_sec) * 1000,
)
const cacheTtl = computed(() =>
  foreground.value
    ? queryPollingConfig.value.foreground.cache_ttl_sec
    : queryPollingConfig.value.background.cache_ttl_sec,
)

const ticketsQueryVariables = computed<TicketsCachedByOverviewQueryVariables>(
  (currentVariables) => {
    const newVariables: TicketsCachedByOverviewQueryVariables = {
      pageSize: queryPollingConfig.value.page_size,
      overviewId: props.overviewId,
      orderBy: props.orderBy,
      orderDirection: props.orderDirection,
      cacheTtl: queryPollingConfig.value.foreground.cache_ttl_sec,
      renewCache: currentVariables?.overviewId !== props.overviewId,
    }

    const cachedTickets = readTicketsByOverviewCache(newVariables)

    newVariables.knownCollectionSignature =
      cachedTickets?.ticketsCachedByOverview?.collectionSignature

    if (currentVariables && isEqual(currentVariables, newVariables)) {
      return currentVariables
    }

    return newVariables
  },
)

let currentAbortController = new AbortController()

const fetchOptions = {
  signal: currentAbortController.signal,
}

const ticketsQuery = new QueryHandler(
  useTicketsCachedByOverviewQuery(ticketsQueryVariables, {
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-and-network',
    context: {
      batch: {
        active: false,
      },
      fetchOptions,
    },
  }),
  {
    triggerRefetchOnConnectionReconnect: () => foreground.value,
  },
)

const scrollContainerElement = useTemplateRef('scroll-container')

const {
  sort,
  orderBy: localOrderBy,
  orderDirection: localOrderDirection,
  isSorting,
} = useSorting(
  ticketsQuery,
  toRef(props, 'orderBy'),
  toRef(props, 'orderDirection'),
  scrollContainerElement,
)

const pagination = usePagination(
  ticketsQuery,
  'ticketsCachedByOverview',
  queryPollingConfig.value.page_size,
  () => ({
    knownCollectionSignature: null,
    renewCache: false,
  }),
)

const ticketsResult = ticketsQuery.result()

const currentCollectionSignature = computed(() => {
  return ticketsResult.value?.ticketsCachedByOverview?.collectionSignature
})

const { startPolling, stopPolling } = useQueryPolling(
  ticketsQuery,
  pollingInterval,
  () => ({
    knownCollectionSignature: currentCollectionSignature.value,
    renewCache: false,
    pageSize: queryPollingConfig.value.page_size * pagination.currentPage,
    cacheTtl: cacheTtl.value,
  }),
  () => ({
    enabled: queryPollingConfig.value.enabled && !isSorting.value,
  }),
)

const refreshRefetchAbortController = () => {
  // Stop polling to avoid duplicate requests during an manual refetch.
  stopPolling()

  currentAbortController.abort()
  currentAbortController = new AbortController()
  fetchOptions.signal = currentAbortController.signal
}

const loading = ticketsQuery.loading()

const isLoadingTickets = ticketsQuery.loadingWithoutCachedResult()

const tickets = computed(() => edgesToArray(ticketsResult.value?.ticketsCachedByOverview))

onActivated(() => {
  if (foreground.value) return

  ticketsQuery.refetch({
    renewCache: true,
  })
  foreground.value = true
})

onDeactivated(() => {
  foreground.value = false
})

const resort = (column: string, direction: EnumOrderDirection) => {
  forceTicketsByOverviewCacheOnlyFirstPage(
    {
      ...ticketsQueryVariables.value,
      orderBy: localOrderBy.value,
      orderDirection: localOrderDirection.value,
    },
    lastFirstPageCollectionSignature,
    queryPollingConfig.value.page_size,
  )

  const cachedTickets = readTicketsByOverviewCache({
    ...ticketsQueryVariables.value,
    orderBy: column,
    orderDirection: direction,
  })

  refreshRefetchAbortController()

  sort(
    column,
    direction,
    {
      knownCollectionSignature: cachedTickets?.ticketsCachedByOverview?.collectionSignature,
      renewCache: false,
    },
    () => {
      startPolling()
    },
  )
}

const { resume: startLoadingWatch, pause: pauseLoadingWatch } = watchPausable(
  loading,
  () => {
    pauseLoadingWatch()
    startPolling()
  },
  {
    initialState: 'paused',
  },
)

const startPollingHandler = () => {
  // We can only start the polling directly when it's not loading in the background.
  // Otherwise it means it was loaded from the cache and we need to wait for real
  // network response (because of cache-and-network fetch policy).
  if (!loading.value) {
    startPolling()
    return
  }

  startLoadingWatch()
}

ticketsQuery.watchOnceOnResult((result) => {
  if (!queryPollingConfig.value.enabled) return

  lastFirstPageCollectionSignature = result.ticketsCachedByOverview.collectionSignature

  startPollingHandler()
})

onBeforeRouteLeave(() => {
  forceTicketsByOverviewCacheOnlyFirstPage(
    ticketsQueryVariables.value,
    lastFirstPageCollectionSignature,
    queryPollingConfig.value.page_size,
  )
})

watch(
  () => props.overviewId,
  () => {
    ticketsQuery.watchOnceOnResult((result) => {
      if (!queryPollingConfig.value.enabled) return

      lastFirstPageCollectionSignature = result.ticketsCachedByOverview.collectionSignature

      startPollingHandler()
    })
  },
)

onBeforeRouteUpdate(() => {
  forceTicketsByOverviewCacheOnlyFirstPage(
    ticketsQueryVariables.value,
    lastFirstPageCollectionSignature,
    queryPollingConfig.value.page_size,
  )

  if (!queryPollingConfig.value.enabled) return

  stopPolling()
})

ticketsQuery.onResult((result) => {
  if (isSorting.value && !result.loading) {
    // If sorting comes from the cache, we immediately dispose the loading state
    isSorting.value = false
  }
})

const totalCount = computed(() => ticketsResult.value?.ticketsCachedByOverview.totalCount || 0)

const loadMore = async () => pagination.fetchNextPage()

const config = toRef(useApplicationStore(), 'config')
const user = toRef(useSessionStore(), 'user')

// Scrolling position is preserved when user visits another page and returns to overview page
const { scrollPosition, restoreScrollPosition } = useScrollPosition(scrollContainerElement)

const resetScrollPosition = () => {
  scrollPosition.value = 0
  restoreScrollPosition()
}

// Reset scroll-position back to the start, when user navigates between overviews
onBeforeRouteUpdate(resetScrollPosition)

const { reachedTop } = useElementScroll(scrollContainerElement as Ref<HTMLDivElement>)

const { hasAnyTicket } = useLifetimeCustomerTicketsCount()

const isCustomerAndCanCreateTickets = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    config.value.customer_ticket_create,
)

const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

const formatTicketDate = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const customerSearch = ref('')
const customerFilterTabs = [
  'All',
  'Open',
  'Pending',
  'Waiting for Reply',
  'Resolved',
] as const
type CustomerFilterTab = (typeof customerFilterTabs)[number]
const customerActiveTab = ref<CustomerFilterTab>('All')


const getStatusBadge = (
  state?: { name?: string | null; stateType?: { name?: string | null } } | null,
) => {
  const name = (state?.name || state?.stateType?.name || '').toLowerCase()
  if (name.includes('closed') || name.includes('resolved') || name.includes('merged')) {
    return {
      label: state?.name || 'Resolved',
      class:
        'flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-bold bg-[#f0fdf4] text-[#15803d] border border-emerald-200 shadow-2xs',
    }
  }
  if (name.includes('waiting')) {
    return {
      label: state?.name || 'Waiting for Reply',
      class:
        'flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-bold bg-[#fff7ed] text-[#c2410c] border border-orange-200 shadow-2xs',
    }
  }
  if (name.includes('pending')) {
    return {
      label: state?.name || 'Pending',
      class:
        'flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-bold bg-[#fef9c3] text-[#854d0e] border border-yellow-200 shadow-2xs',
    }
  }
  if (name.includes('new')) {
    return {
      label: state?.name || 'New',
      class:
        'flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs',
    }
  }
  return {
    label: state?.name || 'Open',
    class:
      'flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-bold bg-[#e8f0f9] text-[#1e3a5f] border border-blue-200 shadow-2xs',
  }
}

const filteredCustomerTickets = computed(() => {
  if (!tickets.value) return []
  return tickets.value.filter((ticket) => {
    // 1. Filter by search query
    if (customerSearch.value.trim()) {
      const q = customerSearch.value.trim().toLowerCase()
      const titleMatch = ticket.title?.toLowerCase().includes(q)
      const numberMatch = String(ticket.number || ticket.internalId || '').toLowerCase().includes(q)
      const groupMatch = ticket.group?.name?.toLowerCase().includes(q)
      if (!titleMatch && !numberMatch && !groupMatch) return false
    }

    // 2. Filter by tab
    if (customerActiveTab.value === 'All') return true

    const stateName = (ticket.state?.name || ticket.state?.stateType?.name || '').toLowerCase()
    if (customerActiveTab.value === 'Open') {
      return (
        (stateName.includes('open') || stateName.includes('new')) &&
        !stateName.includes('closed') &&
        !stateName.includes('resolved') &&
        !stateName.includes('merged') &&
        !stateName.includes('pending') &&
        !stateName.includes('waiting')
      )
    }
    if (customerActiveTab.value === 'Pending') {
      return stateName.includes('pending')
    }
    if (customerActiveTab.value === 'Waiting for Reply') {
      return stateName.includes('waiting')
    }
    if (customerActiveTab.value === 'Resolved') {
      return (
        stateName.includes('closed') ||
        stateName.includes('resolved') ||
        stateName.includes('merged')
      )
    }

    return true
  })
})

const navigateToTicket = (ticket: { id: string; internalId?: number | null }) => {
  const ticketId = ticket.internalId || getIdFromGraphQLId(ticket.id)
  router.push(`/tickets/${ticketId}`)
}

const localHeaders = computed(() => {
  const extendedHeaders = [...props.headers]

  extendedHeaders.unshift('stateIcon')

  if (config.value.ui_ticket_priority_icons) {
    extendedHeaders.unshift('priorityIcon')
  }

  return extendedHeaders
})

const { setOnSuccessCallback, checkedTicketIds, bulkContext } = useTicketBulkEdit()

watch(
  () => props.overviewId,
  (newValue) => {
    bulkContext.value = {
      overviewId: newValue,
    }
  },
  { immediate: true },
)

setOnSuccessCallback(() => {
  forceTicketsByOverviewCacheOnlyFirstPage(
    ticketsQueryVariables.value,
    lastFirstPageCollectionSignature,
    queryPollingConfig.value.page_size,
  )

  refreshRefetchAbortController()

  ticketsQuery
    .refetch({
      pageSize: queryPollingConfig.value.page_size,
      renewCache: true,
    })
    .finally(() => {
      startPolling()
    })

  requestAnimationFrame(() => {
    scrollContainerElement.value?.scrollTo({ top: 0 })
  })
})

onBeforeRouteUpdate(() => checkedTicketIds.value.clear())

const { visibleSkeletonLoadingCount } = useSkeletonLoadingCount(toRef(props, 'overviewCount'))

defineExpose({ tickets: readonly(tickets) })
</script>

<template>
  <!-- CUSTOMER REDESIGNED PORTAL VIEW (2-COLUMN RESPONSIVE DASHBOARD) -->
  <div v-if="isCustomer" class="overflow-y-auto h-full w-full bg-[#f8fafc]">
    <main class="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        <!-- LEFT COLUMN: MY TICKETS (Narrower & sleek: 4 columns on desktop) -->
        <section
          class="lg:col-span-4 xl:col-span-4 order-2 lg:order-1 flex flex-col bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs lg:h-[calc(100vh-140px)] lg:sticky lg:top-6"
        >
          <!-- Header: Title & Count Badge -->
          <div class="mb-4 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2.5">
              <h2 class="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                {{ $t('My Tickets') }}
              </h2>
              <span
                class="rounded-full bg-[#e8f0f9] px-3 py-0.5 text-xs sm:text-sm font-extrabold text-[#1e3a5f]"
              >
                {{ filteredCustomerTickets.length }}
              </span>
            </div>

            <!-- Clear filters shortcut if active -->
            <button
              v-if="customerSearch || customerActiveTab !== 'All'"
              type="button"
              class="text-xs font-bold text-slate-500 hover:text-[#1e3a5f] cursor-pointer transition-colors"
              @click="customerSearch = ''; customerActiveTab = 'All'"
            >
              {{ $t('Clear filters') }}
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative mb-3 shrink-0">
            <input
              v-model="customerSearch"
              type="text"
              class="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-all duration-150 placeholder:text-slate-400 focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15"
              :placeholder="$t('Search your tickets...')"
            />
            <svg
              class="absolute top-3 left-3.5 h-4.5 w-4.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <!-- Filter Tabs -->
          <div class="mb-3.5 flex gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
            <button
              v-for="tab in customerFilterTabs"
              :key="tab"
              type="button"
              :class="
                customerActiveTab === tab
                  ? 'whitespace-nowrap rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all'
                  : 'cursor-pointer whitespace-nowrap rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-150 hover:border-slate-300 hover:text-[#1e3a5f] hover:bg-slate-100'
              "
              @click="customerActiveTab = tab"
            >
              {{ $t(tab) }}
            </button>
          </div>

          <!-- Dedicated Scrollable Tickets List -->
          <div class="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
            <template v-if="filteredCustomerTickets.length > 0">
              <div
                v-for="(ticket, idx) in filteredCustomerTickets"
                :key="ticket.id"
                class="ticket-card cursor-pointer rounded-2xl border-2 border-slate-200/80 bg-white p-4 transition-all duration-200 hover:border-[#1e3a5f] hover:shadow-md hover:-translate-y-0.5 group"
                :style="idx < 3 ? undefined : { animationDelay: `${Math.min(idx * 50, 300)}ms` }"
                @click="navigateToTicket(ticket)"
              >
                <!-- Top: Ticket # and Status Pill -->
                <div class="flex items-center justify-between gap-3 mb-1.5">
                  <span class="font-mono text-xs font-bold text-slate-400 group-hover:text-[#1e3a5f] transition-colors">
                    #{{ ticket.number || ticket.internalId || getIdFromGraphQLId(ticket.id) }}
                  </span>
                  <span class="shrink-0 font-bold" :class="getStatusBadge(ticket.state).class">
                    {{ getStatusBadge(ticket.state).label }}
                  </span>
                </div>

                <!-- Title -->
                <div class="text-sm sm:text-base font-bold leading-snug text-slate-900 group-hover:text-[#1e3a5f] transition-colors line-clamp-2 mb-2">
                  {{ ticket.title }}
                </div>

                <!-- Bottom Row: Group & Date -->
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <span class="font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                    {{ ticket.group?.name || $t('General Enquiry') }}
                  </span>
                  <span class="text-slate-400 font-medium">
                    {{ formatTicketDate(ticket.createdAt) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Empty State -->
            <div v-else class="py-14 text-center">
              <svg
                class="mx-auto mb-3 h-12 w-12 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div class="text-sm font-bold text-[#0f172a]">
                {{ $t('No tickets found') }}
              </div>
              <div class="mt-1 text-xs text-[#64748b]">
                {{ $t('Need help? Raise a new ticket on the right.') }}
              </div>
            </div>
          </div>
        </section>

        <!-- RIGHT COLUMN: HERO & QUICK ACTION CARDS (Bigger: 8 columns on desktop) -->
        <section class="lg:col-span-8 xl:col-span-8 order-1 lg:order-2 flex flex-col gap-6 w-full">
          <!-- HERO CARD (Enlarged) -->
          <div class="rounded-3xl bg-[#1e3a5f] p-8 sm:p-10 lg:p-11 text-center shadow-lg border border-blue-900/40 relative overflow-hidden">
            <!-- Subtle Background Glow -->
            <div class="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
            <div class="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>

            <!-- Logo Section with Clean White Background -->
            <div class="mx-auto mb-5 flex items-center justify-center">
              <div
                class="h-20 w-20 sm:h-22 sm:w-22 rounded-3xl bg-white p-3 shadow-xl flex items-center justify-center ring-4 ring-white/30 transition-transform duration-300 hover:scale-105"
              >
                <img
                  src="/assets/images/branding/student_hub_logo.png"
                  alt="Student Hub"
                  class="h-full w-full object-contain"
                />
              </div>
            </div>

            <h1 class="text-3xl sm:text-4xl lg:text-4xl font-black text-white tracking-tight">
              {{ $t('How can we help?') }}
            </h1>
            <p class="mt-2.5 text-base sm:text-lg font-semibold text-[#93b5d4]">
              {{ $t('Support for LSST, FSB & UKBC students') }}
            </p>

            <!-- Raise ticket button (Enlarged & High Visibility) -->
            <button
              type="button"
              class="mt-7 inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-[#16a34a] px-10 py-4 text-base sm:text-lg font-extrabold text-white shadow-xl hover:shadow-2xl transition-all duration-200 hover:bg-[#15803d] hover:scale-105 active:scale-98"
              @click="router.push({ name: 'TicketCreate' })"
            >
              <span class="text-xl font-black leading-none">+</span>
              <span>{{ $t('Raise a New Ticket') }}</span>
            </button>
          </div>

          <!-- QUICK CATEGORY CARDS (Enlarged) -->
          <div>
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 px-1">
              {{ $t('Choose a Category') }}
            </h3>
            <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <!-- Card 1 - IT Support -->
              <div
                class="group cursor-pointer rounded-2xl border-2 border-slate-200/90 bg-white p-6 sm:p-7 text-center transition-all duration-200 hover:border-[#1e3a5f] hover:shadow-xl hover:-translate-y-1 flex flex-col items-center shadow-xs"
                @click="router.push({ name: 'TicketCreate' })"
              >
                <div class="mb-3.5 rounded-2xl bg-blue-50 p-3 text-[#1e3a5f] group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors duration-200">
                  <svg
                    class="h-9 w-9"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div class="text-lg font-extrabold text-[#0f172a] group-hover:text-[#1e3a5f] transition-colors">
                  {{ $t('IT Support') }}
                </div>
                <div class="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-snug">
                  {{ $t('Hardware, software & accounts') }}
                </div>
              </div>

              <!-- Card 2 - Account Help -->
              <div
                class="group cursor-pointer rounded-2xl border-2 border-slate-200/90 bg-white p-6 sm:p-7 text-center transition-all duration-200 hover:border-[#1e3a5f] hover:shadow-xl hover:-translate-y-1 flex flex-col items-center shadow-xs"
                @click="router.push({ name: 'TicketCreate' })"
              >
                <div class="mb-3.5 rounded-2xl bg-indigo-50 p-3 text-[#1e3a5f] group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors duration-200">
                  <svg
                    class="h-9 w-9"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div class="text-lg font-extrabold text-[#0f172a] group-hover:text-[#1e3a5f] transition-colors">
                  {{ $t('Account Help') }}
                </div>
                <div class="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-snug">
                  {{ $t('Passwords & email access') }}
                </div>
              </div>

              <!-- Card 3 - General Enquiry -->
              <div
                class="group cursor-pointer rounded-2xl border-2 border-slate-200/90 bg-white p-6 sm:p-7 text-center transition-all duration-200 hover:border-[#1e3a5f] hover:shadow-xl hover:-translate-y-1 flex flex-col items-center shadow-xs"
                @click="router.push({ name: 'TicketCreate' })"
              >
                <div class="mb-3.5 rounded-2xl bg-sky-50 p-3 text-[#1e3a5f] group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors duration-200">
                  <svg
                    class="h-9 w-9"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div class="text-lg font-extrabold text-[#0f172a] group-hover:text-[#1e3a5f] transition-colors">
                  {{ $t('General Enquiry') }}
                </div>
                <div class="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 leading-snug">
                  {{ $t('Any other questions') }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>

  <!-- STANDARD AGENT TABLE VIEW -->
  <div v-else ref="scroll-container" class="overflow-y-auto focus-visible:outline-none">
    <TicketListTable
      :table-id="overviewId"
      :caption="$t('Overview: %s', overviewName)"
      :headers="localHeaders"
      :order-by="localOrderBy"
      :order-direction="localOrderDirection"
      :group-by="groupBy"
      :reached-scroll-top="reachedTop"
      :scroll-container="scrollContainerElement"
      :items="tickets"
      :total-count="totalCount"
      :max-items="MAX_ITEMS"
      :resorting="isSorting"
      :loading="isLoadingTickets"
      :skeleton-loading-count="visibleSkeletonLoadingCount"
      :loading-new-page="pagination.loadingNewPage"
      @load-more="loadMore"
      @sort="resort"
    >
      <template #empty-list>
        <CommonEmptyMessage
          v-if="isCustomerAndCanCreateTickets && !hasAnyTicket"
          class="absolute top-1/2 w-full -translate-y-1/2 space-y-2.5 text-center ltr:left-1/2 ltr:-translate-x-1/2 rtl:right-1/2 rtl:translate-x-1/2"
          :title="$t('Welcome!')"
        >
          <CommonLabel class="block!" tag="p">{{
            $t('You have not created a ticket yet.')
          }}</CommonLabel>
          <CommonLabel class="block!" tag="p">{{
            $t('The way to communicate with us is this thing called "ticket".')
          }}</CommonLabel>
          <CommonLabel class="block!" tag="p">{{
            $t('Please click on the button below to create your first one.')
          }}</CommonLabel>
          <CommonButton
            size="large"
            class="mx-auto mt-8"
            variant="primary"
            @click="router.push({ name: 'TicketCreate' })"
            >{{ $t('Create your first ticket') }}
          </CommonButton>
        </CommonEmptyMessage>

        <CommonEmptyMessage
          v-else
          class="absolute top-1/2 w-full -translate-y-1/2 text-center ltr:left-1/2 ltr:-translate-x-1/2 rtl:right-1/2 rtl:translate-x-1/2"
          :title="$t('Empty overview')"
          :text="$t('No tickets in this state.')"
          with-illustration
        />
      </template>
    </TicketListTable>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.ticket-card {
  animation: fadeIn 200ms ease-out forwards;
}
.ticket-card:nth-child(2) {
  animation-delay: 50ms;
}
.ticket-card:nth-child(3) {
  animation-delay: 100ms;
}
</style>
