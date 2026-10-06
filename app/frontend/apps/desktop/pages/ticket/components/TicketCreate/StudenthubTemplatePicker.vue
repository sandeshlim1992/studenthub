<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonInputSearch from '#desktop/components/CommonInputSearch/CommonInputSearch.vue'
import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonPopoverMenu from '#desktop/components/CommonPopoverMenu/CommonPopoverMenu.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'

import { useApplyTemplate } from '../../composables/useApplyTemplate.ts'

// Student Hub: "Start from a template" at the top of the staff New ticket form (replaces Zammad's
// Apply template button, whose list opened upwards from the old bottom bar). Used in the form schema.
interface Props {
  onSelect: (templateId: string) => void
}

const props = defineProps<Props>()

const { hasPermission } = useSessionStore()
const { templateList } = useApplyTemplate()

const hasTemplates = computed(() => templateList.value.length > 0 && hasPermission('ticket.agent'))

const items = computed<MenuItem[]>(() =>
  templateList.value.map((template) => ({
    key: template.id,
    label: template.name,
    onClick: () => props.onSelect(template.id),
  })),
)

const { popover, popoverTarget, isOpen, toggle } = usePopover()

// Search above the list, which shows about 20 templates and scrolls for the rest.
const query = ref('')
const searchInput = useTemplateRef('search-input')

const filteredItems = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return items.value

  return items.value.filter((item) => words.every((word) => item.label?.toLowerCase().includes(word)))
})

// The popover focuses its first item when it opens; take the focus to the search afterwards.
const onOpen = () => nextTick(() => window.setTimeout(() => searchInput.value?.focus(), 100))
const onClose = () => {
  query.value = ''
}

const hintId = useId()
</script>

<template>
  <div v-if="hasTemplates" class="sh-template-picker">
    <span class="sh-create-panel__icon"><CommonIcon name="file-text" size="small" decorative /></span>
    <div class="sh-template-picker__text">
      <p class="sh-template-picker__title">{{ $t('Start from a template') }}</p>
      <p :id="hintId" class="sh-template-picker__hint">
        {{ $t('Fills in the fields below. You can still change them.') }}
      </p>
    </div>

    <CommonPopover
      ref="popover"
      :owner="popoverTarget"
      orientation="bottom"
      placement="end"
      @open="onOpen"
      @close="onClose"
    >
      <div class="sh-template-menu">
        <div class="sh-template-menu__search">
          <CommonInputSearch
            ref="search-input"
            v-model="query"
            :placeholder="__('Search templates…')"
            :aria-label="$t('Search templates')"
          />
        </div>
        <div class="sh-template-menu__list">
          <CommonPopoverMenu v-if="filteredItems.length" :popover="popover" :items="filteredItems" />
          <p v-else class="sh-template-menu__empty" role="status">
            {{ $t('No template matches "%s".', query) }}
          </p>
        </div>
      </div>
    </CommonPopover>

    <CommonButton
      ref="popoverTarget"
      class="sh-template-picker__button"
      size="medium"
      variant="secondary"
      :aria-describedby="hintId"
      @click="toggle"
    >
      <template #label>
        <span class="truncate">{{ $t('Choose a template') }}</span>
        <CommonIcon
          class="sh-template-picker__chevron"
          :class="{ 'rotate-180': isOpen }"
          size="small"
          decorative
          name="chevron-down"
        />
      </template>
    </CommonButton>
  </div>
</template>
