// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { InjectionKey } from 'vue'

// Student Hub: set by StudenthubTicketSideRail (ticket screen). Sidebar panels opened from the
// rail move to the right panel, except `leftPanel`, which stays in the left column.
export const STUDENTHUB_SIDE_PANEL_KEY = Symbol('studenthub-side-panel') as InjectionKey<{
  leftPanel: string
}>

export const STUDENTHUB_LEFT_PANEL_TARGET = '#ticketSidebar'
export const STUDENTHUB_RIGHT_PANEL_TARGET = '#studenthubSidePanel'
