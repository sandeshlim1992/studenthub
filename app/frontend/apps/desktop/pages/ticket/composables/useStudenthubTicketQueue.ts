// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { isEqual } from 'lodash-es'
import { storeToRefs } from 'pinia'
import { computed, onActivated, onDeactivated, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { usePagination } from '#shared/composables/usePagination.ts'
import { useQueryPolling } from '#shared/composables/useQueryPolling.ts'
import type { TicketByList } from '#shared/entities/ticket/types.ts'
import type { TicketsCachedByOverviewQueryVariables } from '#shared/graphql/types.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { QueryHandler } from '#shared/server/apollo/handler/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { useTicketsCachedByOverviewCache } from '#desktop/entities/ticket/composables/useTicketsCachedByOverviewCache.ts'
import { useTicketsCachedByOverviewQuery } from '#desktop/entities/ticket/graphql/queries/ticketsCachedByOverview.api.ts'
import { useTicketOverviewsStore } from '#desktop/entities/ticket/stores/ticketOverviews.ts'

// Student Hub: the queue beside the ticket (agents). It lists the tickets of the view last open
// on the Tickets page (otherwise the view used last, otherwise the first one) in that view's
// order, including the agent's own Group by and sorting (the server applies them to the view).
// It shares the Tickets page's cache for that view and refreshes like it, but only while this
// ticket is on screen. Mine / Unassigned filter the tickets loaded so far.

export type StudenthubQueueFilter = 'all' | 'mine' | 'unassigned'

export const STUDENTHUB_QUEUE_FILTERS: { value: StudenthubQueueFilter; label: string }[] = [
  { value: 'mine', label: __('Mine') },
  { value: 'unassigned', label: __('Unassigned') },
  { value: 'all', label: __('All') },
]

// Zammad's "nobody" owner.
const NO_OWNER_ID = 1

export const isUnassignedTicket = (ticket: Pick<TicketByList, 'owner'>) =>
  !ticket.owner || Number(getIdFromGraphQLId(ticket.owner.id)) === NO_OWNER_ID

// Shared by every ticket tab, so the choice survives moving between tickets.
const filter = ref<StudenthubQueueFilter>('all')

export const useStudenthubTicketQueue = (
  currentTicketInternalId: Ref<string>,
  enabled: Ref<boolean>,
) => {
  const router = useRouter()
  const session = useSessionStore()
  const overviewsStore = useTicketOverviewsStore()
  const {
    overviews,
    overviewsById,
    overviewsByLink,
    overviewsTicketCountById,
    overviewsSortedByLastUsedIds,
    currentTicketOverviewLink,
    queryPollingConfig,
  } = storeToRefs(overviewsStore)

  const overview = computed(
    () =>
      overviewsByLink.value[currentTicketOverviewLink.value] ??
      overviewsById.value[overviewsSortedByLastUsedIds.value[0]] ??
      overviews.value[0],
  )

  // Like choosing the view on the Tickets page, which then shows it too.
  const selectOverview = (link: string) => {
    if (!overviewsByLink.value[link]) return
    overviewsStore.setCurrentTicketOverviewLink(link)
  }

  // Kept-alive ticket tabs in the background don't refresh their queue.
  const isActive = ref(true)
  onActivated(() => {
    isActive.value = true
  })
  onDeactivated(() => {
    isActive.value = false
  })

  const isQueryEnabled = computed(() => enabled.value && !!overview.value)

  const { readTicketsByOverviewCache } = useTicketsCachedByOverviewCache()

  const variables = computed<TicketsCachedByOverviewQueryVariables>((currentVariables) => {
    const newVariables: TicketsCachedByOverviewQueryVariables = {
      pageSize: queryPollingConfig.value.page_size,
      overviewId: overview.value?.id ?? '',
      orderBy: overview.value?.orderBy,
      orderDirection: overview.value?.orderDirection,
      cacheTtl: queryPollingConfig.value.foreground.cache_ttl_sec,
      renewCache: false,
    }

    if (overview.value)
      newVariables.knownCollectionSignature =
        readTicketsByOverviewCache(newVariables)?.ticketsCachedByOverview?.collectionSignature

    if (currentVariables && isEqual(currentVariables, newVariables)) return currentVariables

    return newVariables
  })

  const ticketsQuery = new QueryHandler(
    useTicketsCachedByOverviewQuery(variables, () => ({
      enabled: isQueryEnabled.value,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-and-network',
      context: {
        batch: {
          active: false,
        },
      },
    })),
    {
      errorShowNotification: false,
    },
  )

  const ticketsResult = ticketsQuery.result()

  const pagination = usePagination(
    ticketsQuery,
    'ticketsCachedByOverview',
    queryPollingConfig.value.page_size,
    () => ({
      knownCollectionSignature: null,
      renewCache: false,
    }),
  )

  const { startPolling } = useQueryPolling(
    ticketsQuery,
    () => queryPollingConfig.value.foreground.interval_sec * 1000,
    () => ({
      knownCollectionSignature: ticketsResult.value?.ticketsCachedByOverview?.collectionSignature,
      renewCache: false,
      pageSize: queryPollingConfig.value.page_size * pagination.currentPage,
      cacheTtl: queryPollingConfig.value.foreground.cache_ttl_sec,
    }),
    () => ({
      enabled: queryPollingConfig.value.enabled && isQueryEnabled.value && isActive.value,
    }),
  )

  ticketsQuery.watchOnceOnResult(startPolling)

  const isLoading = ticketsQuery.loadingWithoutCachedResult()

  const tickets = computed(
    () => edgesToArray(ticketsResult.value?.ticketsCachedByOverview) as TicketByList[],
  )

  const totalCount = computed(
    () =>
      ticketsResult.value?.ticketsCachedByOverview?.totalCount ??
      (overview.value ? overviewsTicketCountById.value[overview.value.id] : undefined),
  )

  const visibleTickets = computed(() => {
    if (filter.value === 'mine')
      return tickets.value.filter((ticket) => ticket.owner?.id === session.userId)
    if (filter.value === 'unassigned') return tickets.value.filter(isUnassignedTicket)
    return tickets.value
  })

  const currentIndex = computed(() =>
    visibleTickets.value.findIndex(
      (ticket) => String(ticket.internalId) === String(currentTicketInternalId.value),
    ),
  )

  // The next / previous ticket of the (filtered) queue. A ticket that isn't in the queue (opened
  // from search, Recent…) is followed by the first one.
  const adjacentTicket = (step: 1 | -1) => {
    const list = visibleTickets.value
    if (currentIndex.value === -1) return step === 1 ? (list[0] ?? null) : null

    return list[currentIndex.value + step] ?? null
  }

  const nextTicket = computed(() => adjacentTicket(1))
  const previousTicket = computed(() => adjacentTicket(-1))

  const ticketLink = (ticket: Pick<TicketByList, 'internalId'>) => `/tickets/${ticket.internalId}`

  const openTicket = async (ticket: Pick<TicketByList, 'internalId'> | null) => {
    if (!ticket) return false

    await router.push(ticketLink(ticket))
    return true
  }

  return {
    isActive,
    overview,
    overviews,
    overviewsTicketCountById,
    selectOverview,
    filter,
    tickets,
    visibleTickets,
    totalCount,
    isLoading,
    pagination,
    currentIndex,
    nextTicket,
    previousTicket,
    ticketLink,
    openTicket,
    openNext: () => openTicket(nextTicket.value),
    openPrevious: () => openTicket(previousTicket.value),
  }
}

export type StudenthubTicketQueue = ReturnType<typeof useStudenthubTicketQueue>
