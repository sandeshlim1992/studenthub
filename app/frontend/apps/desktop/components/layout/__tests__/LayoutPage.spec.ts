// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import { useSessionStore } from '#shared/stores/session.ts'

import LayoutPage from '#desktop/components/layout/LayoutPage.vue'

import '#tests/graphql/builders/mocks.ts'

vi.mock('#shared/server/apollo/client.ts', () => ({
  getApolloClient: () => ({
    cache: {
      readQuery: vi.fn(),
      writeQuery: vi.fn(),
    },
  }),
}))

describe('LayoutPage', () => {
  beforeEach(() => {
    mockUserCurrent()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('expands search and focus quick search input', async () => {
    const wrapper = renderComponent(LayoutPage, {
      router: true,
      form: true,
    })

    // one button has display none it's for smaller screens
    await wrapper.events.click(
      wrapper.getAllByRole('button', {
        name: 'Collapse sidebar',
      })[0],
    )

    expect(
      wrapper.queryByRole('searchbox', {
        name: 'Search…',
      }),
    ).not.toBeInTheDocument()

    await wrapper.events.click(
      wrapper.getByRole('button', {
        name: 'Open quick search',
      }),
    )

    await waitForNextTick()

    expect(
      wrapper.getByRole('searchbox', {
        name: 'Search…',
      }),
    ).toHaveFocus()
  })

  it('leaves out the navigation panel on Administration and Reporting', async () => {
    const page = { template: '<div />' }
    const wrapper = renderComponent(LayoutPage, {
      router: true,
      form: true,
      routerRoutes: [
        { path: '/', name: 'Home', component: page },
        { path: '/manage/roles', name: 'ManageRoles', component: page },
        { path: '/report', name: 'Report', component: page },
      ],
    })

    await wrapper.router.push('/')

    expect(wrapper.container.querySelector('#studenthub-nav-panel')).toBeInTheDocument()

    await wrapper.router.push('/manage/roles')

    expect(wrapper.container.querySelector('#studenthub-nav-panel')).not.toBeInTheDocument()

    await wrapper.router.push('/report')

    expect(wrapper.container.querySelector('#studenthub-nav-panel')).not.toBeInTheDocument()

    // The test router is shared; the next tests start on the home page.
    await wrapper.router.push('/')
  })

  it('closes every page, kept-alive ones too, as soon as signing out clears the user', async () => {
    const unmounted = vi.fn()
    const page = (name: string) => ({
      name,
      template: '<div />',
      unmounted: () => unmounted(name),
    })
    const wrapper = renderComponent(LayoutPage, {
      router: true,
      form: true,
    })

    // The test router is shared (its routes come from the first test), so add the pages here.
    wrapper.router.addRoute({
      path: '/kept-alive',
      name: 'KeptAlive',
      component: page('KeptAlive'),
    })
    wrapper.router.addRoute({ path: '/current', name: 'Current', component: page('Current') })

    await wrapper.router.push('/kept-alive')
    await wrapper.router.push('/current')
    expect(wrapper.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument()

    useSessionStore().resetCurrentSession()
    await waitForNextTick()

    expect(wrapper.queryByRole('navigation', { name: 'Navigation' })).not.toBeInTheDocument()
    expect(unmounted).toHaveBeenCalledWith('KeptAlive')
    expect(unmounted).toHaveBeenCalledWith('Current')

    await wrapper.router.push('/')
    wrapper.router.removeRoute('KeptAlive')
    wrapper.router.removeRoute('Current')
  })

  // Student Hub: the BETA UI switch is gone (.dev/classic-ui-removal.md).
})
