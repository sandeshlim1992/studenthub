<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { watchPausable } from '@vueuse/core'
import { isEqual } from 'lodash-es'
import { storeToRefs } from 'pinia'
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
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
import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'

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

interface DashboardCategory {
  key: string
  categoryValue: string
  label: string
  desc: string
  icon: string
}

const defaultDashboardCategories: DashboardCategory[] = [
  {
    key: 'service_request',
    categoryValue: 'Service Request',
    label: 'Service Request',
    desc: 'Account help, password resets, onboarding, ID cards & access',
    icon: 'shield-user',
  },
  {
    key: 'software',
    categoryValue: 'Software',
    label: 'Software Support',
    desc: 'MS Office, Outlook, VLE, SPSS, Windows, Wi-Fi & software licenses',
    icon: 'laptop',
  },
  {
    key: 'hardware',
    categoryValue: 'Hardware',
    label: 'Hardware & Equipment',
    desc: 'Laptops, desktop PCs, monitors, printers, scanners & classroom AV',
    icon: 'devices',
  },
]

const categoryIconMap: Record<
  string,
  { icon: string; desc: string; key: string }
> = {
  'Service Request': {
    icon: 'shield-user',
    desc: 'Account help, password resets, onboarding, ID cards, drive & access permissions',
    key: 'service_request',
  },
  Software: {
    icon: 'laptop',
    desc: 'MS Office, Outlook, LSST Portal, SPSS, Windows, Wi-Fi, VPN & app licenses',
    key: 'software',
  },
  Hardware: {
    icon: 'devices',
    desc: 'Desktop PCs, laptops, monitors, printers, scanners, attendance & AV setup',
    key: 'hardware',
  },
}

const dashboardCategories = ref<DashboardCategory[]>(defaultDashboardCategories)

onMounted(async () => {
  try {
    const res = await fetch('/api/v1/ticket_wizard_metadata', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data?.categories) && data.categories.length > 0) {
        dashboardCategories.value = data.categories.map((c: { name: string; value: string }) => {
          const hint = categoryIconMap[c.value] || categoryIconMap[c.name]
          const key = hint?.key || c.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')
          return {
            key,
            categoryValue: c.value,
            label: c.name,
            desc: hint?.desc || c.name,
            icon: hint?.icon || 'chat',
          }
        })
      }
    }
  } catch {
    // Fallback to defaultDashboardCategories
  }
})

