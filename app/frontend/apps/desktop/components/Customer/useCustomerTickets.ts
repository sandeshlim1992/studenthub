// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'

import {
  EnumOrderDirection,
  type TicketsCachedByOverviewQueryVariables,
} from '#shared/graphql/types.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { useTicketsCachedByOverviewCache } from '#desktop/entities/ticket/composables/useTicketsCachedByOverviewCache.ts'
import { useTicketsCachedByOverviewQuery } from '#desktop/entities/ticket/graphql/queries/ticketsCachedByOverview.api.ts'
import { useTicketOverviews } from '#desktop/pages/ticket-overviews/composables/useTicketOverviews.ts'

export const useCustomerTickets = () => {
  const { overviews, overviewsLoading } = useTicketOverviews()
  const { readTicketsByOverviewCache } = useTicketsCachedByOverviewCache()

  const customerOverview = computed(() => overviews.value?.[0])

  const ticketsQueryVariables = computed<TicketsCachedByOverviewQueryVariables>(() => {
    const ov = customerOverview.value
    const newVars: TicketsCachedByOverviewQueryVariables = {
      pageSize: 50,
      overviewId: ov?.id || '',
      orderBy: ov?.orderBy || 'created_at',
      orderDirection: ov?.orderDirection || EnumOrderDirection.Descending,
      cacheTtl: 10,
      renewCache: false,
    }

    if (ov?.id) {
      const cached = readTicketsByOverviewCache(newVars)
      newVars.knownCollectionSignature = cached?.ticketsCachedByOverview?.collectionSignature
    }

    return newVars
  })

  const ticketsQuery = useTicketsCachedByOverviewQuery(ticketsQueryVariables, {
    notifyOnNetworkStatusChange: true,
  })

  const tickets = computed<any[]>(() => {
    const conn = ticketsQuery.result.value?.ticketsCachedByOverview
    if (conn) {
      return (edgesToArray(conn) as any[]) || []
    }
    // Fallback to direct cache inspection if available
    const cached = customerOverview.value?.id
      ? readTicketsByOverviewCache(ticketsQueryVariables.value)
      : null
    if (cached?.ticketsCachedByOverview) {
      return (edgesToArray(cached.ticketsCachedByOverview) as any[]) || []
    }
    return []
  })

  const loading = computed(() => overviewsLoading.value || ticketsQuery.loading.value)

  return {
    tickets,
    loading,
    refetch: () => ticketsQuery.refetch(),
  }
}
