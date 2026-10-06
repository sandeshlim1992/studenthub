// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { createSharedComposable, useNow } from '@vueuse/core'

// One clock for all escalation cells of a list, instead of a timer per row.
export const useStudenthubNow = createSharedComposable(() => useNow({ interval: 30_000 }))
