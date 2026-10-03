<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'
import NotificationPopover from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification/NotificationPopover.vue'
import { useOnlineNotificationActions } from '#shared/entities/online-notification/composables/useOnlineNotificationActions.ts'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useOnlineNotificationList } from '#shared/entities/online-notification/composables/useOnlineNotificationList.ts'
import type { OnlineNotification } from '#shared/graphql/types.ts'
import { useSessionStore } from '#shared/stores/session.ts'

const router = useRouter()
const session = useSessionStore()

const currentUserName = computed(() => {
  return session.user?.firstname || session.user?.login || 'Agent'
})

// Activity Stream State (Available via slide-over drawer)
interface ActivityItem {
  id: number
  o_id: number
  object: string
  type: string
  created_by?: string
  created_at: string
}

const activityStream = ref<ActivityItem[]>([])
const activityStreamLoading = ref(false)

// Notifications State & Dialog
const showNotificationsDialog = ref(false)
const { unseenCount } = useOnlineNotificationCount()
const {
  notificationList,
  loading: isNotificationLoading,
  hasUnseenNotification,
} = useOnlineNotificationList()
const { markAllRead, deleteNotification, seenNotification } = useOnlineNotificationActions()

const runMarkAsSeen = async (notification: OnlineNotification) => {
  if (notification.seen) return
  await seenNotification(notification.id)
}

const removeNotification = async (notification: OnlineNotification) => {
  await deleteNotification(notification.id)
}

const runMarkAllRead = async () => {
  const ids = notificationList.value.map((notification) => notification.id)
  await markAllRead(ids)
}

const totalActivityCount = computed(() => {
  return (unseenCount.value ?? 0) + activityStream.value.length
})

// Live Stats Store Interface (Parity with Legacy StatsStore)
interface DashboardStatsData {
  StatsTicketWaitingTime?: {
    handling_time?: number
    average_per_agent?: number
    state?: string
    percent?: number
  }
  StatsTicketEscalation?: {
    used_for_average?: number
    average_per_agent?: number | string
    state?: string
    own?: number
    total?: number
  }
  StatsTicketChannelDistribution?: {
    channels?: Record<string, {
      icon?: string
      sender?: string
      inbound?: number
      outbound?: number
      inbound_in_percent?: number
      outbound_in_percent?: number
      overal_percentage?: number
    }>
  }
  StatsTicketLoadMeasure?: {
    used_for_average?: number
    average_per_agent?: number | string
    percent?: number
    state?: string
    own?: number
    total?: number
    average_per_agent_in_percent?: number
  }
  StatsTicketInProcess?: {
    used_for_average?: number
    average_per_agent?: number | string
    state?: string
    in_process?: number
    percent?: number
    total?: number
  }
  StatsTicketReopen?: {
    used_for_average?: number
    percent?: number
    average_per_agent?: number | string
    state?: string
    count?: number
    total?: number
  }
}

const isStatsLoading = ref(true)
const statsData = ref<DashboardStatsData>({})

