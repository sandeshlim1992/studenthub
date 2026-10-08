<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useSessionStore } from '#shared/stores/session.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import {
  studenthubMemberAvatar,
  useStudenthubMembers,
  type StudenthubMember,
} from '#desktop/composables/useStudenthubMembers.ts'

// Student Hub: the Members page. Agents and admins: who is online now (signed in and active in
// the last few minutes) and, for everyone else, when they last signed in.

useStudenthubTopBarCrumbsWhileShown([{ label: __('Members') }])

const session = useSessionStore()
const { members, isLoaded, hasError, refresh } = useStudenthubMembers()

// The page is kept alive; show fresh data when it comes back.
onActivated(() => {
  void refresh()
})

const search = ref('')
const team = ref('')

const teams = computed(() =>
  [...new Set(members.value.flatMap((member) => member.teams))].sort((a, b) => a.localeCompare(b)),
)

const matches = (member: StudenthubMember) => {
  if (team.value && !member.teams.includes(team.value)) return false

  const term = search.value.trim().toLowerCase()
  return !term || member.name.toLowerCase().includes(term)
}

const shownOnline = computed(() => members.value.filter((member) => member.online && matches(member)))
const shownOffline = computed(() => members.value.filter((member) => !member.online && matches(member)))

const isYou = (member: StudenthubMember) => member.id === session.user?.internalId
</script>

<template>
  <LayoutContent name="studenthub-members" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Members') }}</h1>
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
          <label for="studenthub-members-team">
            <span class="sr-only">{{ $t('Team') }}</span>
            <select
              id="studenthub-members-team"
              v-model="team"
              class="h-9 rounded-lg border border-[var(--sh-line)] bg-white px-2.5 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
            >
              <option value="">{{ $t('All teams') }}</option>
              <option v-for="name in teams" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
        </div>
      </header>

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
          <ul>
            <li
              v-for="member in shownOnline"
              :key="member.id"
              class="flex items-center gap-3 px-4 py-2.5 not-last:border-b not-last:border-[var(--sh-line)]"
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
                  <span v-if="isYou(member)" class="font-normal text-[var(--sh-muted)]">{{ $t('(you)') }}</span>
                </span>
                <span class="truncate text-xs text-[var(--sh-muted)]">{{ member.teams.join(', ') }}</span>
              </span>
              <span class="hidden shrink-0 rounded-md bg-[var(--sh-app-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-app)] sm:inline">
                {{ $t(member.role) }}
              </span>
              <span class="w-36 shrink-0 text-xs text-[var(--sh-muted)] ltr:text-right rtl:text-left">
                {{ $t('Active') }}
                <CommonDateTime v-if="member.last_active_at" :date-time="member.last_active_at" type="relative" />
              </span>
            </li>
            <li v-if="!shownOnline.length" class="px-4 py-3 text-sm text-[var(--sh-muted)]">
              {{ $t('No one is online.') }}
            </li>
          </ul>
        </section>

        <section
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
          <ul>
            <li
              v-for="member in shownOffline"
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
                <span class="truncate text-xs text-[var(--sh-muted)]">{{ member.teams.join(', ') }}</span>
              </span>
              <span class="hidden shrink-0 rounded-md bg-[var(--sh-page)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-ink-2)] sm:inline">
                {{ $t(member.role) }}
              </span>
              <span class="w-36 shrink-0 text-xs text-[var(--sh-muted)] ltr:text-right rtl:text-left">
                <template v-if="member.last_login">
                  {{ $t('Last login') }}
                  <CommonDateTime :date-time="member.last_login" type="absolute" absolute-format="datetime" />
                </template>
                <template v-else>{{ $t('Never signed in') }}</template>
              </span>
            </li>
            <li v-if="!shownOffline.length" class="px-4 py-3 text-sm text-[var(--sh-muted)]">
              {{ $t('No one else matches.') }}
            </li>
          </ul>
        </section>
      </template>
    </div>
  </LayoutContent>
</template>
