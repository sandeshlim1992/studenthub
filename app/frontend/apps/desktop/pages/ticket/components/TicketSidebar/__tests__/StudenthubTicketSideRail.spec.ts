// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, defineComponent, h, ref, shallowRef } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { TicketSidebarScreenType } from '#desktop/pages/ticket/types/sidebar.ts'

import StudenthubTicketSideRail from '../StudenthubTicketSideRail.vue'

// A plugin stand-in: its button, plus a marker while it is "selected" (open).
const pluginStub = (title: string) =>
  defineComponent({
    props: { selected: Boolean, sidebar: String, sidebarPlugin: Object, context: Object },
    emits: ['click', 'show', 'hide'],
    mounted() {
      this.$emit('show')
    },
    render() {
      return h('div', [
        h('button', { type: 'button', onClick: () => this.$emit('click', this.sidebar) }, title),
        this.selected ? h('p', `${title} open`) : null,
      ])
    },
  })

const allPlugins = {
  information: { title: 'Ticket', component: pluginStub('Ticket') },
  customer: { title: 'Customer', component: pluginStub('Customer') },
  checklist: { title: 'Checklist', component: pluginStub('Checklist') },
}

const plugins = shallowRef<Record<string, (typeof allPlugins)['customer']>>(allPlugins)

const activeSidebar = ref('information')
const shownSidebars = ref<Record<string, boolean>>({})

vi.mock('#desktop/pages/ticket/composables/useTicketSidebar.ts', () => ({
  useTicketSidebar: () => ({
    activeSidebar,
    availableSidebarPlugins: computed(() => plugins.value),
    shownSidebars,
    showSidebar: (sidebar: string) => {
      shownSidebars.value[sidebar] = true
    },
    hideSidebar: (sidebar: string) => {
      shownSidebars.value[sidebar] = false
    },
    switchSidebar: (sidebar: string) => {
      activeSidebar.value = sidebar
    },
  }),
}))

const isManagerOnly = ref(false)

vi.mock('#desktop/composables/useStudenthubApprovalViewer.ts', () => ({
  useStudenthubApprovalViewer: () => ({
    isApprover: computed(() => isManagerOnly.value),
    isLoaded: computed(() => true),
    isManagerOnly: computed(() => isManagerOnly.value),
  }),
}))

const renderRail = (view: 'agent' | 'customer' = 'agent') =>
  renderComponent(StudenthubTicketSideRail, {
    props: {
      context: { screenType: TicketSidebarScreenType.TicketDetailView, formValues: {}, view },
    },
  })

describe('StudenthubTicketSideRail', () => {
  beforeEach(() => {
    plugins.value = allPlugins
    activeSidebar.value = 'information'
    shownSidebars.value = {}
    isManagerOnly.value = false
  })

  it('shows the panel icons without Ticket, which always stays open', async () => {
    const view = renderRail()

    expect(await view.findByRole('navigation', { name: 'Ticket panels' })).toBeVisible()
    expect(view.getByRole('button', { name: 'Customer' })).toBeVisible()
    expect(view.getByText('Ticket', { selector: 'button' })).not.toBeVisible()
    expect(view.getByText('Ticket open')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Customer' }))
    expect(view.getByText('Customer open')).toBeInTheDocument()
    expect(view.getByText('Ticket open')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Close panel' }))
    expect(activeSidebar.value).toBe('information')
  })

  // "New ticket" has no Ticket panel: Zammad keeps the first panel (Customer) active.
  it('keeps a closed panel closed where there is no Ticket panel', async () => {
    plugins.value = { customer: allPlugins.customer, checklist: allPlugins.checklist }
    activeSidebar.value = 'customer'

    const view = renderRail()

    expect(await view.findByText('Customer open')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Close panel' }))
    expect(view.queryByText('Customer open')).not.toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Customer' }))
    expect(view.getByText('Customer open')).toBeInTheDocument()
  })

  it('leaves the icons out for managers without another staff role', () => {
    isManagerOnly.value = true

    const view = renderRail()

    expect(view.container.querySelector('nav[aria-label="Ticket panels"]')).not.toBeVisible()
    expect(view.queryByText('Customer')).not.toBeInTheDocument()
    expect(view.getByText('Ticket open')).toBeInTheDocument()
  })

  it('leaves the icons out for customers', () => {
    const view = renderRail('customer')

    expect(view.queryByText('Checklist')).not.toBeInTheDocument()
    expect(view.getByText('Ticket open')).toBeInTheDocument()
  })
})
