<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { type UserTaskbarItemEntityTicketCreate } from '#shared/graphql/types.ts'

import { useUserTaskbarTab } from '#desktop/composables/useUserTaskbarTab.ts'
import { useTicketCreateTitle } from '#desktop/entities/ticket/composables/useTicketCreateTitle.ts'

import type { UserTaskbarTabEntityProps } from '../types.ts'

const props = defineProps<UserTaskbarTabEntityProps<UserTaskbarItemEntityTicketCreate>>()

const { tabLinkInstance, taskbarTabActive } = useUserTaskbarTab(toRef(props, 'taskbarTab'))

const currentTitle = computed(() => {
  return (props.context?.formValues?.title || props.taskbarTab.entity?.title) as string
})

const currentArticleType = computed(() => {
  return (props.context?.formValues?.articleSenderType ||
    props.taskbarTab.entity?.createArticleTypeKey) as string
})

const { currentViewTitle } = useTicketCreateTitle(currentTitle, currentArticleType)
</script>

<template>
  <CommonLink
    v-if="taskbarTabLink"
    ref="tabLinkInstance"
    v-tooltip="currentViewTitle"
    class="flex grow items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:no-underline! transition-all duration-150 rounded-xl outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
    :class="{
      'bg-emerald-500/15! text-white! font-bold ring-1 ring-emerald-400/35 shadow-2xs': taskbarTabActive,
      'group-hover/tab:bg-white/10': collapsed,
      'rounded-xl!': !collapsed,
    }"
    :aria-current="isActive ? 'page' : undefined"
    :link="taskbarTabLink"
    internal
  >
    <div
      class="relative shrink-0 flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 border border-white/10 transition-colors"
      :class="{
        'bg-emerald-500/20! border-emerald-400/40! shadow-xs': taskbarTabActive,
      }"
    >
      <CommonIcon
        class="shrink-0 text-emerald-400"
        name="pencil"
        size="tiny"
        decorative
      />
    </div>

    <CommonLabel
      class="block! truncate text-sm! text-current font-medium"
      :class="{
        'text-white! font-bold': taskbarTabActive,
      }"
    >
      {{ currentViewTitle }}
    </CommonLabel>
  </CommonLink>
</template>
