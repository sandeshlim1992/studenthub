<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { BadgeVariant } from '#shared/components/CommonBadge/types.ts'
import type { Sizes } from '#shared/components/CommonLabel/types.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import {
  NavigationMenuDensity,
  type NavigationMenuEntry,
} from '#desktop/components/NavigationMenu/types.ts'

interface Props {
  items: NavigationMenuEntry[]
  density?: NavigationMenuDensity
  countVariant?: BadgeVariant
  countSize?: Sizes
}

const props = withDefaults(defineProps<Props>(), {
  density: NavigationMenuDensity.Comfortable,
  countVariant: 'info',
  countSize: 'xs',
})

const { user } = useSessionStore()

const availableItems = computed(() => props.items.filter((entry) => entry.show?.(user) ?? true))

const paddingClasses = computed(() =>
  props.density === NavigationMenuDensity.Dense ? 'px-2 py-1' : 'px-2 py-3',
)
</script>

<template>
  <nav class="flex p-0">
    <ul class="m-0 flex basis-full flex-col gap-1 p-0">
      <li v-for="entry in availableItems" :key="entry.id || entry.label">
        <slot v-bind="{ entry, paddingClasses, countSize, countVariant }">
          <CommonLink
            class="flex items-center gap-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 hover:no-underline! transition-all duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            :class="[paddingClasses]"
            exact-active-class="active-overview-item bg-emerald-50! text-emerald-800! font-bold ring-1 ring-emerald-500/25 shadow-2xs hover:bg-emerald-100/60! hover:text-emerald-800!"
            internal
            :link="entry.route"
          >
            <template #default="{ isActive }">
              <CommonIcon
                v-if="entry.icon"
                size="small"
                aria-hidden="true"
                class="h-4 shrink-0"
                :class="isActive ? 'text-[#16a34a]!' : entry.iconColor"
                :name="entry.icon"
              />
              <CommonLabel
                class="block! w-0 grow truncate text-current!"
                :aria-label="$t(entry.title)"
              >
                {{ $t(entry.label) }}
              </CommonLabel>
              <CommonBadge
                v-if="entry.count !== undefined"
                class="leading-snug font-bold transition-colors"
                :size="countSize"
                :variant="countVariant"
                :class="{
                  'bg-emerald-100! text-emerald-800! border border-emerald-200/80 font-bold': isActive,
                  'bg-slate-100! text-slate-600! border border-slate-200/60': !isActive,
                  'cursor-pointer': !!entry.route,
                }"
                rounded
              >
                {{ entry.count }}
              </CommonBadge>
            </template>
          </CommonLink>
        </slot>
      </li>
    </ul>
  </nav>
</template>
