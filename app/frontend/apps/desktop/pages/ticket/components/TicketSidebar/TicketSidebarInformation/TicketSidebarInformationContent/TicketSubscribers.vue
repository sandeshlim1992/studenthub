<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { nextTick, toRef, watch } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useTicketSubscribe } from '#shared/entities/ticket/composables/useTicketSubscribe.ts'
import type { TicketById } from '#shared/entities/ticket/types.ts'

import UserPopoverWithTrigger from '#desktop/components/User/UserPopoverWithTrigger.vue'

export interface Props {
  ticket?: TicketById
}

const props = defineProps<Props>()

const ticketReactive = toRef(props, 'ticket')

const { isSubscribed, isSubscriptionLoading, toggleSubscribe, subscribers, totalSubscribers } =
  useTicketSubscribe(ticketReactive)

let isOutsideUpdate = false
watch(
  () => isSubscribed.value,
  () => {
    isOutsideUpdate = true
    nextTick(() => {
      isOutsideUpdate = false
    })
  },
)

const handleToggleInput = async () => {
  // do not trigger update, if value was changed from the outside,
  // and not by clicking on toggle button, otherwise it goes into infinite loop
  if (isOutsideUpdate) return false
  return toggleSubscribe()
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex w-full flex-col rounded-lg bg-blue-200 px-3 py-3.5 dark:bg-gray-700">
      <div
        class="flex gap-2"
        :class="{
          'border-b border-neutral-100 pb-2 dark:border-gray-900': subscribers.length,
        }"
      >
        <FormKit
          type="toggle"
          :model-value="isSubscribed"
          :label="__('Subscribe me')"
          :variants="{
            true: __('yes'),
            false: __('no'),
          }"
          :disabled="isSubscriptionLoading"
          outer-class="grow"
          wrapper-class="!px-0 $remove:h-10"
          @input-raw="handleToggleInput"
        />
      </div>
      <!-- Student Hub: each subscriber on a line of their own, with their full name -->
      <ul v-if="totalSubscribers > 0" class="flex flex-col gap-2 pt-2.5">
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
