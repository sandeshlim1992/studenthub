<!-- eslint-disable -->
<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
/* eslint-disable */
import { computed, onMounted, ref } from 'vue'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'
import NotificationPopover from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification/NotificationPopover.vue'
import { useOnlineNotificationActions } from '#shared/entities/online-notification/composables/useOnlineNotificationActions.ts'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useOnlineNotificationList } from '#shared/entities/online-notification/composables/useOnlineNotificationList.ts'
import type { OnlineNotification } from '#shared/graphql/types.ts'
import { useSessionStore } from '#shared/stores/session.ts'

const session = useSessionStore()

// Range State
const selectedRange = ref<'30D' | '90D'>('30D')

// Notifications State & Dialog
const showNotificationsDialog = ref(false)

const { unseenCount } = useOnlineNotificationCount()
const {
  notificationList,
  loading: isLoading,
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

// Activity Stream State
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

const fetchActivityStream = async () => {
  activityStreamLoading.value = true
  try {
    const res = await fetch('/api/v1/activity_stream?expand=true&limit=15', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      activityStream.value = Array.isArray(data) ? data : []
    }
  } catch (e) {
    console.error('Failed to fetch activity stream:', e)
  } finally {
    activityStreamLoading.value = false
  }
}

onMounted(() => {
  fetchActivityStream()
})

const formatRelativeTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diffInSeconds < 60) return 'just now'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

const getActivityTitle = (item: ActivityItem) => {
  if (item.object === 'Ticket') {
    if (item.type === 'create') return `Ticket #${item.o_id} Created`
    if (item.type === 'update') return `Ticket #${item.o_id} Updated`
    return `Ticket #${item.o_id} (${item.type})`
  }
  if (item.object === 'Ticket::Article') {
    return `New Article on Ticket #${item.o_id}`
  }
  if (item.object === 'User') {
    return `User ${item.type}`
  }
  return `${item.object} ${item.type}`
}

const getActivityDescription = (item: ActivityItem) => {
  const author = item.created_by && item.created_by !== '-' ? item.created_by : 'System'
  if (item.object === 'Ticket') {
    return `Ticket action by ${author}`
  }
  if (item.object === 'Ticket::Article') {
    return `New response/article added by ${author}`
  }
  return `Action performed by ${author}`
}

const totalCount = computed(() => {
  return (unseenCount.value ?? 0) + activityStream.value.length
})

// Chart dates (Oct 1 to Oct 31)
const chartDates = ['Oct 1', '5', '7', '9', '11', '13', '17', '19', '21', '25', '27', 'Oct 31']

// Interactive Line Chart Data Points
const hoveredLineIndex = ref<number | null>(null)
const lineDataPoints = [
  { date: 'Oct 1', opened: 0, closed: 0, cx: 0, cyOpened: 190, cyClosed: 190 },
  { date: 'Oct 5', opened: 12, closed: 8, cx: 80, cyOpened: 160, cyClosed: 175 },
  { date: 'Oct 7', opened: 24, closed: 18, cx: 160, cyOpened: 135, cyClosed: 150 },
  { date: 'Oct 9', opened: 32, closed: 26, cx: 240, cyOpened: 115, cyClosed: 130 },
  { date: 'Oct 11', opened: 45, closed: 38, cx: 320, cyOpened: 98, cyClosed: 110 },
  { date: 'Oct 13', opened: 52, closed: 42, cx: 400, cyOpened: 90, cyClosed: 105 },
  { date: 'Oct 17', opened: 60, closed: 50, cx: 480, cyOpened: 80, cyClosed: 95 },
  { date: 'Oct 19', opened: 68, closed: 58, cx: 560, cyOpened: 70, cyClosed: 85 },
  { date: 'Oct 21', opened: 66, closed: 55, cx: 640, cyOpened: 72, cyClosed: 88 },
  { date: 'Oct 25', opened: 75, closed: 64, cx: 720, cyOpened: 60, cyClosed: 78 },
  { date: 'Oct 31', opened: 82, closed: 70, cx: 800, cyOpened: 50, cyClosed: 70 },
]

