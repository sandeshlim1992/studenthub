// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, type ComputedRef } from 'vue'

export const useBubbleStyleGuide = (
  position: ComputedRef<'left' | 'right'>,
  isArticleTypeNote: ComputedRef<boolean>,
) => {
  // Student Hub: customer messages white, staff replies in a light application colour,
  // internal notes amber (instead of Zammad's stripes).
  const bodyClasses = computed(() => {
    if (isArticleTypeNote.value) return ['dark:bg-stone-500', 'bg-[#fff8e6]']

    return position.value === 'right'
      ? ['dark:bg-stone-500', 'bg-[var(--sh-app-soft)]']
      : ['dark:bg-gray-400', 'bg-white']
  })

  const dividerClass = computed(() => {
    if (position.value === 'right')
      return 'border-t border-t-neutral-100 dark:border-t-gray-900 print:border-black'

    return 'border-t border-t-neutral-300 dark:border-t-gray-900 print:border-black'
  })

  const frameBorderClass = computed(() => {
    if (isArticleTypeNote.value) return ''

    if (position.value === 'right')
      return 'border border-[color-mix(in_srgb,var(--sh-app)_18%,white)] dark:border-gray-900 print:border-black'

    return 'border border-[var(--sh-line)] dark:border-gray-900 print:border-black'
  })

  const headerAndIconBarBackgroundClass = computed(() => {
    if (isArticleTypeNote.value) return ['dark:bg-stone-700', 'bg-[#fdf0cf]']

    return position.value === 'right'
      ? ['dark:bg-stone-700', 'bg-[color-mix(in_srgb,var(--sh-app)_14%,white)]']
      : ['dark:bg-gray-500', 'bg-[var(--sh-panel)]']
  })

  // We need this class otherwise on a transition the edges of children are shown
  const articleWrapperBorderClass = computed(() =>
    position.value === 'right'
      ? 'ltr:rounded-br-none rtl:rounded-bl-none'
      : 'ltr:rounded-bl-none rtl:rounded-br-none',
  )

  const internalNoteClass = computed(() => {
    if (!isArticleTypeNote.value) return ''

    // Student Hub: amber outline instead of Zammad's stripes (`.bg-stripes`).
    return position.value === 'right'
      ? 'print:outline-1! print:outline-dashed print:outline-black  before:rounded-2xl relative z-0 rounded-xl outline outline-1 outline-[#e9cf8c] ltr:rounded-br-none rtl:rounded-bl-none ltr:before:rounded-br-none rtl:before:rounded-bl-none'
      : 'print:outline-1! print:outline-dashed print:outline-black  before:rounded-2xl relative z-0 rounded-xl outline outline-1 outline-[#e9cf8c] ltr:rounded-bl-none rtl:rounded-br-none ltr:before:rounded-bl-none rtl:before:rounded-br-none'
  })

  return {
    bodyClasses,
    dividerClass,
    frameBorderClass,
    headerAndIconBarBackgroundClass,
    articleWrapperBorderClass,
    internalNoteClass,
  }
}
