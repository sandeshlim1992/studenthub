<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { TicketArticle } from '#shared/entities/ticket/types.ts'

import { articleTypeLabel } from '#desktop/utils/studenthubTicketDetails.ts'

// Student Hub: small label in each message saying what it is (Email, Reply, Internal note…).
interface Props {
  article: Pick<TicketArticle, 'internal' | 'sender' | 'type'>
}

const props = defineProps<Props>()

const kind = computed(() => {
  if (props.article.internal) return { label: __('Internal note'), tone: 'internal' }

  const sender = props.article.sender?.name
  if (sender === 'Agent') return { label: __('Reply'), tone: 'reply' }
  if (sender === 'System') return { label: __('System'), tone: 'system' }

  const type = props.article.type?.name ?? ''
  return { label: articleTypeLabel(type), tone: 'incoming' }
})
</script>

<template>
  <span v-if="kind.label" class="sh-article-kind" :data-tone="kind.tone">{{ $t(kind.label) }}</span>
</template>
