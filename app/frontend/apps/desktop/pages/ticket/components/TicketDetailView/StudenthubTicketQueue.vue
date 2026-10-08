<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onKeyStroke, StorageSerializers, useLocalStorage, useMediaQuery } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { TicketByList } from '#shared/entities/ticket/types.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import getUuid from '#shared/utils/getUuid.ts'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonPopoverMenu from '#desktop/components/CommonPopoverMenu/CommonPopoverMenu.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { usePopoverMenu } from '#desktop/components/CommonPopoverMenu/usePopoverMenu.ts'
import StudenthubCampusBadge from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubCampusBadge.vue'
import StudenthubTicketEscalation from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketEscalation.vue'
import {
  useStudenthubTicketViews,
  type StudenthubTicketViewSection,
} from '#desktop/entities/ticket/composables/useStudenthubTicketViews.ts'

import {
  STUDENTHUB_QUEUE_FILTERS,
  type StudenthubTicketQueue,
} from '../../composables/useStudenthubTicketQueue.ts'

// Student Hub: the queue beside the ticket (agents): the tickets of a view, the current one
// highlighted, with the time left until the SLA deadline. J / K open the next / previous ticket.
// See useStudenthubTicketQueue.ts.
interface Props {
  queue: StudenthubTicketQueue
}

const props = defineProps<Props>()

const {
  isActive,
  overview,
  selectOverview,
  filter,
  visibleTickets,
  totalCount,
  isLoading,
  pagination,
  currentIndex,
  ticketLink,
  openNext,
  openPrevious,
} = props.queue

// The agent's own choice, kept in this browser. Until they choose, the queue starts collapsed on
// screens narrower than 1440 px, where three columns leave too little room for the conversation.
const storedCollapsed = useLocalStorage<boolean | null>('studenthub-ticket-queue-collapsed', null, {
  serializer: StorageSerializers.object,
})
const isNarrowScreen = useMediaQuery('(max-width: 1439px)')

const isCollapsed = computed({
  get: () => storedCollapsed.value ?? isNarrowScreen.value,
  set: (value) => {
    storedCollapsed.value = value
  },
})

// ---- view menu, grouped like the Tickets page's views panel ----

const SECTION_LABELS: Record<StudenthubTicketViewSection, string> = {
  approvals: __('Approval needed'),
  mine: __('My views'),
  teams: __('Teams'),
  institutions: __('Sites'),
}

const SECTION_ORDER: StudenthubTicketViewSection[] = ['approvals', 'mine', 'teams', 'institutions']

const { overviewsBySection } = useStudenthubTicketViews()

const viewItems = computed<MenuItem[]>(() =>
  SECTION_ORDER.flatMap((section) =>
    overviewsBySection.value[section].map((item) => ({
      key: item.link,
      label: item.name,
      groupLabel: SECTION_LABELS[section],
      icon: item.id === overview.value?.id ? 'check2' : undefined,
      onClick: () => selectOverview(item.link),
    })),
  ),
)

const { popover, isOpen: isViewMenuOpen, popoverTarget, toggle: toggleViewMenu } = usePopover()

usePopoverMenu(viewItems, ref(undefined), { provides: true })

const viewMenuId = `studenthub-queue-views-${getUuid()}`

// ---- rows ----

const campusOf = (ticket: TicketByList) =>
  ticket.objectAttributeValues?.find((entry) => entry.attribute.name === 'campus')?.value

const isCurrent = (index: number) => index === currentIndex.value

const emptyMessage = computed(() => {
  if (filter.value === 'mine') return __('None of these tickets is assigned to you.')
  if (filter.value === 'unassigned') return __('Every ticket here has an agent.')
  return __('This view has no tickets.')
})

// ---- J / K, not while typing or in a dialog ----

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

