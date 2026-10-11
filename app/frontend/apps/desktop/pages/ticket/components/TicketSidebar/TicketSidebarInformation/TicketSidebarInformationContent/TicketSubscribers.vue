<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { toRef } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useTicketSubscribe } from '#shared/entities/ticket/composables/useTicketSubscribe.ts'
import type { TicketById } from '#shared/entities/ticket/types.ts'

import UserPopoverWithTrigger from '#desktop/components/User/UserPopoverWithTrigger.vue'

export interface Props {
  ticket?: TicketById
}

const props = defineProps<Props>()

const ticketReactive = toRef(props, 'ticket')

// Student Hub: the panel is "Contributors", a list only: no "Subscribe me" toggle. People are
// added when someone @mentions them in a note.
const { subscribers } = useTicketSubscribe(ticketReactive)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex w-full flex-col rounded-lg bg-blue-200 px-3 py-3.5 dark:bg-gray-700">
      <CommonLabel v-if="!subscribers.length" class="text-stone-200! dark:text-neutral-500!">
        {{ $t('No contributors yet.') }}
      </CommonLabel>
      <!-- Student Hub: each contributor on a line of their own, with their full name -->
      <ul v-else class="flex flex-col gap-2">
        <li v-for="subscriber in subscribers" :key="subscriber.user.id">
          <UserPopoverWithTrigger
            :user="subscriber.user"
            :popover-config="{
              placement: 'arrowStart',
            }"
            no-focus-styling
          >
            <template #default="slotProps">
              <span class="flex items-center gap-2">
                <CommonUserAvatar
                  class="shrink-0 rounded-full outline-1 outline-transparent group-hover:outline-blue-600 group-focus-visible:outline-blue-800 group-hover:dark:outline-blue-900"
                  :class="{
                    'outline-2! outline-blue-800!':
                      slotProps?.isOpen && slotProps.hasOpenViaLongClick,
                  }"
                  :entity="subscriber.user"
                  :access="subscriber.access"
                  size="small"
                />
                <CommonLabel
                  class="line-clamp-2! break-word text-blue-800! group-hover:text-blue-850! group-focus-visible:text-blue-800! group-hover:dark:text-blue-600!"
                >
                  {{ subscriber.user.fullname }}
                </CommonLabel>
              </span>
            </template>
          </UserPopoverWithTrigger>
        </li>
      </ul>
    </div>
  </div>
</template>
