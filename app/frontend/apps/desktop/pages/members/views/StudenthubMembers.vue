<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { i18n } from '#shared/i18n.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import {
  studenthubMemberAvatar,
  useStudenthubMembers,
  type StudenthubMember,
} from '#desktop/composables/useStudenthubMembers.ts'
import {
  arrangeStudenthubMembers,
  STUDENTHUB_MEMBERS_SHOW,
  STUDENTHUB_MEMBERS_SORT,
  type StudenthubMembersSort,
  useStudenthubMembersFilter,
} from '#desktop/pages/members/composables/useStudenthubMembersFilter.ts'

// Student Hub: the Members page. Agents and admins: who is online now (signed in and active in
// the last few minutes) and, for everyone else, when they last signed in. The navigation panel
// filters the list (who, a role, a team); the page searches by name and orders it, by role in
// groups unless the user chose otherwise.

useStudenthubTopBarCrumbsWhileShown([{ label: __('Members') }])

const session = useSessionStore()
const { members, isLoaded, hasError, refresh } = useStudenthubMembers()

// The page is kept alive; show fresh data when it comes back.
onActivated(() => {
  void refresh()
})

const search = ref('')
const {
  show,
  role,
  team,
  sort,
  setSort,
  matches: matchesFilter,
  clear,
} = useStudenthubMembersFilter()

const matches = (member: StudenthubMember) => {
  if (!matchesFilter(member)) return false

  const term = search.value.trim().toLowerCase()
  return !term || member.name.toLowerCase().includes(term)
}

const shownOnline = computed(() =>
  members.value.filter((member) => member.online && matches(member)),
)
const shownOffline = computed(() =>
  members.value.filter((member) => !member.online && matches(member)),
)

const onlineGroups = computed(() => arrangeStudenthubMembers(shownOnline.value, sort.value))
const offlineGroups = computed(() => arrangeStudenthubMembers(shownOffline.value, sort.value))

// "Online now" in the panel leaves out the offline list.
const showsOffline = computed(() => show.value !== 'online')

// Grouped by role, the role is the group's heading instead of a label on every row.
const showsRoleLabel = computed(() => sort.value !== 'role')

const activeFilters = computed(() =>
  [
    show.value === 'everyone'
      ? ''
      : i18n.t(STUDENTHUB_MEMBERS_SHOW.find((option) => option.value === show.value)?.label ?? ''),
    role.value && i18n.t(role.value),
    team.value,
  ].filter(Boolean),
)

const onSort = (event: Event) => {
  setSort((event.target as HTMLSelectElement).value as StudenthubMembersSort)
}

const isYou = (member: StudenthubMember) => member.id === session.user?.internalId

// A role's heading in a list: a thin band between the groups (the first sits under the list's title).
const groupHeadingClass =
  'border-y border-[var(--sh-line)] bg-[var(--sh-page)] px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--sh-muted)] uppercase [&:first-of-type]:border-t-0'
</script>