onKeyStroke(['j', 'k'], (event) => {
  if (!isActive.value || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  if (isTyping(event.target) || document.querySelector('[aria-modal="true"]')) return

  event.preventDefault()

  if (event.key === 'j') openNext()
  else openPrevious()
})

const ticketKey = (ticket: TicketByList) => getIdFromGraphQLId(ticket.id)
</script>

<template>
  <aside
    class="sh-queue print:hidden"
    :class="{ 'sh-queue--collapsed': isCollapsed }"
    :aria-label="$t('Ticket queue')"
    data-test-id="studenthub-ticket-queue"
  >
    <template v-if="isCollapsed">
      <button
        v-tooltip="$t('Show the queue')"
        type="button"
        class="sh-queue__icon-button"
        :aria-label="$t('Show the queue')"
        @click="isCollapsed = false"
      >
        <CommonIcon name="arrow-bar-right" size="small" decorative />
      </button>
      <span v-if="totalCount !== undefined" class="sh-queue__badge">{{ totalCount }}</span>
    </template>

    <template v-else>
      <header class="sh-queue__head">
        <button
          ref="popoverTarget"
          type="button"
          class="sh-queue__view"
          aria-haspopup="true"
          :aria-expanded="isViewMenuOpen"
          :aria-controls="isViewMenuOpen ? viewMenuId : undefined"
          :aria-label="$t('Choose the view of the queue')"
          @click="toggleViewMenu()"
        >
          <span class="truncate">{{ overview ? $t(overview.name) : $t('Tickets') }}</span>
          <CommonIcon name="chevron-down" size="xs" decorative />
        </button>
        <span v-if="totalCount !== undefined" class="sh-queue__count">
          {{ totalCount === 1 ? $t('1 ticket') : $t('%s tickets', totalCount) }}
        </span>
        <button
          v-tooltip="$t('Hide the queue')"
          type="button"
          class="sh-queue__icon-button"
          :aria-label="$t('Hide the queue')"
          @click="isCollapsed = true"
        >
          <CommonIcon name="arrow-bar-left" size="small" decorative />
        </button>
      </header>

      <CommonPopover
        :id="viewMenuId"
        ref="popover"
        placement="start"
        orientation="autoVertical"
        :owner="popoverTarget"
      >
        <CommonPopoverMenu :popover="popover" />
      </CommonPopover>

      <div class="sh-queue__filter" role="group" :aria-label="$t('Show')">
        <button
          v-for="option in STUDENTHUB_QUEUE_FILTERS"
          :key="option.value"
          type="button"
          :aria-pressed="filter === option.value"
          @click="filter = option.value"
        >
          {{ $t(option.label) }}
        </button>
      </div>

      <div class="sh-queue__scroll">
        <p v-if="isLoading" class="sh-queue__note">{{ $t('Loading…') }}</p>
        <ol v-else-if="visibleTickets.length" class="sh-queue__list">
          <li v-for="(ticket, index) in visibleTickets" :key="ticketKey(ticket)">
            <CommonLink
              :link="ticketLink(ticket)"
              internal
              class="sh-queue__row"
              :class="{ 'sh-queue__row--current': isCurrent(index) }"
              :aria-current="isCurrent(index) ? 'page' : undefined"
            >
              <span class="sh-queue__number">#{{ ticket.number }}</span>
              <span class="sh-queue__due">
                <StudenthubTicketEscalation
                  v-if="ticket.escalationAt"
                  :value="ticket.escalationAt"
                />
                <span v-else class="sh-queue__state">{{ $t(ticket.state.name) }}</span>
              </span>
              <span class="sh-queue__title">{{ ticket.title }}</span>
              <span class="sh-queue__who">
                <span class="truncate">{{ ticket.customer?.fullname }}</span>
                <StudenthubCampusBadge :value="campusOf(ticket)" compact />
              </span>
            </CommonLink>
          </li>
        </ol>
        <p v-else class="sh-queue__note">{{ $t(emptyMessage) }}</p>

        <button
          v-if="!isLoading && pagination.hasNextPage"
          type="button"
          class="sh-queue__more"
          :disabled="pagination.loadingNewPage"
          @click="pagination.fetchNextPage()"
        >
          {{ pagination.loadingNewPage ? $t('Loading…') : $t('Show more') }}
        </button>
      </div>

      <footer class="sh-queue__foot">
        <kbd>J</kbd><kbd>K</kbd>
        <span>{{ $t('next / previous ticket') }}</span>
      </footer>
    </template>
  </aside>
</template>
