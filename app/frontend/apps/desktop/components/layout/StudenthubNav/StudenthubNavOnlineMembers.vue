<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'

import {
  studenthubMemberAvatar,
  useStudenthubMembers,
} from '#desktop/composables/useStudenthubMembers.ts'

// Student Hub: who of the agents and admins is online, at the foot of the navigation panel on the
// Dashboard (the same list as the top bar's Members button, refreshed every minute).

const SHOWN = 6

const { onlineMembers, isLoaded } = useStudenthubMembers()

const shown = computed(() => onlineMembers.value.slice(0, SHOWN))
const more = computed(() => onlineMembers.value.length - shown.value.length)
</script>

<template>
  <section class="sh-nav-members" aria-labelledby="studenthub-nav-members-title">
    <div class="sh-nav-views__head">
      <p id="studenthub-nav-members-title" class="sh-nav-panel__label">
        {{ $t('Online now (%s)', onlineMembers.length) }}
      </p>
      <CommonLink v-tooltip="$t('Members')" class="sh-nav-views__reorder" link="/members" internal>
        <CommonIcon name="people-fill" size="xs" decorative />
      </CommonLink>
    </div>

    <ul v-if="shown.length" class="sh-nav-members__list" :aria-label="$t('Online members')">
      <li v-for="member in shown" :key="member.id" class="sh-nav-members__item">
        <span class="sh-nav-members__avatar">
          <CommonUserAvatar :entity="studenthubMemberAvatar(member)" size="xs" decorative />
          <span class="sh-nav-members__dot" aria-hidden="true" />
        </span>
        <span class="sh-nav-members__text">
          <span class="sh-nav-members__name">{{ member.name }}</span>
          <span v-if="member.teams.length" class="sh-nav-members__teams">
            {{ member.teams.join(', ') }}
          </span>
        </span>
      </li>
    </ul>
    <p v-else-if="isLoaded" class="sh-nav-panel__empty">{{ $t('Nobody is online.') }}</p>

    <CommonLink v-if="more > 0" class="sh-nav-members__more" link="/members" internal>
      {{ $t('%s more', more) }}
    </CommonLink>
  </section>
</template>
