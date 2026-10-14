// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import '#tests/graphql/builders/mocks.ts'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { EnumTaskbarEntity, EnumTaskbarEntityAccess } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import { mockUserCurrentRecentCloseListQuery } from '#desktop/entities/user/current/graphql/queries/userCurrentRecentCloseList.mocks.ts'
import {
  mockUserCurrentTaskbarItemListQuery,
  waitForUserCurrentTaskbarItemListQueryCalls,
} from '#desktop/entities/user/current/graphql/queries/userCurrentTaskbarItemList.mocks.ts'

import AvatarMenu from '../AvatarMenu.vue'

// Student Hub: with fewer than five recently closed items, the avatar menu fills "Recently
// viewed" from the open ticket tabs (their type is TicketZoom).
it('lists a ticket open in a tab under Recently viewed', async () => {
  mockUserCurrent({ firstname: 'Agent', lastname: 'Smith', fullname: 'Agent Smith' })
  mockUserCurrentRecentCloseListQuery({ userCurrentRecentCloseList: [] })
  mockUserCurrentTaskbarItemListQuery({
    userCurrentTaskbarItemList: [
      {
        __typename: 'UserTaskbarItem',
        id: convertToGraphQLId('Taskbar', 1),
        key: 'Ticket-42',
        callback: EnumTaskbarEntity.TicketZoom,
        entityAccess: EnumTaskbarEntityAccess.Granted,
        entity: {
          __typename: 'Ticket',
          id: convertToGraphQLId('Ticket', 42),
          internalId: 42,
          number: '53042',
          title: 'Laptop will not start',
        },
      },
    ],
  })

  const view = renderComponent(AvatarMenu, { router: true, store: true, dialog: true })
  await waitForUserCurrentTaskbarItemListQueryCalls()

  await view.events.click(view.getByRole('button', { name: 'Agent Smith' }))

  expect(await view.findByText('#53042 Laptop will not start')).toBeInTheDocument()
})
