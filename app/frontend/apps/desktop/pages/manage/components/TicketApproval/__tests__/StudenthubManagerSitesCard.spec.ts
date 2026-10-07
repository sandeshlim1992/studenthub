// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubManagerSitesCard from '../StudenthubManagerSitesCard.vue'

const json = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) })

describe('Student Hub manager sites: admin card', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('assigns a site to a manager', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          organizations: [
            { id: 1, name: 'FSB' },
            { id: 2, name: 'LSST' },
          ],
          managers: [{ user_id: 7, name: 'Mia Manager', organization_ids: [1] }],
        }),
      )
      .mockResolvedValueOnce(json({ user_id: 7, organization_ids: [1, 2] }))
    vi.stubGlobal('fetch', fetchMock)

    const view = renderComponent(StudenthubManagerSitesCard)

    expect(await view.findByRole('checkbox', { name: 'FSB' })).toBeChecked()
    expect(view.getByRole('checkbox', { name: 'LSST' })).not.toBeChecked()

    await view.events.click(view.getByRole('checkbox', { name: 'LSST' }))

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/studenthub/manager_sites/7',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ organization_ids: [1, 2] }) }),
    )
    expect(await view.findByRole('status')).toHaveTextContent('Sites of Mia Manager saved.')
    expect(view.getByRole('checkbox', { name: 'LSST' })).toBeChecked()
  })
})
