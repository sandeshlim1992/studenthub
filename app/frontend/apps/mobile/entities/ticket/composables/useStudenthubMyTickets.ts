// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'

import { usePagination } from '#shared/composables/usePagination.ts'
import { EnumOrderDirection } from '#shared/graphql/types.ts'
import { QueryHandler } from '#shared/server/apollo/handler/index.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { useTicketOverviewsStore } from '#mobile/entities/ticket/stores/ticketOverviews.ts'
import { useTicketsByOverviewSlimQuery } from '#mobile/pages/ticket/graphql/queries/ticketsByOverviewSlim.api.ts'

// Student Hub: the student's own tickets, latest change first, for Home's latest ticket and the
// Tickets tab. They come from Zammad's "My Tickets" view, whose condition is "the customer is
// the current user", so tickets of others in a shared organisation never come back.

const MY_TICKETS = 'my_tickets'
const PAGE_SIZE = 50

export const useStudenthubMyTickets = () => {
  const overviews = useTicketOverviewsStore()
  const myTickets = computed(() =>
    overviews.overviews.find((overview) => overview.link === MY_TICKETS),
  )

  // Home and the Tickets tab share one cache entry (the page size is not part of its key), so
  // each fetches as well, or the tab would show what Home left there.
  const ticketsQuery = new QueryHandler(
    useTicketsByOverviewSlimQuery(
      () => ({
        overviewId: myTickets.value?.id ?? '',
        orderBy: 'updated_at',
        orderDirection: EnumOrderDirection.Descending,
        pageSize: PAGE_SIZE,
        showPriority: false,
        showUpdatedBy: false,
      }),
      () => ({ enabled: Boolean(myTickets.value), fetchPolicy: 'cache-and-network' }),
    ),
  )

  const result = ticketsQuery.result()
  const ticketsLoading = ticketsQuery.loadingWithoutCachedResult()

  return {
    hasMyTickets: computed(() => Boolean(myTickets.value)),
    tickets: computed(() => edgesToArray(result.value?.ticketsByOverview)),
    loading: computed(() => overviews.loading || ticketsLoading.value),
    pagination: usePagination(ticketsQuery, 'ticketsByOverview', PAGE_SIZE),
  }
}
