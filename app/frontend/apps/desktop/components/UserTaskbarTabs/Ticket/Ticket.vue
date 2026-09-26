<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useTicketUpdatesSubscription } from '#shared/entities/ticket/graphql/subscriptions/ticketUpdates.api.ts'
import { EnumTicketStateColorCode, type Ticket } from '#shared/graphql/types.ts'
import SubscriptionHandler from '#shared/server/apollo/handler/SubscriptionHandler.ts'
import { GraphQLErrorTypes } from '#shared/types/error.ts'

import CommonTicketStateIndicatorIcon from '#desktop/components/CommonTicketStateIndicator/CommonTicketStateIndicatorIcon.vue'
import CommonUpdateIndicator from '#desktop/components/CommonUpdateIndicator/CommonUpdateIndicator.vue'
import { useUserTaskbarTab } from '#desktop/composables/useUserTaskbarTab.ts'
import { useTicketNumber } from '#desktop/pages/ticket/composables/useTicketNumber.ts'

import type { UserTaskbarTabEntityProps } from '../types.ts'

const props = defineProps<UserTaskbarTabEntityProps<Ticket>>()

const { ticketNumberWithTicketHook } = useTicketNumber(toRef(props.taskbarTab, 'entity'))

new SubscriptionHandler(
  useTicketUpdatesSubscription({
    ticketId: props.taskbarTab.entity!.id,
    initial: true,
  }),
  {
    // NB: Silence toast notifications for particular errors, these will be handled by the layout taskbar tab component.
    errorCallback: (errorHandler) =>
      errorHandler.type !== GraphQLErrorTypes.Forbidden &&
      errorHandler.type !== GraphQLErrorTypes.RecordNotFound,
  },
)

const { tabLinkInstance, taskbarTabActive } = useUserTaskbarTab(toRef(props, 'taskbarTab'))

const isTicketUpdated = computed(() => {
  return props.taskbarTab.notify
})

const currentState = computed(() => {
  return props.taskbarTab.entity?.state?.name || ''
})

const currentTitle = computed(() => {
  return props.taskbarTab.entity?.title || ''
})

const currentStateColorCode = computed(
  () => props.taskbarTab.entity?.stateColorCode || EnumTicketStateColorCode.Open,
)

const activeBackgroundColor = computed(() => {
  return 'bg-white/15! text-white! ring-1 ring-white/25 shadow-xs font-bold'
})

const currentViewTitle = computed(
  () => `${ticketNumberWithTicketHook.value} - ${currentTitle.value}`,
)
</script>

<template>
  <CommonLink
    v-if="taskbarTabLink"
    ref="tabLinkInstance"
    v-tooltip="currentViewTitle"
    :aria-current="isActive ? 'page' : undefined"
    class="flex grow items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:no-underline! transition-all duration-150 rounded-xl outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
    :link="taskbarTabLink"
    :class="{
      [activeBackgroundColor]: taskbarTabActive,
      'group-hover/tab:bg-white/10': collapsed,
      'rounded-xl!': !collapsed,
    }"
    internal
  >
    <div
      class="relative shrink-0 flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 border border-white/10 transition-colors"
      :class="{
        'bg-sky-500/25! border-sky-400/40! text-sky-300! shadow-xs': taskbarTabActive,
      }"
    >
      <CommonUpdateIndicator v-if="isTicketUpdated" />
      <CommonTicketStateIndicatorIcon
        :color-code="currentStateColorCode"
        :label="currentState"
        icon-size="tiny"
      />
    </div>
    <CommonLabel
      class="block! truncate text-sm! text-current font-medium"
      :class="{
        'text-white! font-bold': taskbarTabActive,
      }"
    >
      {{ currentTitle }}
    </CommonLabel>
  </CommonLink>
</template>