// Interactive Stacked Bar Chart Data
const hoveredBarIndex = ref<number | null>(null)
const barChartData = [
  { date: 'Oct 1', high: 45, low: 25 },
  { date: 'Oct 5', high: 60, low: 25 },
  { date: 'Oct 7', high: 65, low: 25 },
  { date: 'Oct 9', high: 65, low: 25 },
  { date: 'Oct 11', high: 65, low: 25 },
  { date: 'Oct 13', high: 65, low: 25 },
  { date: 'Oct 17', high: 40, low: 25 },
  { date: 'Oct 19', high: 65, low: 25 },
  { date: 'Oct 21', high: 65, low: 25 },
  { date: 'Oct 25', high: 65, low: 25 },
  { date: 'Oct 27', high: 65, low: 25 },
  { date: 'Oct 31', high: 65, low: 25 },
]
</script>

<template>
  <LayoutMain background-variant="tertiary" class="p-6 bg-slate-50 min-h-screen">
    <div class="max-w-[1400px] mx-auto space-y-6 font-sans select-none text-slate-800">
      <!-- TOP HEADER BAR: MY STATS TITLE & ACTIVITY STREAM BUTTON -->
      <div class="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200/80 shadow-xs relative z-30">
        <div>
          <h1 class="text-xl font-black text-slate-900 tracking-tight">My Stats</h1>
          <p class="text-xs font-medium text-slate-500 mt-0.5">Real-time agent overview and performance metrics</p>
        </div>

        <!-- ACTIVITY STREAM SLIDE-OVER DRAWER BUTTON -->
        <div>
          <button
            type="button"
            class="border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2.5 cursor-pointer transition-all hover:scale-102 active:scale-98 shadow-xs hover:border-slate-300"
            @click="showNotificationsDialog = true"
          >
            <div class="relative">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <!-- Unread Badge Dot -->
              <span v-if="totalCount > 0" class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            <span>Activity Stream</span>
            <span class="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
              {{ totalCount }}
            </span>
          </button>
        </div>
      </div>

      <!-- SLIDE-OVER DRAWER (BACKDROP & PANEL WITH VUE TRANSITIONS & TELEPORT) -->
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
            class="fixed top-0 bottom-0 right-0 w-96 max-w-full bg-white shadow-2xl z-[9999] flex flex-col border-l border-slate-200/80"
          >
            <!-- DRAWER HEADER (ALWAYS PINNED TO TOP) -->
            <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0 sticky top-0 z-20">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-slate-900 tracking-tight">Activity Stream</h4>
                  <p class="text-xs text-slate-400 font-medium">Live system activity & notifications</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                  {{ totalCount }}
                </span>
                <button
                  type="button"
                  class="w-8 h-8 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  @click="showNotificationsDialog = false"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            <!-- DRAWER INTERIOR (SCROLLABLE AREA) -->
            <div class="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              <!-- ONLINE NOTIFICATIONS (IF ANY) -->
              <NotificationPopover
                v-if="notificationList && notificationList.length > 0"
                :loading="isLoading"
                :has-unseen-notification="hasUnseenNotification"
                :notification-list="notificationList"
                @visited="showNotificationsDialog = false"
                @seen="runMarkAsSeen"
                @remove="removeNotification"
                @seen-all="runMarkAllRead"
              />

              <div v-if="activityStreamLoading" class="p-8 text-center text-xs text-slate-400 font-medium">
                Loading activity stream...
              </div>

              <div v-else-if="activityStream.length === 0" class="p-8 text-center text-xs text-slate-400 font-medium">
                No recent activities found.
              </div>

              <a
                v-for="item in activityStream"
                :key="item.id"
                :href="item.object === 'Ticket' || item.object === 'Ticket::Article' ? `/#ticket/zoom/${item.o_id}` : '#'"
                class="p-3.5 rounded-lg hover:bg-slate-50 transition-all duration-150 flex items-start gap-3 cursor-pointer block hover:scale-[1.01]"
                @click="showNotificationsDialog = false"
              >
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 shadow-xs"
                >
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
                    <p class="text-xs font-bold text-slate-900 truncate">{{ getActivityTitle(item) }}</p>
                    <span class="text-[10px] text-slate-400 font-medium shrink-0">{{ formatRelativeTime(item.created_at) }}</span>
                  </div>
                  <p class="text-xs text-slate-500 line-clamp-2 mt-0.5 font-medium">{{ getActivityDescription(item) }}</p>
                </div>
              </a>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- ROW 1: TOP 3 INTERACTIVE METRIC CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- CARD 1: Waiting Time -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">Ø Waiting time today</h3>
            <div class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-4xl font-black tracking-tight text-slate-900">0m</div>
            <p class="text-sm font-semibold text-slate-600 mt-1">My handling time: 0 minutes</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Average: 0 minutes
          </div>
        </div>

        <!-- CARD 2: Mood -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">Mood</h3>
            <div class="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-4xl font-black tracking-tight text-emerald-600 capitalize">supergood</div>
            <p class="text-sm font-semibold text-slate-600 mt-1">0 of my tickets escalated</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Total: 4
          </div>
        </div>

        <!-- CARD 3: Channel Distribution -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between mb-3">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">Channel Distribution</h3>
            <div class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
              </svg>
            </div>
          </div>

          <div class="space-y-2.5 mt-2">
            <!-- Email -->
            <div class="flex items-center justify-between gap-3 text-sm p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              <div class="flex items-center gap-2.5 text-slate-600 font-semibold text-xs">
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <span>Email</span>
              </div>
              <div class="flex-1 max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-emerald-600 h-full w-0 rounded-full transition-all duration-300"></div>
              </div>
              <span class="font-bold text-slate-700 w-8 text-right text-xs">0%</span>
            </div>

            <!-- Phone -->
            <div class="flex items-center justify-between gap-3 text-sm p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              <div class="flex items-center gap-2.5 text-slate-900 font-bold text-xs">
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                <span>Phone</span>
              </div>
              <div class="flex-1 max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-[#16a34a] h-full w-full rounded-full transition-all duration-300 shadow-2xs"></div>
              </div>
              <span class="font-bold text-emerald-700 w-8 text-right text-xs">100%</span>
            </div>

            <!-- Web -->
            <div class="flex items-center justify-between gap-3 text-sm p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              <div class="flex items-center gap-2.5 text-slate-600 font-semibold text-xs">
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                <span>Web / Form</span>
              </div>
              <div class="flex-1 max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-emerald-600 h-full w-0 rounded-full transition-all duration-300"></div>
              </div>
              <span class="font-bold text-slate-700 w-8 text-right text-xs">0%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ROW 2: MIDDLE 3 INTERACTIVE METRIC CARDS -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- CARD 4: Assigned -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">Assigned</h3>
            <div class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-4xl font-black tracking-tight text-slate-900">1 / 15</div>
            <p class="text-sm font-semibold text-slate-600 mt-1">Tickets assigned to me: 1 of 15</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Average: 0.5
          </div>
        </div>

        <!-- CARD 5: Tickets in process -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">My tickets in process</h3>
            <div class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-4xl font-black tracking-tight text-slate-900">100%</div>
            <p class="text-sm font-semibold text-slate-600 mt-1">100% are currently in process</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Average: 2.9%
          </div>
        </div>

        <!-- CARD 6: Reopening rate -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-300 transition-all duration-200 relative group">
          <div class="flex items-start justify-between">
            <h3 class="text-xs font-bold tracking-wider text-slate-500 uppercase group-hover:text-emerald-700 transition-colors">Reopening rate</h3>
            <div class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 group-hover:bg-[#16a34a] group-hover:text-white group-hover:border-emerald-500 transition-all shadow-2xs">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-4xl font-black tracking-tight text-slate-900">0%</div>
            <p class="text-sm font-semibold text-slate-600 mt-1">0% have been reopened</p>
          </div>
          <div class="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">
            Average: 0.0
          </div>
        </div>
      </div>

      <!-- ROW 3: BOTTOM CHARTS GRID (PROPERLY FITTED, NO CUTTING) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- CHART CARD 1: Opened vs Closed (Interactive Spline) -->
        <div class="bg-white rounded-2xl p-6 pb-4 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 class="text-xs font-bold tracking-wider text-slate-600 uppercase">Tickets Opened vs. Closed (Month by Month)</h3>
              
              <!-- Range Controls -->
              <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
                  :class="selectedRange === '30D' ? 'bg-[#16a34a] text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                  @click="selectedRange = '30D'"
                >
                  30D
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
                  :class="selectedRange === '90D' ? 'bg-[#16a34a] text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'"
                  @click="selectedRange = '90D'"
                >
                  90D
                </button>
              </div>
            </div>

            <!-- Interactive Legend -->
            <div class="flex items-center gap-6 mb-4 text-xs font-bold text-slate-700">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-1.5 bg-slate-800 rounded-full"></span>
                <span>Tickets Opened</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Tickets Closed</span>
              </div>
            </div>

            <!-- INTERACTIVE SVG LINE CHART WITH PROPER SPACING & HOVER TOOLTIPS -->
            <div class="w-full h-[240px] relative mt-2 overflow-hidden">
              <!-- Floating Hover Tooltip -->
              <div
                v-if="hoveredLineIndex !== null"
                class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs z-30 pointer-events-none flex items-center gap-3 transition-all"
                :style="{ left: `${(lineDataPoints[hoveredLineIndex].cx / 800) * 100}%` }"
              >
                <span class="font-bold border-r border-slate-700 pr-2.5 text-slate-300">{{ lineDataPoints[hoveredLineIndex].date }}</span>
                <span class="text-slate-300 font-bold">Opened: {{ lineDataPoints[hoveredLineIndex].opened }}</span>
                <span class="text-emerald-400 font-bold">Closed: {{ lineDataPoints[hoveredLineIndex].closed }}</span>
              </div>

              <svg class="w-full h-full overflow-hidden" viewBox="0 0 800 210" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="openedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1e293b" stop-opacity="0.15" />
                    <stop offset="100%" stop-color="#1e293b" stop-opacity="0.0" />
                  </linearGradient>
                  <linearGradient id="closedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                  </linearGradient>
                </defs>

                <!-- Grid Horizontal Lines -->
                <line x1="0" y1="40" x2="800" y2="40" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="90" x2="800" y2="90" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="140" x2="800" y2="140" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="190" x2="800" y2="190" stroke="#f1f5f9" stroke-width="1" />

                <!-- Vertical Hover Guideline -->
                <line
                  v-if="hoveredLineIndex !== null"
                  :x1="lineDataPoints[hoveredLineIndex].cx"
                  y1="20"
                  :x2="lineDataPoints[hoveredLineIndex].cx"
                  y2="190"
                  stroke="#10b981"
                  stroke-width="1.5"
                  stroke-dasharray="4 4"
                />

                <!-- Area Fills -->
                <path d="M 0 190 Q 200 60 400 90 T 800 50 L 800 190 L 0 190 Z" fill="url(#openedGradient)" />
                <path d="M 0 190 Q 200 100 400 120 T 800 95 L 800 190 L 0 190 Z" fill="url(#closedGradient)" />

                <!-- Spline Stroke Lines -->
                <path d="M 0 190 Q 200 60 400 90 T 800 50" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />
                <path d="M 0 190 Q 200 100 400 120 T 800 95" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" />

                <!-- Interactive Data Dots -->
                <circle
                  v-for="(pt, idx) in lineDataPoints"
                  :key="idx"
                  :cx="pt.cx"
                  :cy="pt.cyOpened"
                  :r="hoveredLineIndex === idx ? 7 : 4.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  stroke-width="2"
                  class="cursor-pointer transition-all duration-150"
                  @mouseenter="hoveredLineIndex = idx"
                  @mouseleave="hoveredLineIndex = null"
                />
              </svg>
            </div>
          </div>

          <!-- X-Axis Labels -->
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span v-for="label in chartDates" :key="label">{{ label }}</span>
          </div>
        </div>

        <!-- CHART CARD 2: Tickets by Priority (Interactive Stacked Bar) -->
        <div class="bg-white rounded-2xl p-6 pb-4 border border-slate-200/70 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
          <div>
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-xs font-bold tracking-wider text-slate-600 uppercase">Tickets by Priority</h3>
              <span class="px-3 py-1 text-xs text-slate-600 font-bold bg-slate-100 rounded-lg border border-slate-200/60">Interactive Bar</span>
            </div>

            <!-- Interactive Legend -->
            <div class="flex items-center gap-6 mb-4 text-xs font-bold text-slate-700">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 bg-[#16a34a] rounded-xs"></span>
                <span>High / Urgent</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 bg-slate-800 rounded-xs"></span>
                <span>Normal / Low</span>
              </div>
            </div>

            <!-- INTERACTIVE BAR CHART WITH TOOLTIP -->
            <div class="w-full h-[240px] flex items-end justify-between gap-2.5 pt-4 relative">
              <!-- Floating Hover Tooltip for Bars -->
              <div
                v-if="hoveredBarIndex !== null"
                class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs z-30 pointer-events-none flex items-center gap-3 transition-all"
              >
                <span class="font-bold border-r border-slate-700 pr-2 text-slate-300">{{ barChartData[hoveredBarIndex].date }}</span>
                <span class="text-emerald-400 font-bold">High/Urgent: {{ barChartData[hoveredBarIndex].high }}</span>
                <span class="text-slate-300 font-bold">Normal/Low: {{ barChartData[hoveredBarIndex].low }}</span>
              </div>

              <div
                v-for="(bar, index) in barChartData"
                :key="index"
                class="flex-1 flex flex-col items-center gap-0.5 group cursor-pointer transition-transform hover:scale-105"
                @mouseenter="hoveredBarIndex = index"
                @mouseleave="hoveredBarIndex = null"
              >
                <!-- Emerald Stack (High/Urgent) -->
                <div
                  class="w-full bg-[#16a34a] rounded-t-xs transition-all duration-200 group-hover:bg-[#15803d] group-hover:shadow-md"
                  :style="{ height: `${bar.high}px` }"
                ></div>
                <!-- Dark Slate Stack (Normal/Low) -->
                <div
                  class="w-full bg-slate-800 rounded-b-xs transition-all duration-200 group-hover:bg-slate-900"
                  :style="{ height: `${bar.low}px` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- X-Axis Labels -->
          <div class="flex items-center justify-between text-xs font-semibold text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span v-for="label in chartDates" :key="label">{{ label }}</span>
          </div>
        </div>
      </div>

      <!-- ROW 4: INTERACTIVE ACTIVITY STREAM FEED WIDGET -->
      <div class="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-xs hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold tracking-wider text-slate-800 uppercase">Activity Stream</h3>
              <p class="text-xs text-slate-500 font-medium">Live system activity events</p>
            </div>
          </div>
          <button
            type="button"
            class="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            @click="fetchActivityStream"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Refresh Stream</span>
          </button>
        </div>

        <div v-if="activityStreamLoading" class="p-8 text-center text-xs text-slate-400 font-medium">
          Loading activity stream records...
        </div>

        <div v-else-if="activityStream.length === 0" class="p-8 text-center text-xs text-slate-400 font-medium">
          No activity stream records found.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            v-for="item in activityStream"
            :key="item.id"
            :href="item.object === 'Ticket' || item.object === 'Ticket::Article' ? `/#ticket/zoom/${item.o_id}` : '#'"
            class="p-4 rounded-xl border border-slate-200/60 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex items-start gap-3 bg-slate-50/40 hover:bg-white cursor-pointer hover:-translate-y-0.5"
          >
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 shadow-xs"
            >
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
                <p class="text-xs font-bold text-slate-900 truncate">{{ getActivityTitle(item) }}</p>
                <span class="text-[10px] text-slate-400 font-medium shrink-0">{{ formatRelativeTime(item.created_at) }}</span>
              </div>
              <p class="text-xs text-slate-500 line-clamp-2 mt-1 font-medium">{{ getActivityDescription(item) }}</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  </LayoutMain>
</template>

<style scoped>
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
