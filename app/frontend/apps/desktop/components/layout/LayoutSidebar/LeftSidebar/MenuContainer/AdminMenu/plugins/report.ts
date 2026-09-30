// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getCurrentRouter } from '#shared/router/router.ts'

import type { AdminMenuItem } from '#desktop/components/layout/LayoutSidebar/LeftSidebar/types.ts'

export default {
  order: 90,
  key: 'report',
  label: __('Reporting'),
  permission: ['report', 'admin.*'],
  variant: 'neutral',
  icon: 'speedometer2',
  onClick: () => {
    getCurrentRouter()?.push('/report')
  },
} as AdminMenuItem
