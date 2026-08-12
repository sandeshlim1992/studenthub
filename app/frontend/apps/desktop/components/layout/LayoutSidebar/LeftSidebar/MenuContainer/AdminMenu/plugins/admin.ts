// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getCurrentRouter } from '#shared/router/router.ts'
import type { AdminMenuItem } from '#desktop/components/layout/LayoutSidebar/LeftSidebar/types.ts'

export default {
  order: 100,
  key: 'admin',
  label: __('Administration'),
  permission: ['admin.*'],
  variant: 'neutral',
  icon: 'gear',
  onClick: () => {
    getCurrentRouter()?.push('/manage')
  },
} as AdminMenuItem
