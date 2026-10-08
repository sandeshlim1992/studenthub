// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { InjectionKey, Ref } from 'vue'

// Student Hub: set by StudenthubTicketSideRail (ticket screen).
// - "split" (students, New ticket): panels opened from the rail move to the right panel, except
//   `leftPanel`, which stays in the sidebar column.
// - "column" (agents, queue beside the ticket): every panel opens in the sidebar column, one at a
//   time (`visiblePanel`). `leftPanel` stays mounted while hidden, because it holds the ticket form.
//   While the column is open the icons are named tabs above it (`tabs`); collapsed, icons again.
export type StudenthubSidePanelMode = 'split' | 'column'

export const STUDENTHUB_SIDE_PANEL_KEY = Symbol('studenthub-side-panel') as InjectionKey<{
  leftPanel: string
  mode: StudenthubSidePanelMode
  visiblePanel: Readonly<Ref<string>>
  tabs: Readonly<Ref<boolean>>
}>

export const STUDENTHUB_LEFT_PANEL_TARGET = '#ticketSidebar'
export const STUDENTHUB_RIGHT_PANEL_TARGET = '#studenthubSidePanel'

// The agents' tabs: Ticket, Student, Checklist, Approval (other panels get a tab only while they
// apply, e.g. Customer feedback on closed tickets). Organization has none: the Student panel shows
// the student's organisation.
export const STUDENTHUB_PANEL_TAB_LABELS: Record<string, string> = {
  customer: __('Student'),
}

export const STUDENTHUB_PANELS_WITHOUT_TAB = ['organization']
