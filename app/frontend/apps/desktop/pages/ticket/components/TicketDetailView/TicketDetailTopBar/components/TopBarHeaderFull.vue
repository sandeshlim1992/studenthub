<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonInlineEdit from '#desktop/components/CommonInlineEdit/CommonInlineEdit.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import OrganizationPopoverWithTrigger from '#desktop/components/Organization/OrganizationPopoverWithTrigger.vue'
import StudenthubCampusBadge from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubCampusBadge.vue'
import StudenthubTicketPriority from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketPriority.vue'
import StudenthubTicketStateLabel from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketStateLabel.vue'
import UserPopoverWithTrigger from '#desktop/components/User/UserPopoverWithTrigger.vue'
import { useTicketOverviewsStore } from '#desktop/entities/ticket/stores/ticketOverviews.ts'
import HighlightMenu from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/HighlightMenu.vue'
import StudenthubTicketHeaderActions from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/StudenthubTicketHeaderActions.vue'
import StudenthubTicketHeaderCompact from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/StudenthubTicketHeaderCompact.vue'
import TicketInformationBadgeList from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/TicketInformationFull/TicketInformationBadgeList.vue'
import { useStudenthubQueueLayout } from '#desktop/pages/ticket/composables/useStudenthubQueueLayout.ts'

import { useTopBarHeader } from './useTopBarHeader.ts'

const {
  ticket,
  ticketNumber,
  ticketNumberWithTicketHook,
  isTicketAgent,
  isTicketEditable,
  copyTicketNumberToClipboard,
  isUpdatingTitle,
  updateTitle,
} = useTopBarHeader()

// Student Hub: agents with the queue beside the ticket get the compact header.
const { isQueueLayout } = useStudenthubQueueLayout()

// Student Hub: "Tickets / Service Desk / Ticket#…" sits in the top bar; the header shows the number itself.
const campus = () =>
  ticket.value?.objectAttributeValues?.find((entry) => entry.attribute.name === 'campus')?.value

// The group links to its Teams view when the agent has it.
const { overviewsByLink } = storeToRefs(useTicketOverviewsStore())

const groupCrumb = computed(() => {
  const group = ticket.value?.group
  if (!group?.name) return []

  const link = `studenthub_team_${getIdFromGraphQLId(group.id)}`

  return [
    { label: group.name, route: overviewsByLink.value[link] ? `/tickets/view/${link}` : undefined },
  ]
})

useStudenthubTopBarCrumbsWhileShown(() =>
  ticketNumberWithTicketHook.value
    ? [
        { label: __('Tickets'), route: '/tickets/view' },
        ...groupCrumb.value,
        { label: ticketNumberWithTicketHook.value },
      ]
    : [],
)
</script>

<template>
  <StudenthubTicketHeaderCompact v-if="isQueueLayout" />
  <header
    v-else
    class="ticket-detail-grid-full sh-ticket-header grid grid-cols-2 gap-y-2.5 border-b border-neutral-100 bg-neutral-50 p-3 dark:border-gray-900 dark:bg-gray-500 print:border-b-0 print:px-3"
  >
    <div class="flex items-center" :style="{ gridTemplate: 'breadcrumbs' }">
      <span v-if="ticketNumber" class="sh-ticket-number">#{{ ticketNumber }}</span>
      <CommonButton
        v-if="ticketNumber"
        v-tooltip="$t('Copy ticket number')"
        variant="secondary"
        icon="files"
        size="small"
        class="ms-1 print:hidden"
        @click="copyTicketNumberToClipboard"
      />
    </div>

    <div
      v-if="isTicketAgent && isTicketEditable"
      class="justify-self-end print:hidden"
      :style="{ gridTemplate: 'actions' }"
    >
      <!-- Div because we add soon more actions here  -->
      <HighlightMenu />
    </div>

    <!-- 896px is the max width of the ArticleList -> max-w-64 and  64px is padding-->
    <!-- 12px padding for article bubble -->
    <!-- 896 - 64*2 - 12*2 = 744   -->
    <!-- 46.5rem for the middle grid to align with the content area -->
    <div
      v-if="ticket"
      :style="{ gridArea: 'info' }"
      class="grid grid-cols-[1fr_minmax(0,46.5rem)_1fr] gap-4"
    >
      <div
        class="flex w-full flex-col items-end gap-1.5 @5xl:mt-1 @5xl:flex-row @5xl:items-start @5xl:justify-end @5xl:gap-0"
      >
        <UserPopoverWithTrigger
          v-if="ticket.customer"
          class="z-11 h-min w-fit"
          :avatar-config="{
            responsive: true,
            size: 'normal',
          }"
          :popover-config="{
            placement: 'arrowStart',
          }"
          :user="ticket.customer"
        />
        <OrganizationPopoverWithTrigger
          v-if="ticket.organization"
          class="h-min w-fit @5xl:ltr:-translate-x-1.5 @5xl:rtl:translate-x-1.5"
          :avatar-config="{
            responsive: true,
            size: 'normal',
          }"
          :popover-config="{
            placement: 'arrowStart',
          }"
          :organization="ticket.organization"
        />
      </div>

      <div class="w-full grow justify-self-center">
        <div class="mb-3.5 flex flex-col justify-center">
          <div class="mb-1 flex items-center gap-1">
            <StudenthubCampusBadge
              v-if="campus()"
              compact
              class="me-1 shrink-0"
              :value="campus()"
            />
            <CommonLabel tag="p" class="line-clamp-1! max-w-1/2 shrink break-all">
              {{ ticket.customer.fullname }}
            </CommonLabel>
            <span v-if="ticket.organization?.name" aria-hidden="true"> &middot; </span>
            <CommonLabel
              v-if="ticket.organization?.name"
              class="line-clamp-1! flex-1 grow break-all"
            >
              {{ ticket.organization?.name }}
            </CommonLabel>
          </div>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CommonInlineEdit
              v-model:editing="isUpdatingTitle"
              size="xl"
              required
              :disabled="!ticket.policy.update"
              :value="ticket.title"
              max-length="255"
              :classes="{
                label: 'dark:text-white font-medium',
                input: 'dark:text-white font-medium',
              }"
              :label-attrs="{
                role: 'heading',
                'aria-level': '2',
              }"
              :label="$t('Edit ticket title')"
              @submit-edit="updateTitle"
            />
            <StudenthubTicketStateLabel :state="ticket.state" class="text-sm!" />
            <StudenthubTicketPriority
              v-if="isTicketAgent && ticket.priority"
              :priority="ticket.priority"
            />
          </div>
        </div>

        <TicketInformationBadgeList />

        <StudenthubTicketHeaderActions class="mt-3" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.ticket-detail-grid-full {
  grid-template-areas:
    'breadcrumbs actions'
    'info        info';
}
</style>
