// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'

import StudenthubCampusBadge from '../StudenthubCampusBadge.vue'
import StudenthubTicketEscalation from '../StudenthubTicketEscalation.vue'
import StudenthubTicketPriority from '../StudenthubTicketPriority.vue'
import StudenthubTicketStateLabel from '../StudenthubTicketStateLabel.vue'

const state = (id: number, name: string, type: string) => ({
  id: `gid://zammad/Ticket::State/${id}`,
  name,
  stateType: { name: type },
})

describe('Student Hub ticket list cells', () => {
  describe('state label', () => {
    it('uses the colour chosen by an admin', () => {
      mockApplicationConfig({ studenthub_ticket_state_colors: { 9: 'green' } })

      const view = renderComponent(StudenthubTicketStateLabel, {
        props: { state: state(9, '5. Resolved', 'open') },
      })

      expect(view.getByText('5. Resolved').parentElement).toHaveAttribute('data-tone', 'green')
    })

    it('falls back to the type colour for states without one', () => {
      mockApplicationConfig({ studenthub_ticket_state_colors: {} })

      const view = renderComponent(StudenthubTicketStateLabel, {
        props: { state: state(7, '4.1 Pending / On Hold', 'pending reminder') },
      })

      expect(view.getByText('4.1 Pending / On Hold').parentElement).toHaveAttribute('data-tone', 'amber')
    })
  })

  it('shows the priority name with its level', () => {
    const view = renderComponent(StudenthubTicketPriority, {
      props: { priority: { name: 'P1  - Critical', uiColor: 'high-priority' } },
    })

    expect(view.getByText('P1 - Critical').parentElement).toHaveAttribute('data-level', 'critical')
  })

  describe('escalation', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-10-04T12:00:00Z') })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('marks a passed deadline as overdue', () => {
      mockApplicationConfig({ studenthub_escalation_warning_minutes: 60 })

      const view = renderComponent(StudenthubTicketEscalation, {
        props: { value: '2026-10-04T11:15:00Z' },
      })

      expect(view.getByText('overdue 45 min').parentElement).toHaveAttribute('data-status', 'overdue')
    })

    it('follows the admin\'s "due soon" point', () => {
      mockApplicationConfig({ studenthub_escalation_warning_minutes: 15 })

      const view = renderComponent(StudenthubTicketEscalation, {
        props: { value: '2026-10-04T12:35:00Z' },
      })

      expect(view.getByText('due in 35 min')).toHaveAttribute('data-status', 'later')
    })

    it('shows a dash without a deadline', () => {
      const view = renderComponent(StudenthubTicketEscalation, { props: { value: null } })

      expect(view.getByText('-')).toHaveAttribute('data-status', 'none')
    })
  })

  it('shows the institution of a campus as a badge', () => {
    const view = renderComponent(StudenthubCampusBadge, { props: { value: 'LSST Wembley' } })

    expect(view.getByText('LSST')).toBeInTheDocument()
    expect(view.getByText('Wembley')).toBeInTheDocument()
  })
})
