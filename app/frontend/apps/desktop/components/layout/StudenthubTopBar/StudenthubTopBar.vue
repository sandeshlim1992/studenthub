<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import AvatarMenu from '#desktop/components/layout/LayoutSidebar/LeftSidebar/AvatarMenu/AvatarMenu.vue'
import OnlineNotification from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification.vue'
import QuickSearch from '#desktop/components/Search/QuickSearch/QuickSearch.vue'
import QuickSearchInput from '#desktop/components/Search/QuickSearch/QuickSearchInput/QuickSearchInput.vue'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import { useStudenthubMembersAccess } from '#desktop/composables/useStudenthubMembers.ts'

import StudenthubMembersButton from './StudenthubMembersButton.vue'
import { useStudenthubTopBarCrumbs } from './useStudenthubTopBarCrumbs.ts'

// Student Hub: Halo-style top bar for staff. Search (with Zammad's quick search results in a
// drop-down), members online, New ticket, notifications and the avatar menu live here instead
// of in the navigation panel. Administration and Reporting are only in the navigation panel.

const router = useRouter()
const route = useRoute()
const { hasPermission } = useSessionStore()

const isAgent = computed(() => hasPermission('ticket.agent'))

// Managers without another staff role raise tickets only if they are also customers.
const { isLoaded: isViewerLoaded, cannotCreateTickets } = useStudenthubApprovalViewer()
const canCreateTicket = computed(
  () => isAgent.value && isViewerLoaded.value && !cannotCreateTickets.value,
)

const canSeeMembers = useStudenthubMembersAccess()

const crumbs = useStudenthubTopBarCrumbs()

const searchValue = ref('')
const isSearchActive = ref(false)
const searchArea = useTemplateRef('search-area')

const closeSearch = () => {
  isSearchActive.value = false
}

onClickOutside(searchArea, closeSearch)
onKeyStroke('Escape', () => {
  if (isSearchActive.value) closeSearch()
})

watch(
  () => route.fullPath,
  () => {
    closeSearch()
    searchValue.value = ''
  },
)
</script>

<template>
  <header
    class="relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--sh-line)] bg-white px-4 print:hidden"
    :aria-label="$t('Top bar')"
  >
    <nav
      v-if="crumbs.length"
      class="flex max-w-[40%] shrink-0 items-center gap-1.5 text-sm whitespace-nowrap"
      :aria-label="$t('Current page')"
    >
      <template v-for="(crumb, index) in crumbs" :key="crumb.label">
        <span v-if="index" class="text-[var(--sh-muted)]" aria-hidden="true">/</span>
        <CommonLink
          v-if="crumb.route"
          internal
          :link="crumb.route"
          class="font-semibold text-[var(--sh-ink)]! hover:underline"
        >
          {{ $t(crumb.label) }}
        </CommonLink>
        <span v-else class="truncate text-[var(--sh-ink-2)]" aria-current="page">{{ $t(crumb.label) }}</span>
      </template>
    </nav>

    <div ref="search-area" class="relative w-full max-w-xl min-w-0">
      <QuickSearchInput v-model="searchValue" v-model:search-active="isSearchActive" class="studenthub-topbar-search" />
      <div
        v-if="isSearchActive"
        class="absolute top-full mt-1.5 max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-[#1f2430] shadow-xl ring-1 ring-black/10 rtl:right-0 ltr:left-0"
        data-theme="dark"
      >
        <QuickSearch :search="searchValue" />
      </div>
    </div>

    <div class="ms-auto flex shrink-0 items-center gap-2">
      <StudenthubMembersButton v-if="canSeeMembers" />

      <CommonButton
        v-if="canCreateTicket"
        variant="none"
        size="medium"
        prefix-icon="plus"
        class="rounded-lg bg-app! px-3 text-on-app! hover:bg-app-hover!"
        @click="router.push('/tickets/create')"
      >
        {{ $t('New ticket') }}
      </CommonButton>

      <OnlineNotification
        v-if="isAgent"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--sh-ink-2)] hover:bg-[var(--sh-app-soft)]"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </OnlineNotification>

      <AvatarMenu size="small" placement="arrowEnd" />
    </div>
  </header>
</template>

<style scoped>
/* Zammad's quick search input is styled for the dark sidebar; make it a light field here. */
.studenthub-topbar-search :deep(.rounded-lg) {
  background-color: var(--sh-page);
  border: 1px solid var(--sh-line);
}

.studenthub-topbar-search :deep(.rounded-lg:focus-within) {
  border-color: var(--sh-app);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sh-app) 20%, transparent);
}

.studenthub-topbar-search :deep(input) {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--sh-ink);
}

.studenthub-topbar-search :deep(input::placeholder) {
  color: var(--sh-muted);
}
</style>
