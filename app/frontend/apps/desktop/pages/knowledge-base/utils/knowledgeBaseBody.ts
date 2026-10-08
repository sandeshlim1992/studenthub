// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { blobToBase64 } from '#shared/utils/files.ts'

// Student Hub: answer text with images, between Zammad and the editor.
//
// Zammad stores inline images as attachments referenced by "cid:" and sends them as
// <img src="/api/v1/attachments/:id" cid="…"> (HasRichText#body_with_urls). The editor drops the cid
// attribute, and pasted images become blob: or upload-cache addresses. Before saving, images that
// were there keep their cid (so Zammad keeps the attachment) and new ones are embedded as data URLs
// (so Zammad stores them as attachments of the answer).

const wrap = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

// src → cid of the images in the text as Zammad sent it.
export const knowledgeBaseImageCids = (html: string) => {
  const cids: Record<string, string> = {}
  wrap(html)
    .querySelectorAll('img[cid]')
    .forEach((image) => {
      const src = image.getAttribute('src')
      const cid = image.getAttribute('cid')
      if (src && cid) cids[src] = cid
    })
  return cids
}

const toDataUrl = async (src: string) => {
  const response = await fetch(src, { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`${response.status}`)
  return blobToBase64(await response.blob())
}

export const prepareKnowledgeBaseBody = async (html: string, cids: Record<string, string>) => {
  const container = wrap(html)

  await Promise.all(
    Array.from(container.querySelectorAll('img')).map(async (image) => {
      const src = image.getAttribute('src') ?? ''

      if (cids[src]) {
        image.setAttribute('cid', cids[src])
        return
      }

      if (src.startsWith('blob:') || src.startsWith('/api/v1/attachments/')) {
        image.setAttribute('src', await toDataUrl(src))
      }
    }),
  )

  return container.innerHTML
}
