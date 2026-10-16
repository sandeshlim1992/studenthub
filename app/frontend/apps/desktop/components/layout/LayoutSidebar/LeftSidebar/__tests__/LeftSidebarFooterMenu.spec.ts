// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'

import LeftSidebarFooterMenu from '../LeftSidebarFooterMenu.vue'

const isSmallScreen = ref(false)

vi.mock('#desktop/composables/responsiveness/useAppBreakpoints.ts', () => ({
  useAppBreakpoints: () => ({
    isSmallScreen,
    isSmallestScreen: ref(false),
  }),
}))

describe('layout sidebar footer menu', () => {
  beforeEach(() => {
    mockUserCurrent({
      lastname: 'Doe',
      firstname: 'John',
    })
    useSidebarDisplay(SidebarName.Primary).toggleSidebar(false)
    isSmallScreen.value = false
  })

  it('renders user avatar', async () => {
    const view = renderComponent(LeftSidebarFooterMenu, {
      router: true,
      form: true,
      store: true,
    })

    expect(view.getByText('JD')).toBeInTheDocument()

    const avatar = view.getByTestId('common-avatar')
    expect(avatar).toHaveClass('size-normal')
  })

  it('renders small user avatar in collapsed mode', async () => {
    useSidebarDisplay(SidebarName.Primary).toggleSidebar(true)

    const view = renderComponent(LeftSidebarFooterMenu, {
      router: true,
    })

    expect(view.getByText('JD')).toBeInTheDocument()

    const avatar = view.getByTestId('common-avatar')
    expect(avatar).toHaveClass('size-small')
  })

  it('renders the inline collapse button on smaller screens', async () => {
    isSmallScreen.value = true
    useSidebarDisplay(SidebarName.Primary).toggleSidebar(true)

    const view = renderComponent(LeftSidebarFooterMenu, {
      router: true,
      form: true,
    })

    const collapseButton = view.getByLabelText('Expand sidebar')

    expect(collapseButton.parentElement).toHaveClass('order-last')
    expect(collapseButton.parentElement).not.toHaveClass('absolute')

    isSmallScreen.value = false
  })
  // Student Hub: the BETA UI switch and its feedback dialog are gone (.dev/classic-ui-removal.md).
})
