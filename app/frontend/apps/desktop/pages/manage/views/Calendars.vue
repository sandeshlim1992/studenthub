<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface CalendarItem {
  id: number
  name: string
  timezone: string
  default?: boolean
  business_hours?: Record<string, { active: boolean; time_start: string; time_end: string }>
  ical_url?: string
  public_holidays?: Record<string, { name: string; date: string }>
  updated_at?: string
  created_at?: string
}

const router = useRouter()
const calendars = ref<CalendarItem[]>([])
const timezonesList = ref<{ value: string; name: string }[]>([])
const isLoading = ref(true)
const errorText = ref('')
const searchQuery = ref('')
const activeActionMenuId = ref<number | null>(null)

// Drawer / Form state
const showDrawer = ref(false)
const drawerTitle = ref('')
const submitting = ref(false)

const DAYS_OF_WEEK = [
  { key: 'mon', label: __('Monday') },
  { key: 'tue', label: __('Tuesday') },
  { key: 'wed', label: __('Wednesday') },
  { key: 'thu', label: __('Thursday') },
  { key: 'fri', label: __('Friday') },
  { key: 'sat', label: __('Saturday') },
  { key: 'sun', label: __('Sunday') },
]

interface DayHours {
  active: boolean
  time_start: string
  time_end: string
}

const defaultFormState = () => {
  const business_hours: Record<string, DayHours> = {}
  for (const day of DAYS_OF_WEEK) {
    business_hours[day.key] = {
      active: ['mon', 'tue', 'wed', 'thu', 'fri'].includes(day.key),
      time_start: '08:00',
      time_end: '17:00',
    }
  }

  return {
    id: null as number | null,
    name: '',
    timezone: 'UTC',
    default: false,
    ical_url: '',
    business_hours,
  }
}

const formState = ref(defaultFormState())

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Calendars') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

const toggleActionMenu = (id: number, event: Event) => {
  event.stopPropagation()
  activeActionMenuId.value = activeActionMenuId.value === id ? null : id
}

const closeActionMenu = () => {
  activeActionMenuId.value = null
}

const fetchCalendars = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    const res = await fetch('/api/v1/calendars', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        calendars.value = data.sort((a, b) => a.name.localeCompare(b.name))
      } else {
        errorText.value = __('Received invalid format from server.')
      }
    } else if (res.status === 403) {
      errorText.value = __('Forbidden: You do not have permission to manage calendars.')
    } else {
      errorText.value = `Failed to load calendars (Status: ${res.status})`
    }
  } catch (e) {
    console.error('Failed to fetch calendars:', e)
    errorText.value = __('Error fetching calendars. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const fetchTimezones = async () => {
  try {
    const res = await fetch('/api/v1/calendars/timezones', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.timezones) {
        if (Array.isArray(data.timezones)) {
          timezonesList.value = data.timezones.map((tz: string | { value: string; name: string }) =>
            typeof tz === 'string' ? { value: tz, name: tz } : tz
          )
        } else if (typeof data.timezones === 'object') {
          timezonesList.value = Object.entries(data.timezones).map(([val, name]) => ({
            value: val,
            name: String(name),
          }))
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch timezones:', e)
  }
}

const filteredCalendars = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return calendars.value
  return calendars.value.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      (c.timezone && c.timezone.toLowerCase().includes(query))
  )
})

const handleNewCalendar = () => {
  formState.value = defaultFormState()
  drawerTitle.value = __('New Calendar')
  showDrawer.value = true
}

const handleEditCalendar = (cal: CalendarItem) => {
  const defaultState = defaultFormState()
  const mergedHours: Record<string, DayHours> = { ...defaultState.business_hours }

  if (cal.business_hours) {
    for (const [dayKey, dayVal] of Object.entries(cal.business_hours)) {
      if (mergedHours[dayKey]) {
        mergedHours[dayKey] = {
          active: dayVal.active !== false,
          time_start: dayVal.time_start || '08:00',
          time_end: dayVal.time_end || '17:00',
        }
      }
    }
  }

  formState.value = {
    id: cal.id,
    name: cal.name || '',
    timezone: cal.timezone || 'UTC',
    default: Boolean(cal.default),
    ical_url: cal.ical_url || '',
    business_hours: mergedHours,
  }
  drawerTitle.value = __('Edit Calendar')
  showDrawer.value = true
}

