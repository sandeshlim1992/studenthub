// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubManagerSiteStats from '../components/StudenthubManagerSiteStats.vue'

const json = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) })

describe('Student Hub manager sites', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('My sites on the manager dashboard', () => {
    it("shows each site's numbers with a link to its view", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          json({
            settings: { new_period_days: 7, closed_period_days: 30 },
            sites: [
              {
                organization_id: 1,
                name: 'FSB',
                view_link: 'studenthub_site_managers_1',
                open: 12,
                new: 4,
                waiting: 3,
                escalated: 1,
                closed: 20,
                teams: [{ name: 'Service Desk', count: 9 }],
                categories: [{ name: 'Software', count: 5 }],
              },
            ],
          }),
        ),
      )

      const view = renderComponent(StudenthubManagerSiteStats, { router: true })

      const site = await view.findByRole('article', { name: 'FSB' })
      expect(site).toHaveTextContent('Open12')
      expect(site).toHaveTextContent('New (7 days)4')
      expect(site).toHaveTextContent('Escalated1')
      expect(site).toHaveTextContent('Service Desk9')
      expect(view.getByRole('link', { name: 'Open site view →' })).toHaveAttribute(
        'href',
        expect.stringContaining('/tickets/view/studenthub_site_managers_1'),
      )
    })

    it('stays hidden for managers without sites', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ settings: {}, sites: [] })))

      const view = renderComponent(StudenthubManagerSiteStats, { router: true })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(view.queryByRole('heading', { name: 'My sites' })).not.toBeInTheDocument()
    })
  })
})
