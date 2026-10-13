// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
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

vi.mock(
  '#desktop/components/BetaUi/FeedbackDialog/useFeedbackDialog.ts',
  async (originalModule) => {
    const module =
      await originalModule<typeof import('#desktop/components/CommonDialog/useDialog.ts')>()

    return {
      ...module,
      useFeedbackDialog: () => ({
        openFeedbackDialog: ({ callback }: { callback: () => void }) => {
          callback()
        },
      }),
    }
  },
)

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

  describe('Feature: Beta UI Switch', () => {
    beforeAll(() => {
      Object.defineProperty(window, 'location', {
        value: {
          ...window.location,
          pathname: '/desktop',
          href: '/desktop',
        },
      })
    })

    beforeEach(() => {
      mockApplicationConfig({
        ui_desktop_beta_switch: true,
      })

      mockUserCurrent({
        hasBetaUiSwitchAvailable: true,
      })
    })

    it('shows the switch if the feature is enabled', async () => {
      const wrapper = renderComponent(LayoutPage, {
        router: true,
        form: true,
      })

      const toggle = wrapper.getByLabelText('BETA UI')

      expect(toggle).toBeChecked()

      expect(window.location.href).toBe('/desktop')

      await wrapper.events.click(toggle)

      // Student Hub: the classic UI is at /app
      await waitFor(() => expect(window.location.href).toBe('/app'))
    })

    it('hides the switch if the feature is disabled', async () => {
      mockApplicationConfig({
        ui_desktop_beta_switch: false,
      })

      const wrapper = renderComponent(LayoutPage, {
        router: true,
        form: true,
      })

      expect(wrapper.queryByLabelText('BETA UI')).not.toBeInTheDocument()
    })

    it('hides the switch if the user has no permissions', async () => {
      mockUserCurrent({
        hasBetaUiSwitchAvailable: false,
      })

      const wrapper = renderComponent(LayoutPage, {
        router: true,
        form: true,
      })

      expect(wrapper.queryByLabelText('BETA UI')).not.toBeInTheDocument()
    })

    it('hides the switch if the user has dismissed it', async () => {
      localStorage.setItem('beta-ui-switch-dismiss', 'true')

      const wrapper = renderComponent(LayoutPage, {
        router: true,
        form: true,
      })

      expect(wrapper.queryByLabelText('BETA UI')).not.toBeInTheDocument()

      localStorage.removeItem('beta-ui-switch-dismiss')
    })

    it('dismisses the switch on demand', async () => {
      const wrapper = renderComponent(LayoutPage, {
        router: true,
        form: true,
      })

      const toggle = wrapper.getByLabelText('BETA UI')

      const button = wrapper.getByRole('button', {
        name: 'Hide BETA UI switch',
      })

      await wrapper.events.click(button)

      expect(toggle).not.toBeInTheDocument()
      expect(button).not.toBeInTheDocument()
    })
  })
})