const saveCalendar = async () => {
  if (!formState.value.name.trim()) {
    alert(__('Name is required.'))
    return
  }

  submitting.value = true
  try {
    const payload = {
      name: formState.value.name,
      timezone: formState.value.timezone,
      default: formState.value.default,
      ical_url: formState.value.ical_url,
      business_hours: formState.value.business_hours,
    }

    const isEdit = formState.value.id !== null
    const url = isEdit ? `/api/v1/calendars/${formState.value.id}` : '/api/v1/calendars'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      showDrawer.value = false
      fetchCalendars()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to save calendar.'))
    }
  } catch (e) {
    console.error('Failed to save calendar:', e)
  } finally {
    submitting.value = false
  }
}

const handleDeleteCalendar = async (id: number, name: string) => {
  if (!confirm(`Are you sure you want to delete calendar "${name}"?`)) return
  try {
    const res = await fetch(`/api/v1/calendars/${id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      fetchCalendars()
    } else {
      const data = await res.json()
      alert(data.error || __('Failed to delete calendar.'))
    }
  } catch (e) {
    console.error('Failed to delete calendar:', e)
  }
}

const toggleDefaultState = async (cal: CalendarItem) => {
  if (cal.default) return // Already default
  try {
    const res = await fetch(`/api/v1/calendars/${cal.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ default: true }),
    })
    if (res.ok) {
      fetchCalendars()
    }
  } catch (e) {
    console.error('Failed to set default calendar:', e)
  }
}

