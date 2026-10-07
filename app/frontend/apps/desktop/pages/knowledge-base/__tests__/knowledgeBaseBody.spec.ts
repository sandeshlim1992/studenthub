// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { knowledgeBaseImageCids, prepareKnowledgeBaseBody } from '../utils/knowledgeBaseBody.ts'

describe('Knowledge Base answer text with images', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('remembers the cid of each image Zammad sent', () => {
    expect(
      knowledgeBaseImageCids(
        '<p><img src="/api/v1/attachments/5" cid="a@zammad"><img src="https://example.com/x.png"></p>',
      ),
    ).toEqual({ '/api/v1/attachments/5': 'a@zammad' })
  })

  it('gives images that were there their cid back and embeds new ones', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['png']), { headers: { 'Content-Type': 'image/png' } })),
    )

    const body = await prepareKnowledgeBaseBody(
      '<p><img src="/api/v1/attachments/5"><img src="/api/v1/attachments/9"><img src="https://example.com/x.png"></p>',
      { '/api/v1/attachments/5': 'a@zammad' },
    )

    const images = Array.from(new DOMParser().parseFromString(body, 'text/html').querySelectorAll('img'))
    expect(images[0].getAttribute('cid')).toBe('a@zammad')
    expect(images[0].getAttribute('src')).toBe('/api/v1/attachments/5')
    expect(images[1].getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    expect(images[2].getAttribute('src')).toBe('https://example.com/x.png')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
