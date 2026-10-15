// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { createMemoryHistory, createRouter } from 'vue-router'

import routes from '../routes.ts'

// Student Hub: the classic UI's Knowledge Base addresses (the help center's edit links, the activity
// stream) lead to the new UI's Knowledge Base page.

const router = createRouter({ history: createMemoryHistory(), routes })

const redirectOf = (path: string) => {
  const to = router.resolve(path)
  const redirect = to.matched[0]?.redirect

  return typeof redirect === 'function' ? redirect(to, router.currentRoute.value) : redirect
}

it("leads the classic UI's addresses to the Knowledge Base page", () => {
  expect(redirectOf('/knowledge_base/1/locale/en-us/answer/7')).toBe('/knowledge-base/answer/7')
  expect(redirectOf('/knowledge_base/1/locale/en-us/answer/7/edit')).toBe(
    '/knowledge-base/answer/7/edit',
  )
  expect(redirectOf('/knowledge_base/1/locale/de-de/category/5/edit')).toBe(
    '/knowledge-base/category/5',
  )
  expect(redirectOf('/knowledge_base/1/locale/en-us/edit')).toBe('/knowledge-base')
})

it('leaves the new addresses alone', () => {
  expect(router.resolve('/knowledge-base/answer/7').name).toBe('StudenthubKnowledgeBase')
})
