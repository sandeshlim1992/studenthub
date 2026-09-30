<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import type { UserTaskbarItemEntitySearch } from '#shared/graphql/types.ts'

import { useSearchTitle } from '#desktop/components/Search/composables/useSearchTitle.ts'
import { useUserTaskbarTab } from '#desktop/composables/useUserTaskbarTab.ts'

import type { UserTaskbarTabEntityProps } from '../types.ts'

const props = defineProps<UserTaskbarTabEntityProps<UserTaskbarItemEntitySearch>>()

const { tabLinkInstance, taskbarTabActive } = useUserTaskbarTab(toRef(props, 'taskbarTab'))

const filterCount = computed<number>(() => props.taskbarTab.entity?.filterCount ?? 0)
const currentSearchTerm = computed(
  () => (props.context?.query as string) || props.taskbarTab.entity?.query || '',
)
const { searchTitle: currentTitle } = useSearchTitle(currentSearchTerm, filterCount)
</script>

<template>
  <CommonLink
    v-if="taskbarTabLink"
    ref="tabLinkInstance"
    class="flex grow items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:no-underline! transition-all duration-150 rounded-xl outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
    :link="taskbarTabLink"
    :aria-current="isActive ? 'page' : undefined"
    :class="{
      'bg-white/15! text-white! font-bold ring-1 ring-white/25 shadow-xs': taskbarTabActive,
    }"
    internal
  >
    <div
      class="relative shrink-0 flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 transition-colors"
      :class="{
        'bg-sky-500/25! border-sky-400/40! text-sky-300! shadow-xs': taskbarTabActive,
      }"
    >
      <CommonIcon
        size="tiny"
        name="search-detail"
        decorative
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
