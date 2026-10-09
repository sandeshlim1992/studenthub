<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, type Ref } from 'vue'

import {
  useStudenthubMembers,
  type StudenthubMember,
} from '#desktop/composables/useStudenthubMembers.ts'
import {
  compareStudenthubMemberRoles,
  STUDENTHUB_MEMBERS_SHOW,
  useStudenthubMembersFilter,
} from '#desktop/pages/members/composables/useStudenthubMembersFilter.ts'

// Student Hub: the navigation panel on the Members page filters the page: who (everyone, online,
// out of office), a role and a team, each with how many of them are online. A role or team is
// chosen with a click and cleared with another.

const { members, isLoaded } = useStudenthubMembers()
const { show, role, team } = useStudenthubMembersFilter()

const SHOW_COUNTS = {
  everyone: () => true,
  online: (member: StudenthubMember) => member.online,
  out_of_office: (member: StudenthubMember) => member.out_of_office,
}

const shows = computed(() =>
  STUDENTHUB_MEMBERS_SHOW.map(({ value, label }) => ({
    value,
    label,
    count: members.value.filter(SHOW_COUNTS[value]).length,
  })),
)

const tally = (name: string, list: StudenthubMember[]) => ({
  name,
  online: list.filter((member) => member.online).length,
  total: list.length,
})

const roles = computed(() =>
  [...new Set(members.value.map((member) => member.role))]
    .sort(compareStudenthubMemberRoles)
    .map((name) =>
      tally(
        name,
        members.value.filter((member) => member.role === name),
      ),
    ),
)

const teams = computed(() =>
  [...new Set(members.value.flatMap((member) => member.teams))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) =>
      tally(
        name,
        members.value.filter((member) => member.teams.includes(name)),
      ),
    ),
)

const toggle = (filter: Ref<string>, value: string) => {
  filter.value = filter.value === value ? '' : value
}

const filters = computed(() => [
  {
    key: 'role',
    label: __('Roles'),
    group: __('Filter by role'),
    items: roles.value,
    filter: role,
    translated: true,
  },
  {
    key: 'team',
    label: __('Teams'),
    group: __('Filter by team'),
    items: teams.value,
    filter: team,
    translated: false,
  },
])
</script>

<template>
  <div class="sh-nav-views">
    <section class="sh-nav-views__group">
      <p class="sh-nav-panel__label">{{ $t('Show') }}</p>
      <div class="sh-nav-views__list" role="group" :aria-label="$t('Show members')">
        <button
          v-for="item in shows"
          :key="item.value"
          type="button"
          class="sh-nav-views__item"
          :class="{ 'sh-nav-views__item--active': show === item.value }"
          :aria-pressed="show === item.value"
          @click="show = item.value"
        >
          <span class="sh-nav-views__name">{{ $t(item.label) }}</span>
          <span v-if="isLoaded" class="sh-nav-views__count">{{ item.count }}</span>
        </button>
      </div>
    </section>

    <template v-for="section in filters" :key="section.key">
      <section v-if="section.items.length" class="sh-nav-views__group">
        <p class="sh-nav-panel__label">{{ $t(section.label) }}</p>
        <div class="sh-nav-views__list" role="group" :aria-label="$t(section.group)">
          <button
            v-for="item in section.items"
            :key="item.name"
            type="button"
            class="sh-nav-views__item"
            :class="{ 'sh-nav-views__item--active': section.filter.value === item.name }"
            :aria-pressed="section.filter.value === item.name"
            @click="toggle(section.filter, item.name)"
          >
            <span class="sh-nav-views__name">
              {{ section.translated ? $t(item.name) : item.name }}
            </span>
            <span class="sh-nav-views__count">
              <span aria-hidden="true">
                <span :class="{ 'sh-nav-views__online': item.online }">{{ item.online }}</span>
                / {{ item.total }}
              </span>
              <span class="sr-only">{{ $t('%s of %s online', item.online, item.total) }}</span>
            </span>
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
