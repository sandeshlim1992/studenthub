// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { createTestingPinia } from '@pinia/testing'

import { useHtmlLinks } from '../useHtmlLinks.ts'

const buildSampleElement = () => {
  const elem = document.createElement('div')

  elem.innerHTML = `some text
  <a href="http://example.com/asd" external>external</a>
  <a href="/test" internal>internal</a>
  <a href="/desktop/old" legacy>legacy</a>
  <a href="/api/v1/attachments/1" server>server</a>
  <a href="/blank" blank target=_blank>blank</a>
  <a data-mention-user-id="123" mention>mention</a>
  her text`

  return elem
}

const routerPush = vi.fn()

vi.mock('vue-router', async () => {
  return {
    useRouter: () => {
      return {
        push: routerPush,
        // Student Hub: the router knows every page except the server's own paths
        resolve: (path: string) => ({
          name: path.startsWith('/api/') ? 'Error' : 'Page',
          fullPath: path,
        }),
      }
    },
  }
})

describe('setupLinkHandlers', () => {
  createTestingPinia({ createSpy: vi.fn })

  it('replaces mention links with URLs to user profile', async () => {
    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[mention]')?.click()

    expect(routerPush).toHaveBeenCalledWith('/users/123')
  })

  it('opens internal link via the router', () => {
    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[internal]')?.click()

    expect(routerPush).toHaveBeenCalledWith('/test')
  })

  it('opens an old /desktop link via the router without /desktop', () => {
    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[legacy]')?.click()

    expect(routerPush).toHaveBeenCalledWith('/old')
  })

  it('leaves links to the server (attachments, the API) to the browser', () => {
    vi.stubGlobal('open', vi.fn())
    routerPush.mockClear()

    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[server]')?.click()

    expect(routerPush).not.toHaveBeenCalled()
  })

  it('opens internal _blank link in a new tab', () => {
    vi.stubGlobal('open', vi.fn())
    const spy = vi.spyOn(window, 'open')

    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[blank]')?.click()

    expect(spy).toHaveBeenCalledWith('/blank', '_blank')
  })

  it('opens external link directly', () => {
    vi.stubGlobal('open', vi.fn())
    const spy = vi.spyOn(window, 'open')

    const elem = buildSampleElement()

    const { setupLinksHandlers } = useHtmlLinks('')

    setupLinksHandlers(elem)

    elem.querySelector<HTMLLinkElement>('a[external]')?.click()

    expect(routerPush).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })
})
