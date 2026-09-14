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

const filteredTickets = computed(() => {
  if (!tickets.value) return []
  if (!searchQuery.value.trim()) return tickets.value
  const q = searchQuery.value.trim().toLowerCase()
  return tickets.value.filter((t) => {
    const titleMatch = t.title?.toLowerCase().includes(q)
    const numMatch = String(t.number || t.internalId || '').toLowerCase().includes(q)
    return titleMatch || numMatch
  })
})

const getStateBadge = (ticket: any) => {
  const name = (ticket.state?.name || ticket.state?.stateType?.name || 'open').toLowerCase()
  if (name.includes('new')) {
    return { label: 'New', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }
  if (name.includes('pending')) {
    return { label: 'Pending', class: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (name.includes('closed') || name.includes('resolved') || name.includes('merged')) {
    return { label: 'Resolved', class: 'bg-slate-100 text-slate-600 border-slate-200' }
  }
  return { label: ticket.state?.name || 'Open', class: 'bg-blue-50 text-blue-700 border-blue-200' }
}

const formatRelativeTime = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffInSeconds < 60) return 'Just now'
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

const navigateToTicket = (ticket: any) => {
  const ticketId = ticket.internalId || ticket.id
  router.push(`/tickets/${ticketId}`)
}
</script>

<template>
  <aside
    class="w-80 lg:w-88 xl:w-96 h-full bg-white border-r border-slate-200 flex flex-col shrink-0 z-30 select-none shadow-xs transition-all duration-300"
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

      <!-- Raise New Ticket Button -->
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md active:scale-98"
        :class="
          isCreateView
            ? 'bg-[#15803d] ring-2 ring-emerald-400/60'
            : 'bg-[#16a34a] hover:bg-[#15803d] hover:scale-[1.01]'
        "
        @click="router.push({ name: 'TicketCreate' })"
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
          class="w-full h-11 bg-slate-50 border border-slate-200/90 rounded-xl pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 transition-all"
          :placeholder="$t('Filter recent tickets...')"
        />
        <svg
          class="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <!-- Sidebar Title & Count Header -->
    <div class="px-5 py-3 flex items-center justify-between bg-slate-50/50 border-b border-slate-100 shrink-0">
      <span class="text-xs font-black text-slate-500 uppercase tracking-wider">
        {{ $t('Recent Tickets') }}
      </span>
      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e8f0f9] text-[#1e3a5f]">
        {{ filteredTickets.length }}
      </span>
    </div>

    <!-- Scrollable Tickets List (Bigger Cards & Text) -->
    <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
      <div v-if="loading && filteredTickets.length === 0" class="p-6 text-center text-sm text-slate-400">
        <div class="space-y-2.5 animate-pulse">
          <div class="h-16 bg-slate-100 rounded-xl"></div>
          <div class="h-16 bg-slate-100 rounded-xl"></div>
          <div class="h-16 bg-slate-100 rounded-xl"></div>
        </div>
      </div>

      <div
        v-else-if="filteredTickets.length === 0"
        class="p-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2.5"
      >
        <svg class="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span class="font-medium">{{ $t('No tickets found') }}</span>
      </div>

      <div
        v-for="ticket in filteredTickets"
        :key="ticket.id"
        class="p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 group hover:scale-[1.01]"
        :class="
          currentTicketInternalId === String(ticket.internalId)
            ? 'bg-[#e8f0f9] border-[#1e3a5f]/40 shadow-xs border-l-4 border-l-[#1e3a5f]'
            : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
        "
        @click="navigateToTicket(ticket)"
      >
        <!-- Top: Ticket # and Status Pill -->
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-sm font-black transition-colors"
            :class="
              currentTicketInternalId === String(ticket.internalId)
                ? 'text-[#1e3a5f]'
                : 'text-slate-600 group-hover:text-slate-900'
            "
          >
            #{{ ticket.number || ticket.internalId }}
          </span>
          <span
            class="px-2.5 py-1 rounded-full text-xs font-bold border"
            :class="getStateBadge(ticket).class"
          >
            {{ getStateBadge(ticket).label }}
          </span>
        </div>

        <!-- Title -->
        <h4
          class="text-sm sm:text-base font-bold line-clamp-2 leading-snug transition-colors"
          :class="
            currentTicketInternalId === String(ticket.internalId)
              ? 'text-slate-900 font-extrabold'
              : 'text-slate-800 group-hover:text-[#1e3a5f]'
          "
        >
          {{ ticket.title }}
        </h4>

        <!-- Footer: Group / College & Time -->
        <div class="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
          <span>{{ ticket.group?.name || 'Support' }}</span>
          <span>{{ formatRelativeTime(ticket.updatedAt || ticket.createdAt) }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>