onMounted(() => {
  fetchCalendars()
  fetchTimezones()
  window.addEventListener('click', closeActionMenu)
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100" @click="closeActionMenu">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <button
            @click="router.push('/manage')"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Calendars') }}
            <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{{ __('Management') }}</span>
          </h1>
        </div>
        <button
          @click="handleNewCalendar"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer"
        >
          {{ __('New Calendar') }}
        </button>
      </div>

      <!-- Search -->
      <div class="mb-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search for calendars')"
            class="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th class="py-4 px-6">{{ __('Name') }}</th>
              <th class="py-4 px-6">{{ __('Time zone') }}</th>
              <th class="py-4 px-6 text-center w-28">{{ __('Standard') }}</th>
              <th class="py-4 px-6 text-right w-16"></th>
            </tr>
          </thead>

          <!-- Loading Skeleton -->
          <tbody v-if="isLoading" class="divide-y divide-slate-100 dark:divide-slate-800/60">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36"></div></td>
              <td class="py-4 px-6"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48"></div></td>
              <td class="py-4 px-6 text-center"><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded-full w-4 mx-auto"></div></td>
              <td class="py-4 px-6"></td>
            </tr>
          </tbody>

          <!-- Error -->
          <tbody v-else-if="errorText">
            <tr>
              <td colspan="4" class="py-12 text-center text-red-500">
                <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="exclamation-triangle" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold">{{ errorText }}</h3>
              </td>
            </tr>
          </tbody>

          <!-- Empty -->
          <tbody v-else-if="filteredCalendars.length === 0">
            <tr>
              <td colspan="4" class="py-12 text-center text-slate-500 dark:text-slate-400">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <CommonIcon name="calendar" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold mb-1">{{ __('No calendars found') }}</h3>
                <p class="text-xs">{{ __('No calendars matched the selected search criteria.') }}</p>
              </td>
            </tr>
          </tbody>

          <!-- Data rows -->
          <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            <tr
              v-for="cal in filteredCalendars"
              :key="cal.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
              @click="handleEditCalendar(cal)"
            >
              <!-- Name -->
              <td class="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                {{ cal.name }}
              </td>
              <!-- Timezone -->
              <td class="py-4 px-6 text-sm text-slate-500 dark:text-slate-400 font-mono text-xs">
                {{ cal.timezone }}
              </td>
              <!-- Standard / Default -->
              <td class="py-4 px-6 text-center" @click.stop>
                <button
                  @click="toggleDefaultState(cal)"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
                  :class="cal.default ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                >
                  <CommonIcon name="check2" class="w-4 h-4" />
                </button>
              </td>
              <!-- Actions -->
              <td class="py-4 px-6 text-right relative" @click.stop>
                <button
                  @click="toggleActionMenu(cal.id, $event)"
                  class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CommonIcon name="three-dots-vertical" class="w-4 h-4" />
                </button>
                <div
                  v-if="activeActionMenuId === cal.id"
                  class="absolute right-6 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-20 overflow-hidden text-left"
                  @click.stop
                >
                  <div class="py-1.5">
                    <button
                      @click="handleEditCalendar(cal)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <CommonIcon name="pencil" class="w-3.5 h-3.5 mr-2.5 text-slate-400" />{{ __('Edit') }}
                    </button>
                    <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      @click="handleDeleteCalendar(cal.id, cal.name)"
                      class="flex w-full items-center px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <CommonIcon name="trash3" class="w-3.5 h-3.5 mr-2.5 text-red-400" />{{ __('Delete') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>

  <!-- Drawer -->
  <Teleport to="body">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end"
      @click="showDrawer = false"
    >
      <div
        class="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="calendar" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ drawerTitle }}</h2>
          </div>
          <button
            @click="showDrawer = false"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Description Box -->
          <div class="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {{ __('A calendar is needed to calculate escalations based on business hours and send out escalation notifications.') }}
          </div>

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formState.name"
              type="text"
              maxlength="100"
              :placeholder="__('Name of the calendar')"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <!-- Timezone -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Time zone') }} <span class="text-red-500">*</span>
            </label>
            <select
              v-model="formState.timezone"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option v-for="tz in timezonesList" :key="tz.value" :value="tz.value">
                {{ tz.name }}
              </option>
            </select>
          </div>

          <!-- Business Hours -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              {{ __('Business Hours') }}
            </label>
            <div class="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div
                v-for="day in DAYS_OF_WEEK"
                :key="day.key"
                class="flex items-center justify-between gap-3 py-1 text-xs"
              >
                <label class="flex items-center gap-2 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="formState.business_hours[day.key].active"
                    class="rounded text-blue-600"
                  />
                  <span class="font-medium text-slate-800 dark:text-slate-200">{{ day.label }}</span>
                </label>

                <div v-if="formState.business_hours[day.key].active" class="flex items-center gap-2 font-mono">
                  <input
                    v-model="formState.business_hours[day.key].time_start"
                    type="time"
                    class="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200"
                  />
                  <span class="text-slate-400">-</span>
                  <input
                    v-model="formState.business_hours[day.key].time_end"
                    type="time"
                    class="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <span v-else class="text-slate-400 italic text-[11px]">{{ __('Off') }}</span>
              </div>
            </div>
          </div>

          <!-- Holidays iCalendar Feed -->
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Holidays iCalendar Feed') }}
            </label>
            <input
              v-model="formState.ical_url"
              type="url"
              placeholder="http://example.com/public_holidays.ical"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
            />
          </div>

          <!-- Standard Calendar Switch -->
          <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {{ __('Standard Calendar') }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ __('Set as system-wide default calendar.') }}</p>
            </div>
            <button
              @click="formState.default = !formState.default"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="formState.default ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="formState.default ? 'translate-x-5' : 'translate-x-0'"
              ></span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            @click="showDrawer = false"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
          >
            {{ __('Cancel') }}
          </button>
          <button
            @click="saveCalendar"
            :disabled="submitting"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center min-w-20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="submitting">{{ __('Saving...') }}</span>
            <span v-else>{{ __('Save') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
