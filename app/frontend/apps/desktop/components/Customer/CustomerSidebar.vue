<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCustomerTickets } from './useCustomerTickets.ts'

const router = useRouter()
const route = useRoute()

const { tickets, loading } = useCustomerTickets()

const searchQuery = ref('')

const currentTicketInternalId = computed(() => {
  return String(route.params.internalId || '')
})

const isCreateView = computed(() => {
  return route.name === 'TicketCreate' || route.path.startsWith('/tickets/create')
})

const sidebarFilterTabs = [
  'All',
  'Open',
  'Pending',
  'Resolved',
] as const
type SidebarFilterTab = (typeof sidebarFilterTabs)[number]
const activeSidebarTab = ref<SidebarFilterTab>('All')

const sidebarTabCounts = computed(() => {
  const counts: Record<SidebarFilterTab, number> = {
    'All': 0,
    'Open': 0,
    'Pending': 0,
    'Resolved': 0,
  }
  if (!tickets.value) return counts
  counts['All'] = tickets.value.length

  for (const t of tickets.value) {
    const s = (t.state?.name || t.state?.stateType?.name || '').toLowerCase()
    if (s.includes('closed') || s.includes('resolved') || s.includes('merged')) {
      counts['Resolved']++
    } else if (s.includes('pending') || s.includes('waiting')) {
      counts['Pending']++
    } else {
      counts['Open']++
    }
  }
  return counts
})

const filteredTickets = computed(() => {
  if (!tickets.value) return []
  return tickets.value.filter((t) => {
    // 1. Filter by search query
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const titleMatch = t.title?.toLowerCase().includes(q)
      const numMatch = String(t.number || t.internalId || '').toLowerCase().includes(q)
      if (!titleMatch && !numMatch) return false
    }

    // 2. Filter by tab
    if (activeSidebarTab.value === 'All') return true
    const s = (t.state?.name || t.state?.stateType?.name || '').toLowerCase()
    if (activeSidebarTab.value === 'Open') {
      return (
        (s.includes('open') || s.includes('new')) &&
        !s.includes('closed') &&
        !s.includes('resolved') &&
        !s.includes('merged') &&
        !s.includes('pending') &&
        !s.includes('waiting')
      )
    }
    if (activeSidebarTab.value === 'Pending') {
      return s.includes('pending') || s.includes('waiting')
    }
    if (activeSidebarTab.value === 'Resolved') {
      return s.includes('closed') || s.includes('resolved') || s.includes('merged')
    }
    return true
  })
})

interface SidebarTicket {
  id?: string | number
  internalId?: number
  number?: string
  title?: string
  updatedAt?: string
  state?: {
    name?: string
    stateType?: {
      name?: string
    }
  }
}

const isClosedTicket = (ticket: SidebarTicket) => {
  const name = (ticket.state?.name || ticket.state?.stateType?.name || '').toLowerCase()
  return name.includes('closed') || name.includes('resolved') || name.includes('merged')
}

const formatStateLabel = (name?: string | null, fallback = 'Open') => {
  const raw = name || fallback
  const translated = __(raw)
  return translated.charAt(0).toUpperCase() + translated.slice(1)
}

const getStateBadge = (ticket: SidebarTicket) => {
  const name = (ticket.state?.name || ticket.state?.stateType?.name || 'open').toLowerCase()
  if (name.includes('closed') || name.includes('resolved') || name.includes('merged')) {
    return {
      type: 'closed' as const,
      label: formatStateLabel(ticket.state?.name, 'Closed'),
      class:
        'bg-[#e6eee8] text-[#243d2c] border border-[#b8d5c0] dark:bg-[#18261e] dark:text-[#a3ccae] dark:border-[#2f4f38]',
    }
  }
  if (name.includes('waiting')) {
    return {
      type: 'waiting' as const,
      label: formatStateLabel(ticket.state?.name, 'Waiting for Reply'),
      class:
        'bg-amber-50 text-amber-900 border border-amber-200/80 border-l-2 border-l-amber-500 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/70 dark:border-l-amber-500',
    }
  }
  if (name.includes('pending')) {
    return {
      type: 'pending' as const,
      label: formatStateLabel(ticket.state?.name, 'Pending'),
      class:
        'bg-purple-50 text-purple-900 border border-purple-200/80 border-l-2 border-l-purple-500 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/70 dark:border-l-purple-500',
    }
  }
  if (name.includes('new')) {
    return {
      type: 'new' as const,
      label: formatStateLabel(ticket.state?.name, 'New'),
      class:
        'bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] border-l-2 border-l-[#22c55e] dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/80 dark:border-l-[#22c55e]',
    }
  }
  return {
    type: 'open' as const,
    label: formatStateLabel(ticket.state?.name, 'Open'),
    class:
      'bg-sky-50 text-sky-900 border border-sky-200/80 border-l-2 border-l-sky-500 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800/70 dark:border-l-sky-500',
  }
}

