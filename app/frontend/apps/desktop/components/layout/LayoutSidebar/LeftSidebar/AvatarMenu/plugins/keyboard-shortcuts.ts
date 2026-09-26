// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { openDialog } from '#desktop/components/CommonDialog/useDialog.ts'

import type { AvatarMenuPlugin } from './index.ts'

export default <AvatarMenuPlugin>{
  key: 'keyboard-shortcuts',
  label: __('Keyboard shortcuts'),
  show: () => true,
  onClick: () => {
    openDialog('keyboard-shortcuts', {}, true)
  },
  icon: 'keyboard',
  order: 200,
  permission: ['admin.*', 'ticket.agent'],
}