// Fetch Live Stats from Session Collections (/api/v1/signshow)
const fetchStats = async () => {
  isStatsLoading.value = true
  try {
    const res = await fetch('/api/v1/signshow', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      const statsStoreItem = data.collections?.StatsStore?.[0]
      if (statsStoreItem?.data) {
        statsData.value = statsStoreItem.data
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard stats:', err)
  } finally {
    isStatsLoading.value = false
  }
}

// Fetch Activity Stream for Drawer
const fetchActivityStream = async () => {
  activityStreamLoading.value = true
  try {
    const res = await fetch('/api/v1/activity_stream?expand=true&limit=25', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      activityStream.value = Array.isArray(data) ? data : []
    }
  } catch (err) {
    console.error('Failed to fetch activity stream:', err)
  } finally {
    activityStreamLoading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([fetchStats(), fetchActivityStream()])
}

onMounted(() => {
  refreshAll()
})

// Navigation Handlers (Vue native routes)
const goToCreateTicket = () => {
  router.push('/ticket/create')
}

const goToMyAssignedTickets = () => {
  router.push('/ticket/view/my_assigned')
}

const goToTicket = (ticketId: number) => {
  router.push(`/ticket/${ticketId}`)
}

// Computed Helpers for the 6 Core Stats Widgets
const waitingTime = computed(() => {
  const d = statsData.value.StatsTicketWaitingTime
  const time = d?.handling_time ?? 0
  const avg = d?.average_per_agent ?? 0
  const state = d?.state ?? 'supergood'
  const timeFormatted = time >= 60 ? `${Math.floor(time / 60)}h ${time % 60}m` : `${time}m`
  const avgFormatted = avg >= 60 ? `${Math.floor(avg / 60)}h ${avg % 60}m` : `${avg}m`
  return {
    time: timeFormatted,
    timeRaw: time,
    avg: avgFormatted,
    state,
  }
})

const escalationMood = computed(() => {
  const d = statsData.value.StatsTicketEscalation
  const own = d?.own ?? 0
  const total = d?.total ?? 0
  const state = d?.state || (own === 0 ? 'supergood' : own <= 1 ? 'good' : own <= 4 ? 'ok' : 'bad')
  return {
    state,
    own,
    total,
  }
})

const channelDistribution = computed(() => {
  const channels = statsData.value.StatsTicketChannelDistribution?.channels || {}
  const email = channels.email || { inbound: 0, outbound: 0, inbound_in_percent: 0, outbound_in_percent: 0 }
  const phone = channels.phone || { inbound: 0, outbound: 0, inbound_in_percent: 0, outbound_in_percent: 0 }
  const web = channels.web || { inbound: 0, outbound: 0, inbound_in_percent: 0, outbound_in_percent: 0 }

  const total =
    (email.inbound || 0) +
    (email.outbound || 0) +
    (phone.inbound || 0) +
    (phone.outbound || 0) +
    (web.inbound || 0) +
    (web.outbound || 0)

  const calcShare = (inbound: number, outbound: number) => {
    if (total === 0) return 0
    return Math.round(((inbound + outbound) / total) * 100)
  }

  return {
    email: {
      inbound: email.inbound || 0,
      outbound: email.outbound || 0,
      inbound_pct: email.inbound_in_percent || 0,
      outbound_pct: email.outbound_in_percent || 0,
      share: calcShare(email.inbound || 0, email.outbound || 0),
    },
    phone: {
      inbound: phone.inbound || 0,
      outbound: phone.outbound || 0,
      inbound_pct: phone.inbound_in_percent || 0,
      outbound_pct: phone.outbound_in_percent || 0,
      share: calcShare(phone.inbound || 0, phone.outbound || 0),
    },
    web: {
      inbound: web.inbound || 0,
      outbound: web.outbound || 0,
      inbound_pct: web.inbound_in_percent || 0,
      outbound_pct: web.outbound_in_percent || 0,
      share: calcShare(web.inbound || 0, web.outbound || 0),
    },
    total,
  }
})

const loadMeasure = computed(() => {
  const d = statsData.value.StatsTicketLoadMeasure
  const own = d?.own ?? 0
  const total = d?.total ?? 0
  const avg = d?.average_per_agent ?? 0
  const state = d?.state ?? 'good'
  return {
    own,
    total,
    avg,
    state,
  }
})

const inProcess = computed(() => {
  const d = statsData.value.StatsTicketInProcess
  const percent = d?.percent ?? 0
  const inCount = d?.in_process ?? 0
  const total = d?.total ?? 0
  const avg = d?.average_per_agent ?? 0
  const state = d?.state ?? 'good'
  return {
    percent,
    inCount,
    total,
    avg,
    state,
  }
})

const reopen = computed(() => {
  const d = statsData.value.StatsTicketReopen
  const percent = d?.percent ?? 0
  const count = d?.count ?? 0
  const total = d?.total ?? 0
  const avg = d?.average_per_agent ?? 0
  const state = d?.state ?? 'good'
  return {
    percent,
    count,
    total,
    avg,
    state,
  }
})

// Mood Visual Mapping
const getMoodBadge = (state: string) => {
  switch (state.toLowerCase()) {
    case 'supergood':
      return {
        label: __('Supergood'),
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        cardGlow: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
      }
    case 'good':
      return {
        label: __('Good'),
        bg: 'bg-lime-50 dark:bg-lime-950/40 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-800',
        dot: 'bg-lime-500',
        iconColor: 'text-lime-600 dark:text-lime-400',
        cardGlow: 'hover:border-lime-400 dark:hover:border-lime-600 hover:shadow-lime-500/10',
      }
    case 'ok':
      return {
        label: __('Ok'),
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        dot: 'bg-amber-500',
        iconColor: 'text-amber-600 dark:text-amber-400',
        cardGlow: 'hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-amber-500/10',
      }
    case 'bad':
      return {
        label: __('Bad'),
        bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        dot: 'bg-orange-500',
        iconColor: 'text-orange-600 dark:text-orange-400',
        cardGlow: 'hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-orange-500/10',
      }
    case 'superbad':
    default:
      return {
        label: __('Superbad'),
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500',
        iconColor: 'text-rose-600 dark:text-rose-400',
        cardGlow: 'hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-rose-500/10',
      }
  }
}

// Activity Formatting Helpers for Drawer
const formatRelativeTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffInSeconds < 60) return __('just now')
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

const getActivityTitle = (item: ActivityItem) => {
  if (item.object === 'Ticket') {
    if (item.type === 'create') return `Ticket #${item.o_id} ${__('Created')}`
    if (item.type === 'update') return `Ticket #${item.o_id} ${__('Updated')}`
    return `Ticket #${item.o_id} (${item.type})`
  }
  if (item.object === 'Ticket::Article') {
    return `${__('New Article on Ticket')} #${item.o_id}`
  }
  if (item.object === 'User') {
    return `User ${item.type}`
  }
  return `${item.object} ${item.type}`
}

const getActivityDescription = (item: ActivityItem) => {
  const author = item.created_by && item.created_by !== '-' ? item.created_by : __('System')
  if (item.object === 'Ticket') {
    return `${__('Ticket action by')} ${author}`
  }
  if (item.object === 'Ticket::Article') {
    return `${__('New response added by')} ${author}`
  }
  return `${__('Action performed by')} ${author}`
}
</script>

<template>
  <LayoutMain background-variant="tertiary" class="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/60 min-h-screen">
    <div class="max-w-[1440px] mx-auto space-y-8 select-none font-sans text-slate-800 dark:text-slate-100">
      
      <!-- HERO HEADER BAR -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-all duration-300 hover:shadow-md">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {{ __('Welcome back') }}, {{ currentUserName }}
            </h1>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {{ __('Live Dashboard') }}
            </span>
          </div>
          <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1.5">
            {{ __('Real-time ticket load, handling metrics, and team performance overview.') }}
          </p>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Refresh Button -->
          <button
            type="button"
            class="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-700/60 dark:hover:bg-slate-700 rounded-xl border border-slate-200/80 dark:border-slate-600 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-xs hover:scale-102 active:scale-95"
            :disabled="isStatsLoading || activityStreamLoading"
            @click="refreshAll"
          >
            <svg
              class="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-300"
              :class="{ 'animate-spin': isStatsLoading || activityStreamLoading }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>{{ isStatsLoading ? __('Refreshing...') : __('Refresh Stats') }}</span>
          </button>

          <!-- Activity Stream Slide-over Drawer Button -->
          <button
            type="button"
            class="border border-slate-200/80 dark:border-slate-600 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all duration-200 hover:scale-102 active:scale-95 shadow-xs"
            @click="showNotificationsDialog = true"
          >
            <div class="relative">
              <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span v-if="totalActivityCount > 0" class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"></span>
            </div>
            <span>{{ __('Activity Stream') }}</span>
            <span class="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-xs">
              {{ totalActivityCount }}
            </span>
          </button>

          <!-- New Ticket Native Vue Button -->
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all duration-200 hover:scale-102 hover:shadow-md hover:shadow-blue-500/20 active:scale-95 cursor-pointer"
            @click="goToCreateTicket"
          >
            <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            <span>{{ __('New Ticket') }}</span>
          </button>
        </div>
      </div>

      <!-- SLIDE-OVER DRAWER (ACTIVITY STREAM) -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="showNotificationsDialog"
            class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9999]"
            @click="showNotificationsDialog = false"
          ></div>
        </Transition>
        
        <Transition name="slide-drawer">
          <div
            v-if="showNotificationsDialog"
            class="fixed top-0 bottom-0 right-0 w-96 max-w-full bg-white dark:bg-slate-800 shadow-2xl z-[9999] flex flex-col border-l border-slate-200/80 dark:border-slate-700"
          >
            <!-- DRAWER HEADER -->
            <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/90 shrink-0 sticky top-0 z-20">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{{ __('Activity Stream') }}</h4>
                  <p class="text-xs text-slate-400 font-medium">{{ __('Live system notifications & updates') }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                  {{ totalActivityCount }}
                </span>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  @click="showNotificationsDialog = false"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- DRAWER CONTENT -->
            <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 p-3">
              <NotificationPopover
                v-if="notificationList && notificationList.length > 0"
                :loading="isNotificationLoading"
                :has-unseen-notification="hasUnseenNotification"
                :notification-list="notificationList"
                @visited="showNotificationsDialog = false"
                @seen="runMarkAsSeen"
                @remove="removeNotification"
                @seen-all="runMarkAllRead"
              />

              <div v-if="activityStreamLoading" class="p-8 text-center text-xs text-slate-400 font-medium">
                {{ __('Loading activity stream...') }}
              </div>

              <div v-else-if="activityStream.length === 0" class="p-8 text-center text-xs text-slate-400 font-medium">
                {{ __('No recent activities found.') }}
              </div>

              <div
                v-for="item in activityStream"
                :key="item.id"
                class="p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all flex items-start gap-3 cursor-pointer group"
                @click="item.object === 'Ticket' || item.object === 'Ticket::Article' ? (showNotificationsDialog = false, goToTicket(item.o_id)) : (showNotificationsDialog = false)"
              >
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 mt-0.5 shadow-xs">
                  <svg v-if="item.object === 'Ticket'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path>
                  </svg>
                  <svg v-else-if="item.object === 'Ticket::Article'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"></path>
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-1">
                    <p class="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {{ getActivityTitle(item) }}
                    </p>
                    <span class="text-[11px] text-slate-400 font-medium shrink-0">{{ formatRelativeTime(item.created_at) }}</span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 font-medium">{{ getActivityDescription(item) }}</p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- 6 CORE STATS CARDS GRID (ANIMATED, HIGHLY INTERACTIVE ON HOVER) -->
      <div>
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-2.5">
            <h2 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase">{{ __('My Performance Stats') }}</h2>
            <span class="text-xs font-medium text-slate-400 dark:text-slate-500">• {{ __('Live metrics from Zammad Stats Engine') }}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">

          <!-- CARD 1: Ø WAITING TIME TODAY (StatsTicketWaitingTime) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-default"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-blue-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-blue-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {{ __('Ø Waiting Time Today') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Average customer wait time for agent responses') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>

              <div class="my-6">
                <div class="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform duration-200">
                  {{ waitingTime.time }}
                </div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                  {{ __('My handling time:') }} {{ waitingTime.time }}
                </p>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{{ __('Average per agent:') }} {{ waitingTime.avg }}</span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-transform duration-200 group-hover:scale-105" :class="getMoodBadge(waitingTime.state).bg">
                {{ waitingTime.state }}
              </span>
            </div>
          </div>

          <!-- CARD 2: MOOD (StatsTicketEscalation) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-default"
            :class="getMoodBadge(escalationMood.state).cardGlow"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {{ __('Mood') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Escalation status of your assigned tickets') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>

              <div class="my-6">
                <div class="text-4xl md:text-5xl font-black tracking-tight capitalize group-hover:translate-x-1 transition-transform duration-200" :class="getMoodBadge(escalationMood.state).iconColor">
                  {{ getMoodBadge(escalationMood.state).label }}
                </div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                  {{ escalationMood.own }} {{ __('of my tickets escalated') }}
                </p>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{{ __('Total escalated across groups:') }} {{ escalationMood.total }}</span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-transform duration-200 group-hover:scale-105" :class="getMoodBadge(escalationMood.state).bg">
                <span class="w-2 h-2 rounded-full" :class="getMoodBadge(escalationMood.state).dot"></span>
                {{ escalationMood.state }}
              </span>
            </div>
          </div>

          <!-- CARD 3: CHANNEL DISTRIBUTION (StatsTicketChannelDistribution) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:border-purple-400 dark:hover:border-purple-500 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-default"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-purple-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-purple-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {{ __('Channel Distribution') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Inbound & outbound communication channels') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
              </div>

              <div class="space-y-3.5 my-4">
                <!-- Email -->
                <div class="p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div class="flex items-center justify-between text-xs sm:text-sm font-semibold mb-1.5">
                    <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold">
                      <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                      <span>{{ __('Email') }}</span>
                    </div>
                    <span class="font-extrabold text-slate-900 dark:text-white">{{ channelDistribution.email.share }}%</span>
                  </div>
                  <div class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div class="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out" :style="{ width: `${channelDistribution.email.share}%` }"></div>
                  </div>
                </div>

                <!-- Phone -->
                <div class="p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div class="flex items-center justify-between text-xs sm:text-sm font-semibold mb-1.5">
                    <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold">
                      <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                      </svg>
                      <span>{{ __('Phone') }}</span>
                    </div>
                    <span class="font-extrabold text-slate-900 dark:text-white">{{ channelDistribution.phone.share }}%</span>
                  </div>
                  <div class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div class="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" :style="{ width: `${channelDistribution.phone.share}%` }"></div>
                  </div>
                </div>

                <!-- Web -->
                <div class="p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                  <div class="flex items-center justify-between text-xs sm:text-sm font-semibold mb-1.5">
                    <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold">
                      <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                      </svg>
                      <span>{{ __('Web / Portal') }}</span>
                    </div>
                    <span class="font-extrabold text-slate-900 dark:text-white">{{ channelDistribution.web.share }}%</span>
                  </div>
                  <div class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                    <div class="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out" :style="{ width: `${channelDistribution.web.share}%` }"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              {{ __('Total channel tickets handled:') }} {{ channelDistribution.total }}
            </div>
          </div>

          <!-- CARD 4: ASSIGNED (StatsTicketLoadMeasure) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-pointer"
            @click="goToMyAssignedTickets"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-indigo-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {{ __('Assigned') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Tickets assigned to you out of all open group tickets') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                </div>
              </div>

              <div class="my-6">
                <div class="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform duration-200">
                  {{ loadMeasure.own }} / {{ loadMeasure.total }}
                </div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                  {{ __('Tickets assigned to me:') }} {{ loadMeasure.own }} {{ __('of') }} {{ loadMeasure.total }}
                </p>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{{ __('Average per agent:') }} {{ loadMeasure.avg }}</span>
              <span class="text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {{ __('View Tickets') }} →
              </span>
            </div>
          </div>

          <!-- CARD 5: MY TICKETS IN PROCESS (StatsTicketInProcess) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:border-teal-400 dark:hover:border-teal-500 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-default"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-teal-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-teal-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {{ __('My Tickets in Process') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Percentage of tickets actively updated or in progress') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                  </svg>
                </div>
              </div>

              <div class="my-6">
                <div class="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform duration-200">
                  {{ inProcess.percent }}%
                </div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                  {{ inProcess.percent }}% {{ __('are currently in process') }} ({{ inProcess.inCount }} {{ __('of') }} {{ inProcess.total }})
                </p>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{{ __('Average per agent:') }} {{ inProcess.avg }}%</span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-transform duration-200 group-hover:scale-105" :class="getMoodBadge(inProcess.state).bg">
                {{ inProcess.state }}
              </span>
            </div>
          </div>

          <!-- CARD 6: REOPENING RATE (StatsTicketReopen) -->
          <div
            class="stat-card group relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-xl hover:-translate-y-2 hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden cursor-default"
          >
            <!-- Card Top Corner Accent Light -->
            <div class="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-xl group-hover:scale-150 group-hover:bg-amber-500/20 transition-all duration-500 pointer-events-none"></div>

            <div class="relative z-10">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-sm font-extrabold tracking-wider text-slate-600 dark:text-slate-300 uppercase group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {{ __('Reopening Rate') }}
                  </h3>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-400 mt-1">
                    {{ __('Percentage of closed tickets reopened by customers') }}
                  </p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-xs shrink-0 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                </div>
              </div>

              <div class="my-6">
                <div class="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform duration-200">
                  {{ reopen.percent }}%
                </div>
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">
                  {{ reopen.percent }}% {{ __('have been reopened') }} ({{ reopen.count }} {{ __('of') }} {{ reopen.total }})
                </p>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>{{ __('Average per agent:') }} {{ reopen.avg }}</span>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-transform duration-200 group-hover:scale-105" :class="getMoodBadge(reopen.state).bg">
                {{ reopen.state }}
              </span>
            </div>
          </div>

        </div>
      </div>

    </div>
  </LayoutMain>
</template>

<style scoped>
/* Card Hover Micro-animations */
.stat-card {
  will-change: transform, box-shadow;
  backface-visibility: hidden;
}

/* Backdrop Fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide-over Drawer Spring Animation */
.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-drawer-enter-from,
.slide-drawer-leave-to {
  transform: translateX(100%);
}
</style>
