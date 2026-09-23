<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useOrganizationEntity } from '#shared/entities/organization/composables/useOrganizationEntity.ts'
import { useOrganizationUpdatesSubscription } from '#shared/entities/organization/graphql/subscriptions/organizationUpdates.api.ts'
import { SECONDARY_ORGANIZATIONS_FETCH_COUNT } from '#shared/entities/user/composables/useUserDetail.ts'
import type { Organization } from '#shared/graphql/types.ts'
import SubscriptionHandler from '#shared/server/apollo/handler/SubscriptionHandler.ts'
import { GraphQLErrorTypes } from '#shared/types/error.ts'

import { useUserTaskbarTab } from '#desktop/composables/useUserTaskbarTab.ts'

import type { UserTaskbarTabEntityProps } from '../types.ts'

const props = defineProps<UserTaskbarTabEntityProps<Organization>>()

const { isTaskbarTabLoaded, tabLinkInstance, taskbarTabActive } = useUserTaskbarTab(
  toRef(props, 'taskbarTab'),
)

const organization = computed(() => props.taskbarTab.entity)

const { organizationDisplayName, isOrganizationInactive } = useOrganizationEntity(organization)

new SubscriptionHandler(
  useOrganizationUpdatesSubscription(
    () => ({
      organizationId: organization.value!.id,
      first: SECONDARY_ORGANIZATIONS_FETCH_COUNT,
      initial: true,
    }),
    () => ({
      // NB: Organization detail view has its own subscription handling, avoid double subscriptions.
      enabled: !!organization.value?.id && !isTaskbarTabLoaded.value,
    }),
  ),
  {
    // NB: Silence toast notifications for particular errors, these will be handled by the layout taskbar tab component.
    errorCallback: (errorHandler) =>
      errorHandler.type !== GraphQLErrorTypes.Forbidden &&
      errorHandler.type !== GraphQLErrorTypes.RecordNotFound,
  },
)
</script>

<template>
  <CommonLink
    v-if="taskbarTabLink"
    ref="tabLinkInstance"
    class="flex grow items-center gap-2.5 px-3 py-2 text-slate-300 hover:text-white hover:bg-white/[0.08] hover:no-underline! transition-all duration-150 rounded-xl outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
    :link="taskbarTabLink"
    :class="{
      'bg-emerald-500/15! text-white! font-bold ring-1 ring-emerald-400/35 shadow-2xs': taskbarTabActive,
    }"
    internal
  >
    <div
      class="relative shrink-0 flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 transition-colors"
      :class="{
        'bg-emerald-500/20! border-emerald-400/40! text-emerald-300! shadow-xs': taskbarTabActive,
      }"
    >
      <CommonIcon
        size="tiny"
        :name="isOrganizationInactive ? 'buildings-slash' : 'buildings'"
        decorative
      />
    </div>
    <CommonLabel
      class="block! truncate text-sm! text-current font-medium"
      :class="{
        'text-white! font-bold': taskbarTabActive,
      }"
    >
      {{ organizationDisplayName }}
    </CommonLabel>
  </CommonLink>
</template>