<template>
  <LayoutContent name="studenthub-members" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
            {{ $t('Members') }}
          </h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('Agents and admins. Online means signed in and active in the last 5 minutes.') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label for="studenthub-members-search">
            <span class="sr-only">{{ $t('Search members') }}</span>
            <input
              id="studenthub-members-search"
              v-model="search"
              type="search"
              class="h-9 w-56 rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
              :placeholder="$t('Search by name…')"
            />
          </label>
          <label
            for="studenthub-members-sort"
            class="flex items-center gap-2 text-sm text-[var(--sh-muted)]"
          >
            {{ $t('Sort by') }}
            <select
              id="studenthub-members-sort"
              :value="sort"
              class="h-9 rounded-lg border border-[var(--sh-line)] bg-white px-2.5 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
              @change="onSort"
            >
              <option
                v-for="option in STUDENTHUB_MEMBERS_SORT"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.label) }}
              </option>
            </select>
          </label>
        </div>
      </header>

      <p
        v-if="activeFilters.length"
        class="-mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--sh-muted)]"
        data-test-id="studenthub-members-filters"
      >
        {{ $t('Showing:') }}
        <span
          v-for="(label, index) in activeFilters"
          :key="index"
          class="rounded-md bg-[var(--sh-app-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-app)]"
        >
          {{ label }}
        </span>
        <button
          type="button"
          class="text-xs font-semibold text-[var(--sh-app)] underline-offset-2 hover:underline focus-visible:underline"
          @click="clear"
        >
          {{ $t('Clear filters') }}
        </button>
      </p>

      <p
        v-if="hasError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ $t('The members could not be loaded. They are tried again every minute.') }}
      </p>

      <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <section
          class="rounded-xl border border-[var(--sh-line)] bg-white"
          aria-labelledby="studenthub-members-online"
        >
          <h2
            id="studenthub-members-online"
            class="flex items-center gap-2 border-b border-[var(--sh-line)] px-4 py-3 text-sm font-bold text-[var(--sh-ink)]"
          >
            <span class="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            {{ $t('Online now (%s)', shownOnline.length) }}
          </h2>
          <template v-for="group in onlineGroups" :key="group.role ?? 'all'">
            <h3 v-if="group.role" :class="groupHeadingClass">{{ $t(group.role) }}</h3>
            <ul :aria-label="group.role ? $t(group.role) : undefined">
              <li
                v-for="member in group.members"
                :key="member.id"
                class="flex items-center gap-3 px-4 py-2.5 not-last:border-b not-last:border-[var(--sh-line)]"
              >
                <span class="relative shrink-0">
                  <CommonUserAvatar
                    :entity="studenthubMemberAvatar(member)"
                    size="small"
                    decorative
                  />
                  <span
                    class="absolute -bottom-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white ltr:-right-0.5 rtl:-left-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-semibold text-[var(--sh-ink)]">
                    {{ member.name }}
                    <span v-if="isYou(member)" class="font-normal text-[var(--sh-muted)]">{{
                      $t('(you)')
                    }}</span>
                  </span>
                  <span class="truncate text-xs text-[var(--sh-muted)]">{{
                    member.teams.join(', ')
                  }}</span>
                </span>
                <span
                  v-if="showsRoleLabel"
                  class="hidden shrink-0 rounded-md bg-[var(--sh-app-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-app)] sm:inline"
                >
                  {{ $t(member.role) }}
                </span>
                <span
                  class="w-36 shrink-0 text-xs text-[var(--sh-muted)] ltr:text-right rtl:text-left"
                >
                  {{ $t('Active') }}
                  <CommonDateTime
                    v-if="member.last_active_at"
                    :date-time="member.last_active_at"
                    type="relative"
                  />
                </span>
              </li>
            </ul>
          </template>
          <p v-if="!shownOnline.length" class="px-4 py-3 text-sm text-[var(--sh-muted)]">
            {{ $t('No one is online.') }}
          </p>
        </section>

        <section
          v-if="showsOffline"
          class="rounded-xl border border-[var(--sh-line)] bg-white"
          aria-labelledby="studenthub-members-offline"
        >
          <h2
            id="studenthub-members-offline"
            class="flex items-center gap-2 border-b border-[var(--sh-line)] px-4 py-3 text-sm font-bold text-[var(--sh-ink)]"
          >
            <span class="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
            {{ $t('Offline (%s)', shownOffline.length) }}
          </h2>
          <template v-for="group in offlineGroups" :key="group.role ?? 'all'">
            <h3 v-if="group.role" :class="groupHeadingClass">{{ $t(group.role) }}</h3>
            <ul :aria-label="group.role ? $t(group.role) : undefined">
              <li
                v-for="member in group.members"
                :key="member.id"
                class="flex items-center gap-3 px-4 py-2.5 not-last:border-b not-last:border-[var(--sh-line)]"
              >
                <CommonUserAvatar
                  class="shrink-0"
                  :entity="studenthubMemberAvatar(member)"
                  size="small"
                  decorative
                />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-semibold text-[var(--sh-ink)]">
                    {{ member.name }}
                    <span
                      v-if="member.out_of_office"
                      class="ms-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"
                    >
                      {{ $t('Out of office') }}
                    </span>
                  </span>
                  <span class="truncate text-xs text-[var(--sh-muted)]">{{
                    member.teams.join(', ')
                  }}</span>
                </span>
                <span
                  v-if="showsRoleLabel"
                  class="hidden shrink-0 rounded-md bg-[var(--sh-page)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-ink-2)] sm:inline"
                >
                  {{ $t(member.role) }}
                </span>
                <span
                  class="w-36 shrink-0 text-xs text-[var(--sh-muted)] ltr:text-right rtl:text-left"
                >
                  <template v-if="member.last_login">
                    {{ $t('Last login') }}
                    <CommonDateTime
                      :date-time="member.last_login"
                      type="absolute"
                      absolute-format="datetime"
                    />
                  </template>
                  <template v-else>{{ $t('Never signed in') }}</template>
                </span>
              </li>
            </ul>
          </template>
          <p v-if="!shownOffline.length" class="px-4 py-3 text-sm text-[var(--sh-muted)]">
            {{ $t('No one else matches.') }}
          </p>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