const navigateToCategory = (cat: DashboardCategory) => {
  router.push({
    name: 'TicketCreate',
    query: {
      mode: 'wizard',
      category: cat.key,
      categoryValue: cat.categoryValue,
    },
  })
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

const customerTabCounts = computed(() => {
  const counts: Record<CustomerFilterTab, number> = {
    'All': 0,
    'Open': 0,
    'Pending': 0,
    'Waiting for Reply': 0,
    'Resolved': 0,
  }

  if (!tickets.value) return counts

  counts['All'] = tickets.value.length

  for (const ticket of tickets.value) {
    const stateName = (ticket.state?.name || ticket.state?.stateType?.name || '').toLowerCase()
    if (
      stateName.includes('closed') ||
      stateName.includes('resolved') ||
      stateName.includes('merged')
    ) {
      counts['Resolved']++
    } else if (stateName.includes('waiting')) {
      counts['Waiting for Reply']++
    } else if (stateName.includes('pending')) {
      counts['Pending']++
    } else if (stateName.includes('open') || stateName.includes('new')) {
      counts['Open']++
    } else {
      counts['Open']++
    }
  }

  return counts
})

const formatStateLabel = (name?: string | null, fallback = 'Open') => {
  const raw = name || fallback
  const translated = __(raw)
  return translated.charAt(0).toUpperCase() + translated.slice(1)
}

const getStatusBadge = (
  state?: { name?: string | null; stateType?: { name?: string | null } } | null,
) => {
  const name = (state?.name || state?.stateType?.name || '').toLowerCase()
  if (name.includes('closed') || name.includes('resolved') || name.includes('merged')) {
    return {
      type: 'closed' as const,
      label: formatStateLabel(state?.name, 'Closed'),
      class:
        'bg-[#e6eee8] text-[#243d2c] border border-[#b8d5c0] dark:bg-[#18261e] dark:text-[#a3ccae] dark:border-[#2f4f38]',
    }
  }
  if (name.includes('waiting')) {
    return {
      type: 'waiting' as const,
      label: formatStateLabel(state?.name, 'Waiting for Reply'),
      class:
        'bg-amber-50 text-amber-900 border border-amber-200/80 border-l-2 border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/70 dark:border-l-amber-500',
    }
  }
  if (name.includes('pending')) {
    return {
      type: 'pending' as const,
      label: formatStateLabel(state?.name, 'Pending'),
      class:
        'bg-purple-50 text-purple-900 border border-purple-200/80 border-l-2 border-l-purple-500 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/70 dark:border-l-purple-500',
    }
  }
  if (name.includes('new')) {
    return {
      type: 'new' as const,
      label: formatStateLabel(state?.name, 'New'),
      class:
        'bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] border-l-2 border-l-[#22c55e] dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/80 dark:border-l-[#22c55e]',
    }
  }
  return {
    type: 'open' as const,
    label: formatStateLabel(state?.name, 'Open'),
    class:
      'bg-sky-50 text-sky-900 border border-sky-200/80 border-l-2 border-l-sky-500 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/70 dark:border-l-sky-500',
  }
}

const isClosedTicket = (
  state?: { name?: string | null; stateType?: { name?: string | null } } | null,
) => {
  const name = (state?.name || state?.stateType?.name || '').toLowerCase()
  return name.includes('closed') || name.includes('resolved') || name.includes('merged')
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
  <div v-if="isCustomer" class="w-full min-h-full bg-slate-50">
    <main class="mx-auto w-full max-w-[1600px] px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        <!-- LEFT COLUMN: MY TICKETS (Narrower & sleek: 4 columns on desktop) -->
        <section
          class="lg:col-span-4 xl:col-span-4 order-2 lg:order-1 flex flex-col bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5.5 lg:h-[calc(100vh-140px)] lg:sticky lg:top-6"
        >
          <!-- Header: Title & Count Badge -->
          <div class="mb-4 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2.5">
              <h2 class="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
                {{ $t('My Tickets') }}
              </h2>
              <span
                class="rounded-md bg-[#e8f0f9] px-2.5 py-0.5 text-xs sm:text-sm font-extrabold text-[#1e3a5f]"
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
              class="h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none transition-all duration-150 placeholder:text-slate-400 focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15"
              :placeholder="$t('Search your tickets...')"
            />
            <svg
              class="absolute top-3 left-3.5 h-4.5 w-4.5 text-slate-400 pointer-events-none"
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
            <button
              v-if="customerSearch"
              type="button"
              class="absolute top-2.5 right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              :aria-label="$t('Clear search')"
              @click="customerSearch = ''"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Filter Tabs -->
          <div class="mb-3.5 flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
            <button
              v-for="tab in customerFilterTabs"
              :key="tab"
              type="button"
              class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all duration-150 select-none active:scale-[0.98]"
              :class="
                customerActiveTab === tab
                  ? 'bg-[#1e3a5f] text-white border border-[#1e3a5f] shadow-sm hover:bg-[#162d4a]'
                  : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-300/85 hover:border-slate-400 shadow-2xs hover:shadow-xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white dark:border-slate-700'
              "
              @click="customerActiveTab = tab"
            >
              <span>{{ $t(tab) }}</span>
              <span
                v-if="customerTabCounts[tab] > 0"
                class="inline-flex items-center justify-center min-w-[18px] px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-none tracking-tight transition-colors"
                :class="
                  customerActiveTab === tab
                    ? 'bg-white/20 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600 shadow-2xs'
                "
              >
                {{ customerTabCounts[tab] }}
              </span>
            </button>
          </div>

          <!-- Dedicated Tickets List (Scrollable on desktop, inline flowing on mobile) -->
          <div class="flex-1 lg:overflow-y-auto px-1 pt-2 pb-2 space-y-3 min-h-0 -mx-1">
            <template v-if="filteredCustomerTickets.length > 0">
              <div
                v-for="(ticket, idx) in filteredCustomerTickets"
                :key="ticket.id"
                class="ticket-card cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 group will-change-transform"
                :class="
                  isClosedTicket(ticket.state)
                    ? 'border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-slate-100/75 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:bg-white hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
                    : 'border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#1e3a5f] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
                "
                :style="idx < 3 ? undefined : { animationDelay: `${Math.min(idx * 50, 300)}ms` }"
                @click="navigateToTicket(ticket)"
              >
                <!-- Top: Ticket # and Status Pill -->
                <div class="flex items-center justify-between gap-3 mb-1.5">
                  <span
                    class="font-mono text-xs font-bold transition-colors"
                    :class="
                      isClosedTicket(ticket.state)
                        ? 'text-slate-400 group-hover:text-slate-600'
                        : 'text-slate-400 group-hover:text-[#1e3a5f]'
                    "
                  >
                    #{{ ticket.number || ticket.internalId || getIdFromGraphQLId(ticket.id) }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-colors shadow-2xs"
                    :class="getStatusBadge(ticket.state).class"
                  >
                    <!-- Closed / Resolved Check Icon -->
                    <svg
                      v-if="getStatusBadge(ticket.state).type === 'closed'"
                      class="h-3 w-3 shrink-0 text-[#243d2c] dark:text-[#a3ccae]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clip-rule="evenodd"
                      />
                    </svg>

                    <!-- New Live Pulsing Dot -->
                    <span
                      v-else-if="getStatusBadge(ticket.state).type === 'new'"
                      class="relative flex h-1.5 w-1.5 shrink-0"
                      aria-hidden="true"
                    >
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]"></span>
                    </span>

                    <!-- Open Active Steady Dot -->
                    <span
                      v-else-if="getStatusBadge(ticket.state).type === 'open'"
                      class="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0"
                      aria-hidden="true"
                    ></span>

                    <!-- Waiting for Reply Clock Icon -->
                    <svg
                      v-else-if="getStatusBadge(ticket.state).type === 'waiting'"
                      class="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                        clip-rule="evenodd"
                      />
                    </svg>

                    <!-- Pending Purple Dot -->
                    <span
                      v-else-if="getStatusBadge(ticket.state).type === 'pending'"
                      class="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0"
                      aria-hidden="true"
                    ></span>

                    <span>{{ getStatusBadge(ticket.state).label }}</span>
                  </span>
                </div>

                <!-- Title -->
                <div
                  class="text-sm sm:text-base leading-snug line-clamp-2 mb-2 transition-colors font-semibold"
                  :class="
                    isClosedTicket(ticket.state)
                      ? 'text-slate-700 group-hover:text-slate-900'
                      : 'text-slate-900 group-hover:text-[#1e3a5f]'
                  "
                >
                  {{ ticket.title }}
                </div>

                <!-- Bottom Row: Group & Date -->
                <div
                  class="flex items-center justify-between gap-2 pt-2 border-t text-xs"
                  :class="isClosedTicket(ticket.state) ? 'border-slate-200/50' : 'border-slate-100'"
                >
                  <span
                    class="font-semibold px-2 py-0.5 rounded-md border"
                    :class="
                      isClosedTicket(ticket.state)
                        ? 'bg-white/80 text-slate-500 border-slate-200/50'
                        : 'bg-slate-50 text-slate-500 border-slate-200/60'
                    "
                  >
                    {{ ticket.group?.name || $t('General Enquiry') }}
                  </span>
                  <span class="text-slate-400 font-medium">
                    {{ formatTicketDate(ticket.createdAt) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Friendly Empty State with Illustration & Context-Aware Actions -->
            <div v-else class="py-12 px-4 text-center flex flex-col items-center justify-center">
              <!-- Friendly Duotone Illustration Badge -->
              <div class="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-500 ring-8 ring-slate-50/80">
                <!-- Search Empty Icon -->
                <svg
                  v-if="customerSearch"
                  class="h-7 w-7 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>

                <!-- Filter Empty Icon -->
                <svg
                  v-else-if="customerActiveTab !== 'All'"
                  class="h-7 w-7 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>

                <!-- Default Friendly Ticket Icon -->
                <svg
                  v-else
                  class="h-7 w-7 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                </svg>
              </div>

              <!-- Context-Aware Title & Message -->
              <template v-if="customerSearch">
                <div class="text-sm font-semibold text-slate-900">
                  {{ $t('No matching tickets') }}
                </div>
                <p class="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
                  {{ $t("We couldn't find any tickets matching your search query.") }}
                </p>
                <button
                  type="button"
                  class="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 transition-colors cursor-pointer"
                  @click="customerSearch = ''"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{{ $t('Clear search') }}</span>
                </button>
              </template>

              <template v-else-if="customerActiveTab !== 'All'">
                <div class="text-sm font-semibold text-slate-900">
                  {{ $t('No tickets in this filter') }}
                </div>
                <p class="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
                  {{ $t('You have no tickets currently under this status.') }}
                </p>
                <button
                  type="button"
                  class="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1e3a5f] bg-[#e8f0f9] hover:bg-[#d5e4f5] border border-[#1e3a5f]/20 transition-colors cursor-pointer"
                  @click="customerActiveTab = 'All'"
                >
                  <span>{{ $t('View all tickets') }}</span>
                </button>
              </template>

              <template v-else>
                <div class="text-sm font-semibold text-slate-900">
                  {{ $t('No tickets yet') }}
                </div>
                <p class="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
                  {{ $t('Whenever you submit an enquiry, your tickets will appear here.') }}
                </p>
                <button
                  type="button"
                  class="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#16a34a] hover:bg-[#15803d] shadow-sm transition-colors cursor-pointer"
                  @click="router.push({ name: 'TicketCreate', query: { mode: 'form' } })"
                >
                  <span>{{ $t('Raise a New Ticket') }}</span>
                </button>
              </template>
            </div>
          </div>
        </section>

        <!-- RIGHT COLUMN: HERO & QUICK ACTION CARDS (Bigger: 8 columns on desktop) -->
        <section class="lg:col-span-8 xl:col-span-8 order-1 lg:order-2 flex flex-col gap-6 w-full">
          <!-- HERO CARD (Luxury Dark Aesthetic - Sleek Height & Balanced Proportions) -->
          <div
            class="relative overflow-hidden rounded-[28px] sm:rounded-[32px] py-6 px-4.5 sm:py-9 sm:px-10 lg:py-10 lg:px-12 text-center shadow-[0_20px_50px_rgba(15,23,42,0.12)] border border-white/[0.08]"
            style="background: radial-gradient(circle at 92% 85%, rgba(22, 163, 74, 0.35) 0%, rgba(16, 185, 129, 0.18) 35%, transparent 65%), radial-gradient(circle at 12% 18%, rgba(30, 58, 95, 0.3) 0%, transparent 55%), #0e151c;"
          >
            <!-- Brand Logo in Crisp White Badge for 100% High-Contrast Visibility -->
            <div class="mb-3.5 flex items-center justify-center">
              <div
                class="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white p-2 sm:p-2.5 shadow-lg ring-2 ring-white/60 flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105"
              >
                <img
                  :src="studentHubLogo"
                  alt="Student Hub"
                  class="h-full w-full object-contain"
                />
              </div>
            </div>

            <!-- Eyebrow Tag with Pulsing Green Accent Beacon -->
            <div class="mb-2 sm:mb-2.5 flex items-center justify-center gap-2">
              <span class="h-1.5 w-1.5 rounded-full bg-[#16a34a] shadow-[0_0_8px_#22c55e] animate-pulse"></span>
              <span class="text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                {{ $t('Begin Your Journey') }}
              </span>
            </div>

            <!-- Headline (Editorial Serif Aesthetic - Compact, Elegant & Impactful) -->
            <h1 class="font-editorial text-2xl sm:text-4xl lg:text-[42px] font-medium text-[#fcfbf7] tracking-normal leading-tight">
              {{ $t('How can we help?') }}
            </h1>

            <!-- Subtitle (Proportional & Clear) -->
            <p class="mt-2 sm:mt-2.5 text-xs sm:text-sm md:text-base font-light text-slate-300/85 max-w-xl mx-auto leading-relaxed">
              {{ $t('Speak with our support team. We’ll help you find the right answers, resolve technical issues, and guide you through every step.') }}
            </p>

            <!-- Dual Action Buttons matching the reference image with Brand Green Theme -->
            <div class="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-sm sm:max-w-none mx-auto">
              <!-- Primary: Brand Green Theme (#16a34a) -->
              <button
                type="button"
                class="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold text-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none"
                @click="router.push({ name: 'TicketCreate', query: { mode: 'form' } })"
              >
                <span>{{ $t('Raise a New Ticket') }}</span>
                <span class="text-base leading-none">→</span>
              </button>

              <!-- Secondary: Frosted Glass / Translucent with Subtle Green Hover -->
              <button
                type="button"
                class="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/20 hover:border-emerald-400/50 bg-white/5 hover:bg-emerald-950/20 px-6 sm:px-8 py-3 text-sm sm:text-base font-medium text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none"
                @click="router.push({ name: 'TicketCreate', query: { mode: 'wizard' } })"
              >
                <span>{{ $t('Talk to Student Support') }}</span>
              </button>
            </div>
          </div>

          <!-- QUICK CATEGORY CARDS (Clean, Professional & Restrained Luxury Hover) -->
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">
              {{ $t('Choose a Category') }}
            </h3>
            <div class="grid grid-cols-1 gap-3.5 sm:gap-5 sm:grid-cols-3">
              <div
                v-for="cat in dashboardCategories"
                :key="cat.key"
                class="group cursor-pointer rounded-xl bg-white p-5 sm:p-6 lg:p-7 text-center border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] hover:border-emerald-300/80 flex flex-col items-center select-none"
                @click="navigateToCategory(cat)"
              >
                <div class="mb-3.5 rounded-xl bg-slate-50/90 p-3.5 transition-colors duration-200 group-hover:bg-[#f0fdf4]">
                  <!-- Laptop Icon -->
                  <svg
                    v-if="cat.icon === 'laptop'"
                    class="h-9 w-9 text-[#0f233d] group-hover:text-[#16a34a] transition-all duration-200 group-hover:scale-105"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <!-- Shield User Icon -->
                  <svg
                    v-else-if="cat.icon === 'shield-user'"
                    class="h-9 w-9 text-[#0f233d] group-hover:text-[#16a34a] transition-all duration-200 group-hover:scale-105"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <!-- Devices Icon -->
                  <svg
                    v-else-if="cat.icon === 'devices'"
                    class="h-9 w-9 text-[#0f233d] group-hover:text-[#16a34a] transition-all duration-200 group-hover:scale-105"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <rect x="2" y="4" width="20" height="12" rx="2" />
                    <line x1="6" y1="20" x2="18" y2="20" />
                    <line x1="12" y1="16" x2="12" y2="20" />
                  </svg>
                  <!-- Chat Fallback Icon -->
                  <svg
                    v-else
                    class="h-9 w-9 text-[#0f233d] group-hover:text-[#16a34a] transition-all duration-200 group-hover:scale-105"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div class="text-base font-bold text-slate-900 group-hover:text-[#16a34a] transition-colors duration-150">
                  {{ $t(cat.label) }}
                </div>
                <div class="mt-1.5 text-xs sm:text-sm font-normal text-slate-500 leading-snug">
                  {{ $t(cat.desc) }}
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
.font-editorial {
  font-family: 'Playfair Display', Georgia, Cambria, 'Times New Roman', Times, serif;
}

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
