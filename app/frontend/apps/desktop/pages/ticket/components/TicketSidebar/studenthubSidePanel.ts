// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { InjectionKey, Ref } from 'vue'

// Student Hub: set by StudenthubTicketSideRail (ticket screen).
// - "split" (students, New ticket): panels opened from the rail move to the right panel, except
//   `leftPanel`, which stays in the sidebar column.
// - "column" (agents, queue beside the ticket): every panel opens in the sidebar column, one at a
//   time (`visiblePanel`). `leftPanel` stays mounted while hidden, because it holds the ticket form.
export type StudenthubSidePanelMode = 'split' | 'column'

export const STUDENTHUB_SIDE_PANEL_KEY = Symbol('studenthub-side-panel') as InjectionKey<{
  leftPanel: string
  mode: StudenthubSidePanelMode
  visiblePanel: Readonly<Ref<string>>
}>

export const STUDENTHUB_LEFT_PANEL_TARGET = '#ticketSidebar'
export const STUDENTHUB_RIGHT_PANEL_TARGET = '#studenthubSidePanel'