const formatRelativeTime = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffInSeconds < 60) return __('Just now')
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

const navigateToTicket = (ticket: SidebarTicket) => {
  const ticketId = ticket.internalId || ticket.id
  router.push(`/tickets/${ticketId}`)
}
</script>

<template>
  <aside
    class="hidden md:flex md:w-80 lg:w-88 xl:w-96 h-full bg-white border-r border-slate-200 flex-col shrink-0 z-30 select-none shadow-xs transition-all duration-300"
  >
    <!-- Top Action Bar (Enlarged Buttons) -->
    <div class="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/80 shrink-0">
      <!-- Back to Dashboard Button -->
      <button
        type="button"
        class="flex items-center gap-2.5 text-sm font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200/90 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer shadow-2xs group active:scale-98"
        @click="router.push('/')"
      >
        <svg
          class="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:-translate-x-1 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>{{ $t('Back to Dashboard') }}</span>
      </button>

      <!-- Raise New Ticket Button / Active Drafting State -->
      <div
        v-if="isCreateView"
        class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs select-none"
      >
        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <span>{{ $t('Drafting New Ticket') }}</span>
      </div>
      <button
        v-else
        type="button"
        class="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#16a34a] hover:bg-[#15803d] hover:scale-[1.01] transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md active:scale-98"
        @click="router.push({ name: 'TicketCreate', query: { mode: 'form' } })"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
        </svg>
        <span>{{ $t('Raise a New Ticket') }}</span>
      </button>
    </div>

    <!-- Search / Filter Bar (Enlarged) -->
    <div class="p-3.5 border-b border-slate-100 shrink-0">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('Filter recent tickets...')"
          :aria-label="$t('Filter recent tickets...')"
          class="w-full ltr:pl-10 rtl:pr-10 ltr:pr-9 rtl:pl-9 py-2.5 text-sm bg-slate-50/80 border border-slate-200/90 rounded-xl focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none transition-all placeholder:text-slate-400"
        />
        <svg
          class="w-4 h-4 text-slate-400 absolute ltr:left-3.5 rtl:right-3.5 top-3.5 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button
          v-if="searchQuery"
          type="button"
          class="absolute top-2.5 ltr:right-2.5 rtl:left-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          :aria-label="$t('Clear search')"
          @click="searchQuery = ''"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Quick Filter Pills -->
      <div class="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          v-for="tab in sidebarFilterTabs"
          :key="tab"
          type="button"
          class="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-all duration-150 select-none active:scale-[0.98]"
          :class="
            activeSidebarTab === tab
              ? 'bg-[#1e3a5f] text-white border border-[#1e3a5f] shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-300/85 hover:border-slate-400 shadow-2xs dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
          "
          @click="activeSidebarTab = tab"
        >
          <span>{{ $t(tab) }}</span>
          <span
            v-if="sidebarTabCounts[tab] > 0"
            class="inline-flex items-center justify-center min-w-[15px] px-1 py-0.2 rounded-md text-[9.5px] font-bold leading-none tracking-tight"
            :class="
              activeSidebarTab === tab
                ? 'bg-white/20 text-white'
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-600 shadow-2xs'
            "
          >
            {{ sidebarTabCounts[tab] }}
          </span>
        </button>
      </div>
    </div>

    <!-- Sidebar Title & Count Header -->
    <div class="px-5 py-3 flex items-center justify-between bg-slate-50/50 border-b border-slate-100 shrink-0">
      <span class="text-xs font-black text-slate-500 uppercase tracking-wider">
        {{ $t('Recent Tickets') }}
      </span>
      <span class="px-2 py-0.5 rounded-md text-xs font-bold bg-[#e8f0f9] text-[#1e3a5f]">
        {{ filteredTickets.length }}
      </span>
    </div>

    <!-- Scrollable Tickets List (Bigger Cards & Text) with breathing room -->
    <div class="flex-1 overflow-y-auto px-3.5 pt-3 pb-4 space-y-2.5 min-h-0">
      <div v-if="loading && filteredTickets.length === 0" class="p-6 text-center text-sm text-slate-400">
        <div class="space-y-2.5 animate-pulse">
          <div class="h-16 bg-slate-100 rounded-xl"></div>
          <div class="h-16 bg-slate-100 rounded-xl"></div>
          <div class="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      </div>

      <div
        v-else-if="filteredTickets.length === 0"
        class="py-10 px-4 text-center text-slate-400 flex flex-col items-center justify-center"
      >
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100/90 text-slate-400 ring-6 ring-slate-50">
          <!-- Search icon if searching -->
          <svg
            v-if="searchQuery"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <!-- Filter icon if tab filtered -->
          <svg
            v-else-if="activeSidebarTab !== 'All'"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
          <!-- Default Empty Inbox Icon -->
          <svg
            v-else
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <span class="text-xs font-semibold text-slate-800">
          {{ searchQuery ? $t('No matching tickets') : (activeSidebarTab !== 'All' ? $t('No tickets in this filter') : $t('No tickets found')) }}
        </span>
        <span class="mt-1 text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
          {{ searchQuery ? $t('Try checking for spelling or clear your search.') : (activeSidebarTab !== 'All' ? $t('You have no tickets currently under this status.') : $t('Your recent tickets will appear here.')) }}
        </span>

        <button
          v-if="searchQuery"
          type="button"
          class="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 transition-colors cursor-pointer"
          @click="searchQuery = ''"
        >
          <span>{{ $t('Clear search') }}</span>
        </button>
        <button
          v-else-if="activeSidebarTab !== 'All'"
          type="button"
          class="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1e3a5f] bg-[#e8f0f9] hover:bg-[#d5e4f5] border border-[#1e3a5f]/20 transition-colors cursor-pointer"
          @click="activeSidebarTab = 'All'"
        >
          <span>{{ $t('View all tickets') }}</span>
        </button>
      </div>

      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        v-for="ticket in filteredTickets"
        :key="ticket.id"
        role="button"
        tabindex="0"
        class="ticket-sidebar-card p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 group will-change-transform hover:scale-[1.01]"
        :class="[
          currentTicketInternalId === String(ticket.internalId)
            ? (isClosedTicket(ticket)
                ? 'bg-slate-50 border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border-l-4 border-l-slate-600'
                : 'bg-[#e8f0f9] border-[#1e3a5f]/40 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border-l-4 border-l-[#1e3a5f]')
            : isClosedTicket(ticket)
              ? 'border-slate-200/70 bg-gradient-to-b from-slate-50/90 to-slate-100/75 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:bg-white hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-[#1e3a5f] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]',
        ]"
        @click="navigateToTicket(ticket)"
        @keydown.enter="navigateToTicket(ticket)"
      >
        <!-- Top: Ticket # and Status Pill -->
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-sm font-black transition-colors truncate"
            :class="
              currentTicketInternalId === String(ticket.internalId)
                ? 'text-[#1e3a5f]'
                : isClosedTicket(ticket)
                  ? 'text-slate-500 group-hover:text-slate-700'
                  : 'text-slate-600 group-hover:text-slate-900'
            "
          >
            #{{ ticket.number || ticket.internalId }}
          </span>

          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition-colors shadow-2xs"
            :class="getStateBadge(ticket).class"
          >
            <!-- Closed / Resolved Check Icon -->
            <svg
              v-if="getStateBadge(ticket).type === 'closed'"
              class="h-3 w-3 shrink-0 text-[#243d2c] dark:text-[#a3ccae]"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clip-rule="evenodd"
              />
            </svg>

            <!-- New Live Pulsing Dot -->
            <span
              v-else-if="getStateBadge(ticket).type === 'new'"
              class="relative flex h-1.5 w-1.5 shrink-0"
              aria-hidden="true"
            >
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]"></span>
            </span>

            <!-- Open Active Steady Dot -->
            <span
              v-else-if="getStateBadge(ticket).type === 'open'"
              class="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0"
              aria-hidden="true"
            ></span>

            <!-- Waiting for Reply Clock Icon -->
            <svg
              v-else-if="getStateBadge(ticket).type === 'waiting'"
              class="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                clip-rule="evenodd"
              />
            </svg>

            <!-- Pending Purple Dot -->
            <span
              v-else-if="getStateBadge(ticket).type === 'pending'"
              class="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0"
              aria-hidden="true"
            ></span>

            <span>{{ getStateBadge(ticket).label }}</span>
          </span>
        </div>

        <!-- Title -->
        <h4
          class="text-sm sm:text-base font-semibold line-clamp-2 leading-snug transition-colors"
          :class="
            currentTicketInternalId === String(ticket.internalId)
              ? 'text-slate-900 font-bold'
              : isClosedTicket(ticket)
                ? 'text-slate-700 group-hover:text-[#1e3a5f]'
                : 'text-slate-900 group-hover:text-[#1e3a5f]'
          "
        >
          {{ ticket.title }}
        </h4>

        <!-- Footer: Group / College & Time -->
        <div
          class="flex items-center justify-between text-xs font-medium pt-1 border-t transition-colors"
          :class="isClosedTicket(ticket) ? 'border-slate-200/60 text-slate-400' : 'border-slate-100 text-slate-500'"
        >
          <span>{{ ticket.group?.name || 'Support' }}</span>
          <span>{{ formatRelativeTime(ticket.updatedAt || ticket.createdAt) }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>
