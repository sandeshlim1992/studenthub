<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'

import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import { usePersistentStates } from '#desktop/pages/ticket/composables/usePersistentStates.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import type { TicketSidebarEmits, TicketSidebarProps } from '#desktop/pages/ticket/types/sidebar.ts'

import TicketSidebarContent from '../TicketSidebarContent.vue'
import TicketSidebarWrapper from '../TicketSidebarWrapper.vue'

import { useTicketFeedback } from './useTicketFeedback.ts'

// Student Hub: the customer's rating of a closed ticket (Feedback Collection), as in the classic UI.

defineProps<TicketSidebarProps>()

const emit = defineEmits<TicketSidebarEmits>()

const { persistentStates } = usePersistentStates()
const { ticket } = useTicketInformation()

const ticketId = computed(() => ticket.value?.internalId)
const { items, isLoading, hasFailed, load } = useTicketFeedback(ticketId)

watch(ticketId, () => load(), { immediate: true })

onMounted(() => {
  emit('show')
})
</script>

<template>
  <TicketSidebarWrapper :key="sidebar" :sidebar="sidebar" :sidebar-plugin="sidebarPlugin" :selected="selected">
    <TicketSidebarContent v-model="persistentStates.scrollPosition" :title="sidebarPlugin.title" :icon="sidebarPlugin.icon">
      <CommonLoader :loading="isLoading && !items.length">
        <p v-if="hasFailed" class="text-sm text-[var(--sh-muted)]">{{ $t('Feedback could not be loaded.') }}</p>
        <p v-else-if="!items.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No feedback for this ticket yet.') }}</p>
        <ul v-else class="flex flex-col gap-3">
          <li
            v-for="item in items"
            :key="item.id"
            class="flex flex-col gap-1.5 rounded-lg border border-[var(--sh-line)] bg-white p-3"
          >
            <p class="flex items-center gap-1" :aria-label="$t('%s out of 5 stars', item.rating)">
              <span
                v-for="value in 5"
                :key="value"
                aria-hidden="true"
                class="text-lg leading-none"
                :class="value <= item.rating ? 'text-amber-500' : 'text-slate-300'"
              >★</span>
              <strong class="ms-1 text-sm text-[var(--sh-ink)]">{{ item.rating }}/5</strong>
            </p>
            <p v-if="item.comments" class="text-sm whitespace-pre-line text-[var(--sh-ink)]">{{ item.comments }}</p>
            <p class="flex flex-wrap gap-x-1 text-xs text-[var(--sh-muted)]">
              <span>{{ item.customer_name || $t('Customer') }}</span>
              <span aria-hidden="true">·</span>
              <CommonDateTime :date-time="item.rated_at" type="relative" />
            </p>
          </li>
        </ul>
      </CommonLoader>
    </TicketSidebarContent>
  </TicketSidebarWrapper>
</template>
