<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, toRef } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import QueryHandler from '#shared/server/apollo/handler/QueryHandler.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import { useDialog } from '#desktop/components/CommonDialog/useDialog.ts'
import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import type { Placement } from '#desktop/components/CommonPopover/types.ts'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonPopoverMenu from '#desktop/components/CommonPopoverMenu/CommonPopoverMenu.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import { useUserCurrentRecentCloseListQuery } from '#desktop/entities/user/current/graphql/queries/userCurrentRecentCloseList.api.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'

const user = toRef(useSessionStore(), 'user')

const { isSidebarCollapsed } = useSidebarDisplay(SidebarName.Primary)

// Student Hub: the top bar shows a small avatar whose menu opens towards the left.
interface Props {
  size?: 'small' | 'normal'
  placement?: Placement
}

const props = defineProps<Props>()

const avatarSize = computed(() => props.size ?? (isSidebarCollapsed?.value ? 'small' : 'normal'))
const popoverPlacement = computed<Placement>(
  () => props.placement ?? (isSidebarCollapsed.value ? 'start' : 'arrowStart'),
)

const { popover, popoverTarget, toggle, isOpen: popoverIsOpen } = usePopover()

const keyboardShortcutsDialog = useDialog({
  name: 'keyboard-shortcuts',
  component: () => import('#desktop/components/KeyboardShortcuts/KeyboardShortcutsDialog.vue'),
  global: true,
})

const recentCloseListQuery = new QueryHandler(
  useUserCurrentRecentCloseListQuery({
    limit: 5,
  }),
)
const recentCloseListQueryResult = recentCloseListQuery.result()
const recentCloseListItems = computed<any[]>(() => {
  const list = recentCloseListQueryResult.value?.userCurrentRecentCloseList
  return Array.isArray(list) ? list : []
})

const taskbarTabStore = useUserCurrentTaskbarTabsStore()
const { taskbarTabList } = storeToRefs(taskbarTabStore)

const recentItems = computed(() => {
  const result: Array<{ id: string; label: string; icon: string; link: string }> = []
  const seenIds = new Set<string>()

  // 1. Prioritize closed/viewed objects
  const closeList = Array.isArray(recentCloseListItems.value) ? recentCloseListItems.value : []
  for (const item of closeList) {
    if (result.length >= 5) break
    if (!item) continue
    if (item.__typename === 'Ticket') {
      const ticket = item as any
      if (!seenIds.has(ticket.id)) {
        seenIds.add(ticket.id)
        result.push({
          id: ticket.id,
          label: ticket.title ? `#${ticket.number} ${ticket.title}` : `#${ticket.number}`,
          icon: 'ticket',
          link: `/tickets/${ticket.internalId}`,
        })
      }
    } else if (item.__typename === 'User') {
      const u = item as any
      if (!seenIds.has(u.id)) {
        seenIds.add(u.id)
        result.push({
          id: u.id,
          label: u.fullname || __('User'),
          icon: 'person',
          link: `/users/${u.internalId || u.id}`,
        })
      }
    } else if (item.__typename === 'Organization') {
      const org = item as any
      if (!seenIds.has(org.id)) {
        seenIds.add(org.id)
        result.push({
          id: org.id,
          label: org.name || __('Organization'),
          icon: 'building',
          link: `/organizations/${org.internalId || org.id}`,
        })
      }
    }
  }

  // 2. Supplement from active taskbar tabs if fewer than 5
  if (result.length < 5 && Array.isArray(taskbarTabList?.value)) {
    for (const tab of taskbarTabList.value) {
      if (result.length >= 5) break
      if (tab.type === 'Ticket' && tab.entity) {
        const ticket = tab.entity as any
        if (!seenIds.has(ticket.id)) {
          seenIds.add(ticket.id)
          result.push({
            id: ticket.id,
            label: ticket.title ? `#${ticket.number} ${ticket.title}` : `#${ticket.number}`,
            icon: 'ticket',
            link: `/tickets/${ticket.internalId || ticket.id}`,
          })
        }
      }
    }
  }

  return result
})

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []

  // Recently viewed section (up to 5 items)
  if (recentItems.value.length > 0) {
    for (const recent of recentItems.value) {
      items.push({
        key: `recent-${recent.id}`,
        groupLabel: __('Recently viewed'),
        label: recent.label,
        icon: recent.icon,
        link: recent.link,
      })
    }
  }

  // Profile settings
  items.push({
    key: 'personal-setting',
    label: __('Profile settings'),
    link: '/personal-setting',
    icon: 'user-settings',
    separatorTop: recentItems.value.length > 0,
  })

  // Keyboard shortcuts
  items.push({
    key: 'keyboard-shortcuts',
    label: __('Keyboard shortcuts'),
    icon: 'keyboard',
    onClick: () => {
      keyboardShortcutsDialog.open()
    },
  })

  // Sign out
  items.push({
    key: 'sign-out',
    label: __('Sign out'),
    link: '/logout',
    icon: 'box-arrow-in-right',
    separatorTop: true,
  })

  return items
})
</script>

<template>
  <CommonPopover
    id="user-menu-popover"
    ref="popover"
    :owner="popoverTarget"
    :hide-arrow="isSidebarCollapsed"
    z-index="52"
    orientation="autoVertical"
    :placement="popoverPlacement"
  >
    <CommonPopoverMenu
      :popover="popover"
      :header-label="user?.fullname!"
      :items="menuItems"
    />
  </CommonPopover>

  <button
    id="user-menu"
    ref="popoverTarget"
    v-tooltip="user?.fullname || user?.email || $t('User menu')"
    class="rounded-full transition-transform duration-150 hover:scale-105 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    :class="{
      'ring-2 ring-sky-400!': popoverIsOpen,
    }"
    :aria-label="user?.fullname || user?.email || $t('User menu')"
    aria-controls="user-menu-popover"
    aria-expanded="false"
    @click="toggle(true)"
  >
    <CommonUserAvatar
      v-if="user"
      aria-hidden="true"
      :entity="user"
      class="flex! ring-2 ring-white/30 rounded-full shadow-xs"
      :size="avatarSize"
      personal
    />
  </button>
</template>
