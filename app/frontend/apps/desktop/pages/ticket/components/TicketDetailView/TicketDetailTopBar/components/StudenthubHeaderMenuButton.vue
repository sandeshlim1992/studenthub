<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref, toRef } from 'vue'

import getUuid from '#shared/utils/getUuid.ts'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonPopoverMenu from '#desktop/components/CommonPopoverMenu/CommonPopoverMenu.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { usePopoverMenu } from '#desktop/components/CommonPopoverMenu/usePopoverMenu.ts'

// Student Hub: a text button with a drop-down menu for the ticket header actions; icon-only (with
// the label as tooltip and name) in the agents' compact header.
interface Props {
  label: string
  items: MenuItem[]
  icon?: string
  iconOnly?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

const { popover, isOpen, popoverTarget, toggle } = usePopover()

usePopoverMenu(toRef(props, 'items'), ref(undefined), { provides: true })

const menuId = `studenthub-header-menu-${getUuid()}`
</script>

<template>
  <button
    ref="popoverTarget"
    v-tooltip="iconOnly ? $t(label) : undefined"
    type="button"
    class="sh-header-action"
    :class="{ 'sh-header-action--icon': iconOnly }"
    aria-haspopup="true"
    :aria-expanded="isOpen"
    :aria-controls="isOpen ? menuId : undefined"
    :aria-label="iconOnly ? $t(label) : undefined"
    :disabled="disabled"
    @click="toggle()"
  >
    <CommonIcon v-if="icon" :name="icon" size="xs" decorative />
    <template v-if="!iconOnly">
      {{ $t(label) }}
      <CommonIcon name="chevron-down" size="xs" decorative />
    </template>
  </button>

  <CommonPopover
    :id="menuId"
    ref="popover"
    placement="start"
    orientation="autoVertical"
    :owner="popoverTarget"
  >
    <CommonPopoverMenu :popover="popover" />
  </CommonPopover>
</template>
