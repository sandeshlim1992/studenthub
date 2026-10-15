// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { htmlCleanup } from '../htmlCleanup.ts'

// Pasted HTML goes through htmlCleanup. Parsed in the live page, an <img onerror> in it runs as the
// signed-in user; a document without a window loads nothing and runs nothing.
describe('htmlCleanup', () => {
  it('parses the HTML in a document without a window', () => {
    const element = htmlCleanup(
      '<img src="x" onerror="alert(1)"><p>text</p>',
      false,
      true,
    ) as Element

    expect(element.ownerDocument).not.toBe(document)
    expect(element.ownerDocument.defaultView).toBeNull()
  })

  it('builds nothing in the live page, not even the paragraphs it makes from line breaks', () => {
    const createElement = vi.spyOn(document, 'createElement')
    const cleaned = htmlCleanup('<div class="note"><br></div><p>text</p>')
    const builtInLivePage = createElement.mock.calls.map(([tag]) => tag)
    createElement.mockRestore()

    expect(cleaned).toBe('<p class="note"></p><p>text</p>')
    expect(builtInLivePage).toEqual([])
  })
})
