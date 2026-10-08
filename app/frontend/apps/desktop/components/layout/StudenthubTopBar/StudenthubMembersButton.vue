<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useSessionStore } from '#shared/stores/session.ts'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import {
  studenthubMemberAvatar,
  useStudenthubMembers,
} from '#desktop/composables/useStudenthubMembers.ts'

// Student Hub: top bar button with the number of members (agents and admins) online; its
// drop-down lists them and links to the Members page.

const { onlineMembers } = useStudenthubMembers()
const session = useSessionStore()

const { popover, popoverTarget, toggle, close, isOpen } = usePopover()
</script>

<template>
  <CommonPopover
    id="studenthub-members-popover"
    ref="popover"
    :owner="popoverTarget"
    orientation="autoVertical"
    placement="arrowEnd"
    z-index="52"
  >
    <div class="w-72 max-w-[calc(100vw-2rem)] py-2" data-test-id="studenthub-members-popover">
      <h2 class="px-3 pb-1.5 text-xs font-bold tracking-wider text-[var(--sh-muted)] uppercase">
        {{ $t('Online now (%s)', onlineMembers.length) }}
      </h2>
      <ul class="max-h-80 overflow-y-auto" :aria-label="$t('Online members')">
        <li
          v-for="member in onlineMembers"
          :key="member.id"
          class="flex items-center gap-2.5 px-3 py-1.5"
        >
          <span class="relative shrink-0">
            <CommonUserAvatar :entity="studenthubMemberAvatar(member)" size="small" decorative />
            <span
              class="absolute -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white ltr:-right-0.5 rtl:-left-0.5"
              aria-hidden="true"
            />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-semibold text-[var(--sh-ink)]">
              {{ member.name }}
              <span v-if="member.id === session.user?.internalId" class="font-normal text-[var(--sh-muted)]">
                {{ $t('(you)') }}
              </span>
            </span>
            <span class="truncate text-xs text-[var(--sh-muted)]">
              {{ member.teams.join(', ') || $t(member.role) }}
            </span>
          </span>
          <CommonDateTime
            v-if="member.last_active_at"
            class="shrink-0 text-xs text-[var(--sh-muted)]"
            :date-time="member.last_active_at"
            type="relative"
          />
        </li>
        <li v-if="!onlineMembers.length" class="px-3 py-2 text-sm text-[var(--sh-muted)]">
          {{ $t('No one is online.') }}
        </li>
      </ul>
      <div class="mt-1 border-t border-[var(--sh-line)] px-3 pt-2">
        <CommonLink
          link="/members"
          internal
          class="text-sm font-semibold text-[var(--sh-app)]! hover:underline"
          @click="close"
        >
          {{ $t('See all members') }} →
        </CommonLink>
      </div>
    </div>
  </CommonPopover>

  <button
    ref="popoverTarget"
    type="button"
    class="relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-[var(--sh-ink-2)] hover:bg-[var(--sh-app-soft)]"
    :class="{ 'bg-[var(--sh-app-soft)]': isOpen }"
    :aria-label="$t('Members online: %s', onlineMembers.length)"
    aria-controls="studenthub-members-popover"
    :aria-expanded="isOpen"
    @click="toggle(true)"
  >
    <CommonIcon name="people-fill" size="small" decorative />
    <span>{{ onlineMembers.length }}</span>
    <span
      v-if="onlineMembers.length"
      class="absolute top-1.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white ltr:left-6 rtl:right-6"
      aria-hidden="true"
    />
  </button>
</template>
