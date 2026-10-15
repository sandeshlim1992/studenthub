// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { User } from '#shared/graphql/types.ts'
import { getCurrentRouter } from '#shared/router/router.ts'

import type { DetailViewActionPlugin } from '#desktop/types/actions.ts'

export default <DetailViewActionPlugin>{
  key: 'delete-user',
  label: __('Delete'),
  icon: 'trash',
  order: 400,
  permission: ['admin.data_privacy', 'admin.user'],
  onClick: (user?: User) => {
    if (!user) return

    // Student Hub: the new UI's Data Privacy page opens a new deletion task for this user. The classic
    // UI's #system/data_privacy/… opened the new UI's home page, which is served at / (Studenthub::NewUiAtRoot).
    // The action menu passes no router, so the app's own is used.
    getCurrentRouter()?.push(`/manage/system/data_privacy/${user.internalId}`)
  },
}
