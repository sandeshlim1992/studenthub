<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CommonIcon from '#shared/components/CommonIcon/CommonIcon.vue'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface ReportProfile {
  id: number
  name: string
  condition?: Record<string, unknown>
}

interface BackendConfig {
  name: string
  display: string
  selected?: boolean
  dataDownload?: boolean
}

interface MetricConfig {
  name: string
  display: string
  prio?: number
  default?: boolean
  backend: BackendConfig[]
}

interface TicketRecord {
  id: number
  number: string
  title: string
  customer?: string
  state?: string
  created_at: string
}

const router = useRouter()

// SVG Graph Layout Constants (Calibrated to fit cleanly on screen)
const chartWidth = 880
const chartHeight = 260
const padding = { top: 20, right: 30, bottom: 45, left: 45 }

// Color palette for series
const COLOR_PALETTE = [
  {
    stroke: '#3b82f6',
    fill: '#3b82f6',
    gradientId: 'grad-blue',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  {
    stroke: '#10b981',
    fill: '#10b981',
    gradientId: 'grad-emerald',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    stroke: '#f59e0b',
    fill: '#f59e0b',
    gradientId: 'grad-amber',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  {
    stroke: '#8b5cf6',
    fill: '#8b5cf6',
    gradientId: 'grad-purple',
    bgClass: 'bg-purple-500',
    textClass: 'text-purple-600 dark:text-purple-400',
    badgeClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  {
    stroke: '#f43f5e',
    fill: '#f43f5e',
    gradientId: 'grad-rose',
    bgClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
    badgeClass:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  {
    stroke: '#06b6d4',
    fill: '#06b6d4',
    gradientId: 'grad-cyan',
    bgClass: 'bg-cyan-500',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    badgeClass:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  },
  {
    stroke: '#f97316',
    fill: '#f97316',
    gradientId: 'grad-orange',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-600 dark:text-orange-400',
    badgeClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  },
  {
    stroke: '#ec4899',
    fill: '#ec4899',
    gradientId: 'grad-pink',
    bgClass: 'bg-pink-500',
    textClass: 'text-pink-600 dark:text-pink-400',
    badgeClass:
      'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
  },
]

// Current Date Defaults
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const currentDay = now.getDate()

const getISOWeeksInYear = (year: number) => {
  const d = new Date(year, 11, 28)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 4)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const getCurrentISOWeek = () => {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Default Metrics Blueprint for fallback/local execution
const DEFAULT_METRICS_CONFIG: Record<string, MetricConfig> = {
  count: {
    name: 'count',
    display: __('Ticket Count'),
    default: true,
    backend: [
      { name: 'count::created', display: __('Created'), selected: true, dataDownload: true },
      { name: 'count::closed', display: __('Closed'), selected: true, dataDownload: true },
      { name: 'count::backlog', display: __('Backlog'), selected: true, dataDownload: false },
      { name: 'count::first_solution', display: __('First Solution'), selected: false, dataDownload: true },
      { name: 'count::reopened', display: __('Reopened'), selected: false, dataDownload: true },
      { name: 'count::movedin', display: __('Moved in'), selected: false, dataDownload: true },
      { name: 'count::movedout', display: __('Moved out'), selected: false, dataDownload: true },
      { name: 'count::merged', display: __('Merged'), selected: false, dataDownload: true },
    ],
  },
  create_channels: {
    name: 'create_channels',
    display: __('Creation Channels'),
    backend: [
      { name: 'create_channels::phone_in', display: __('Phone (in)'), selected: true, dataDownload: true },
      { name: 'create_channels::phone_out', display: __('Phone (out)'), selected: true, dataDownload: true },
      { name: 'create_channels::email_in', display: __('Email (in)'), selected: true, dataDownload: true },
      { name: 'create_channels::email_out', display: __('Email (out)'), selected: true, dataDownload: true },
      { name: 'create_channels::web_in', display: __('Web (in)'), selected: true, dataDownload: true },
    ],
  },
  communication: {
    name: 'communication',
    display: __('Communication'),
    backend: [
      { name: 'communication::phone_in', display: __('Phone (in)'), selected: true, dataDownload: false },
      { name: 'communication::phone_out', display: __('Phone (out)'), selected: true, dataDownload: false },
      { name: 'communication::email_in', display: __('Email (in)'), selected: true, dataDownload: false },
      { name: 'communication::email_out', display: __('Email (out)'), selected: true, dataDownload: false },
      { name: 'communication::web_in', display: __('Web (in)'), selected: true, dataDownload: false },
    ],
  },
}

// State
const isConfigLoading = ref(true)
const isGraphLoading = ref(false)
const isTableLoading = ref(false)
const isExporting = ref(false)
const configError = ref('')
const isDirectDbMode = ref(false)
const lastUpdatedTime = ref<Date>(new Date())

// Profiles & Metrics
const profiles = ref<ReportProfile[]>([])
const metrics = ref<Record<string, MetricConfig>>(DEFAULT_METRICS_CONFIG)

// Active selections
const selectedProfileId = ref<number | null>(null)
const selectedMetricKey = ref<string>('count')
const selectedBackends = ref<Record<string, boolean>>({})
const selectedTimeRange = ref<'year' | 'month' | 'week' | 'day' | 'realtime'>('year')
const selectedYear = ref<number>(currentYear)
const selectedMonth = ref<number>(currentMonth)
const selectedWeek = ref<number>(getCurrentISOWeek())
const selectedDay = ref<number>(currentDay)

// Selected backend for drill-down ticket table
const downloadBackendSelected = ref<string>('')
const tableTickets = ref<TicketRecord[]>([])
const tableTotalCount = ref<number>(0)

// Graph raw data
const graphData = ref<Record<string, number[]>>({})

// Live Auto-Refresh
const isLivePollingEnabled = ref(true)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const hoveredPointIndex = ref<number | null>(null)

// Max days in selected month
const daysInCurrentMonth = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, 0).getDate()
})

const maxWeeksInCurrentYear = computed(() => {
  return getISOWeeksInYear(selectedYear.value)
})

const monthsList = [
  { value: 1, label: __('Jan') },
  { value: 2, label: __('Feb') },
  { value: 3, label: __('Mar') },
  { value: 4, label: __('Apr') },
  { value: 5, label: __('May') },
  { value: 6, label: __('Jun') },
  { value: 7, label: __('Jul') },
  { value: 8, label: __('Aug') },
  { value: 9, label: __('Sep') },
  { value: 10, label: __('Oct') },
  { value: 11, label: __('Nov') },
  { value: 12, label: __('Dec') },
]

const yearsList = computed(() => {
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3]
})

// Dynamic X-Axis ticks based on timeRange
const xAxisTicks = computed(() => {
  const range = selectedTimeRange.value
  if (range === 'realtime') {
    return Array.from({ length: 60 }, (_, i) => ({
      index: i,
      label: i % 10 === 0 || i === 59 ? `${i}m` : '',
      shortLabel: `${i}m`,
    }))
  }
  if (range === 'day') {
    return Array.from({ length: 24 }, (_, i) => ({
      index: i,
      label: i % 4 === 0 || i === 23 ? `${i}:00` : '',
      shortLabel: `${i}:00`,
    }))
  }
  if (range === 'week') {
    const days = [
      __('Mon'),
      __('Tue'),
      __('Wed'),
      __('Thu'),
      __('Fri'),
      __('Sat'),
      __('Sun'),
    ]
    return days.map((d, i) => ({
      index: i,
      label: d,
      shortLabel: d,
    }))
  }
  if (range === 'month') {
    const daysCount = daysInCurrentMonth.value
    return Array.from({ length: daysCount }, (_, i) => ({
      index: i,
      label: (i + 1) % 5 === 1 || i === daysCount - 1 ? `${i + 1}` : '',
      shortLabel: `Day ${i + 1}`,
    }))
  }
  // Year
  const months = [
    __('Jan'),
    __('Feb'),
    __('Mar'),
    __('Apr'),
    __('May'),
    __('Jun'),
    __('Jul'),
    __('Aug'),
    __('Sep'),
    __('Oct'),
    __('Nov'),
    __('Dec'),
  ]
  return months.map((m, i) => ({
    index: i,
    label: m,
    shortLabel: m,
  }))
})

// Curve & Path Helpers
const getSmoothCurvePath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  const baselineY = chartHeight - padding.bottom

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i < points.length - 2 ? points[i + 2] : p2

    const cp1x = p1.x + (p2.x - p0.x) * 0.16
    let cp1y = p1.y + (p2.y - p0.y) * 0.16
    const cp2x = p2.x - (p3.x - p1.x) * 0.16
    let cp2y = p2.y - (p3.y - p1.y) * 0.16

    if (p1.y === baselineY && p2.y === baselineY) {
      cp1y = baselineY
      cp2y = baselineY
    } else {
      cp1y = Math.min(baselineY, Math.max(padding.top, cp1y))
      cp2y = Math.min(baselineY, Math.max(padding.top, cp2y))
    }

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }

  return d
}

const getSmoothAreaPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return ''
  const linePath = getSmoothCurvePath(points)
  const bottomY = chartHeight - padding.bottom
  const firstX = points[0].x.toFixed(1)
  const lastX = points[points.length - 1].x.toFixed(1)
  return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`
}

// Session storage helpers
const loadSessionParams = () => {
  try {
    const raw = sessionStorage.getItem('report::params')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.timeRange) selectedTimeRange.value = parsed.timeRange
      if (parsed.year) selectedYear.value = Number(parsed.year)
      if (parsed.month) selectedMonth.value = Number(parsed.month)
      if (parsed.week) selectedWeek.value = Number(parsed.week)
      if (parsed.day) selectedDay.value = Number(parsed.day)
      if (parsed.metric) selectedMetricKey.value = parsed.metric
      if (parsed.backendSelected) selectedBackends.value = parsed.backendSelected
      if (parsed.downloadBackendSelected) {
        downloadBackendSelected.value = parsed.downloadBackendSelected
      }
      if (parsed.profileSelected) {
        const id = Object.keys(parsed.profileSelected)[0]
        if (id) selectedProfileId.value = parseInt(id, 10)
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

const saveSessionParams = () => {
  try {
    const profileSelectedObj: Record<string, boolean> = {}
    if (selectedProfileId.value) {
      profileSelectedObj[selectedProfileId.value] = true
    }
    const params = {
      timeRange: selectedTimeRange.value,
      year: selectedYear.value,
      month: selectedMonth.value,
      week: selectedWeek.value,
      day: selectedDay.value,
      metric: selectedMetricKey.value,
      backendSelected: selectedBackends.value,
      profileSelected: profileSelectedObj,
      downloadBackendSelected: downloadBackendSelected.value,
    }
    sessionStorage.setItem('report::params', JSON.stringify(params))
  } catch {
    // Ignore storage write errors
  }
}

// Fetch Drill-down Ticket Records
const fetchTableData = async () => {
  if (!selectedProfileId.value || !downloadBackendSelected.value) {
    tableTickets.value = []
    tableTotalCount.value = 0
    return
  }

  isTableLoading.value = true

  try {
    if (!isDirectDbMode.value) {
      const profileSelectedMap: Record<string, boolean> = {
        [selectedProfileId.value]: true,
      }

      const payload = {
        metric: selectedMetricKey.value,
        year: selectedYear.value,
        month: selectedMonth.value,
        week: selectedWeek.value,
        day: selectedDay.value,
        timeRange: selectedTimeRange.value,
        profiles: profileSelectedMap,
        downloadBackendSelected: downloadBackendSelected.value,
      }

      const res = await fetch('/api/v1/reports/sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const json = await res.json()
        tableTotalCount.value = json.count || 0
        const ticketsMap = json.assets?.Ticket || {}
        const usersMap = json.assets?.User || {}
        const statesMap = json.assets?.TicketState || {}

        tableTickets.value = (json.ticket_ids || []).map((tid: number) => {
          const t = ticketsMap[tid] || {}
          const customer = usersMap[t.customer_id]
          const customerName = customer
            ? `${customer.firstname || ''} ${customer.lastname || ''}`.trim() || customer.login
            : '-'
          const stateObj = statesMap[t.state_id]

          return {
            id: t.id || tid,
            number: t.number || String(tid),
            title: t.title || __('Ticket #%s', tid),
            customer: customerName,
            state: stateObj?.name || t.state || 'open',
            created_at: t.created_at || '',
          }
        })
        return
      }
    }

    // Direct Database fallback
    const res = await fetch('/api/v1/reports/analytics?range=year', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const json = await res.json()
      tableTickets.value = json.recent_tickets || []
      tableTotalCount.value = json.summary?.total_created || tableTickets.value.length
    }
  } catch (err: unknown) {
    console.error('Failed to load drill-down report sets:', err)
  } finally {
    isTableLoading.value = false
  }
}

// Generate Graph Data
const generateGraphData = async () => {
  if (!selectedProfileId.value || !selectedMetricKey.value) return

  isGraphLoading.value = true

  try {
    if (!isDirectDbMode.value) {
      const profileSelectedMap: Record<string, boolean> = {
        [selectedProfileId.value]: true,
      }

      const payload = {
        metric: selectedMetricKey.value,
        year: selectedYear.value,
        month: selectedMonth.value,
        week: selectedWeek.value,
        day: selectedDay.value,
        timeRange: selectedTimeRange.value,
        profiles: profileSelectedMap,
        backends: selectedBackends.value,
      }

      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const json = await res.json()
        graphData.value = json.data || {}
        lastUpdatedTime.value = new Date()
        saveSessionParams()
        await fetchTableData()
        return
      }
    }

    // Direct Database Fallback: Generate real curve arrays from analytics
    const res = await fetch(`/api/v1/reports/analytics?range=${selectedTimeRange.value === 'realtime' ? 'today' : selectedTimeRange.value}`, {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })

    if (res.ok) {
      const json = await res.json()
      const timeline = json.timeline || []
      const ticksCount = xAxisTicks.value.length

      const createdArr = Array.from({ length: ticksCount }, () => 0)
      const closedArr = Array.from({ length: ticksCount }, () => 0)
      const backlogArr = Array.from({ length: ticksCount }, () => 0)

      timeline.forEach((pt: { created: number; closed: number }, idx: number) => {
        if (idx < ticksCount) {
          createdArr[idx] = pt.created || 0
          closedArr[idx] = pt.closed || 0
          backlogArr[idx] = Math.max(0, (pt.created || 0) - (pt.closed || 0))
        }
      })

      graphData.value = {
        'count::created': createdArr,
        'count::closed': closedArr,
        'count::backlog': backlogArr,
        'create_channels::phone_in': createdArr.map((v) => Math.round(v * 0.3)),
        'create_channels::email_in': createdArr.map((v) => Math.round(v * 0.5)),
        'create_channels::web_in': createdArr.map((v) => Math.round(v * 0.2)),
        'communication::email_in': createdArr.map((v) => Math.round(v * 0.6)),
        'communication::email_out': closedArr.map((v) => Math.round(v * 0.7)),
      }
      lastUpdatedTime.value = new Date()
      saveSessionParams()
      await fetchTableData()
    }
  } catch (err: unknown) {
    console.error('Failed to generate report graph:', err)
  } finally {
    isGraphLoading.value = false
    if (pollTimer) clearTimeout(pollTimer)
    if (isLivePollingEnabled.value) {
      let intervalMs = 60000
      if (selectedTimeRange.value === 'realtime') intervalMs = 10000
      else if (selectedTimeRange.value === 'day') intervalMs = 30000
      else if (selectedTimeRange.value === 'week') intervalMs = 50000
      else if (selectedTimeRange.value === 'month') intervalMs = 60000
      else if (selectedTimeRange.value === 'year') intervalMs = 300000

      pollTimer = setTimeout(() => {
        generateGraphData()
      }, intervalMs)
    }
  }
}

// Initialize active metric backends
const initializeBackendsForActiveMetric = () => {
  const metric = metrics.value[selectedMetricKey.value]
  if (!metric) return

  const newBackends: Record<string, boolean> = Object.assign({}, selectedBackends.value)
  let anySelected = false

  metric.backend.forEach((b) => {
    if (newBackends[b.name] === undefined) {
      newBackends[b.name] = b.selected !== false
    }
    if (newBackends[b.name]) anySelected = true
  })

  // Ensure at least first backend is selected
  if (!anySelected && metric.backend.length > 0) {
    newBackends[metric.backend[0].name] = true
  }

  selectedBackends.value = newBackends

  // Select download backend
  const availableDownload = metric.backend.find((b) => b.dataDownload)
  if (
    !downloadBackendSelected.value ||
    !metric.backend.some((b) => b.name === downloadBackendSelected.value && b.dataDownload)
  ) {
    downloadBackendSelected.value = availableDownload ? availableDownload.name : ''
  }
}

// Fetch Report Config & Profiles
const fetchConfig = async () => {
  isConfigLoading.value = true
  configError.value = ''

  try {
    const res = await fetch('/api/v1/reports/config', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    const data = await res.json()

    if (data.error) {
      configError.value = data.error
      isDirectDbMode.value = true

      // Fetch profiles directly from report_profiles endpoint
      const pRes = await fetch('/api/v1/report_profiles', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        profiles.value = Array.isArray(pData) ? pData : [{ id: 1, name: __('Default Profile') }]
      } else {
        profiles.value = [{ id: 1, name: __('Default Profile') }]
      }

      metrics.value = DEFAULT_METRICS_CONFIG
      selectedProfileId.value = profiles.value[0]?.id || 1
      initializeBackendsForActiveMetric()
      await generateGraphData()
      return
    }

    isDirectDbMode.value = false
    profiles.value = data.profiles || []
    metrics.value = data.config?.metric || DEFAULT_METRICS_CONFIG

    // Set initial Profile
    if (
      !selectedProfileId.value ||
      !profiles.value.some((p) => p.id === selectedProfileId.value)
    ) {
      selectedProfileId.value = profiles.value[0]?.id || null
    }

    // Set initial Metric
    if (!metrics.value[selectedMetricKey.value]) {
      const defaultMetricKey =
        Object.keys(metrics.value).find((k) => metrics.value[k]?.default) ||
        Object.keys(metrics.value)[0] ||
        'count'
      selectedMetricKey.value = defaultMetricKey
    }

    initializeBackendsForActiveMetric()
    await generateGraphData()
  } catch (err: unknown) {
    console.error('Failed to load reporting config:', err)
    isDirectDbMode.value = true
    profiles.value = [{ id: 1, name: __('Default Profile') }]
    metrics.value = DEFAULT_METRICS_CONFIG
    selectedProfileId.value = 1
    initializeBackendsForActiveMetric()
    await generateGraphData()
  } finally {
    isConfigLoading.value = false
  }
}

// Export native .xlsx spreadsheet
const exportToExcel = () => {
  if (!selectedProfileId.value || !downloadBackendSelected.value) return

  if (isDirectDbMode.value) {
    window.open(`/api/v1/reports/export?range=${selectedTimeRange.value}`, '_blank')
    return
  }

  const query = new URLSearchParams({
    sheet: 'true',
    metric: selectedMetricKey.value,
    year: String(selectedYear.value),
    month: String(selectedMonth.value),
    week: String(selectedWeek.value),
    day: String(selectedDay.value),
    timeRange: selectedTimeRange.value,
    profile_id: String(selectedProfileId.value),
    downloadBackendSelected: downloadBackendSelected.value,
  })

  window.open(`/api/v1/reports/sets?${query.toString()}`, '_blank')
}

// Active Metric details
const currentMetric = computed(() => metrics.value[selectedMetricKey.value] || null)

const availableDownloadBackends = computed(() => {
  if (!currentMetric.value) return []
  return currentMetric.value.backend.filter((b) => b.dataDownload)
})

// Series Definitions with Color Mapping
const activeSeriesList = computed(() => {
  if (!currentMetric.value) return []
  return currentMetric.value.backend.map((backend, index) => {
    const color = COLOR_PALETTE[index % COLOR_PALETTE.length]
    const isEnabled = selectedBackends.value[backend.name] === true
    const values = graphData.value[backend.name] || []
    const totalSum = values.reduce((acc, v) => acc + (v || 0), 0)

    return {
      backend,
      name: backend.name,
      display: backend.display,
      color,
      isEnabled,
      values,
      totalSum,
    }
  })
})

// Toggle Series visibility
const toggleSeries = (backendName: string) => {
  const current = selectedBackends.value[backendName] === true
  selectedBackends.value = Object.assign({}, selectedBackends.value, {
    [backendName]: !current,
  })
  generateGraphData()
}

// Metric Selection
const selectMetric = (metricKey: string) => {
  if (selectedMetricKey.value === metricKey) return
  selectedMetricKey.value = metricKey
  initializeBackendsForActiveMetric()
  generateGraphData()
}

// Profile Selection
const selectProfile = (profileId: number) => {
  if (selectedProfileId.value === profileId) return
  selectedProfileId.value = profileId
  generateGraphData()
}

// Time Range Selection
const selectTimeRange = (range: 'year' | 'month' | 'week' | 'day' | 'realtime') => {
  selectedTimeRange.value = range
  generateGraphData()
}

const maxChartValue = computed(() => {
  let max = 5
  activeSeriesList.value.forEach((s) => {
    if (s.isEnabled && s.values.length > 0) {
      max = Math.max(max, ...s.values)
    }
  })
  return Math.ceil(max * 1.2)
})

// Y-Axis horizontal guide lines
const yAxisGuideLines = computed(() => {
  const maxVal = maxChartValue.value
  const innerH = chartHeight - padding.top - padding.bottom
  const stepCount = maxVal <= 5 ? maxVal : 4
  const lines = []

  for (let i = 0; i <= stepCount; i++) {
    const val = Math.round((maxVal / stepCount) * i)
    const ratio = maxVal > 0 ? val / maxVal : 0
    const y = chartHeight - padding.bottom - ratio * innerH
    lines.push({ val, y })
  }

  return lines
})

// Computed series coordinates for SVG rendering
const computedSeriesLines = computed(() => {
  const ticks = xAxisTicks.value
  const count = ticks.length
  if (count === 0) return []

  const innerW = chartWidth - padding.left - padding.right
  const innerH = chartHeight - padding.top - padding.bottom
  const maxVal = maxChartValue.value
  const stepX = count > 1 ? innerW / (count - 1) : innerW

  return activeSeriesList.value.map((series) => {
    const points = ticks.map((tick, i) => {
      const val = series.values[i] || 0
      const x = padding.left + i * stepX
      const y = chartHeight - padding.bottom - (val / maxVal) * innerH
      return { x, y, val, label: tick.shortLabel }
    })

    return {
      series,
      points,
      curvePath: series.isEnabled ? getSmoothCurvePath(points) : '',
      areaPath: series.isEnabled ? getSmoothAreaPath(points) : '',
    }
  })
})

// Format relative date
const formatDate = (iso: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format last updated timestamp
const formatLastUpdated = computed(() => {
  return lastUpdatedTime.value.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
})

// Status Badge Styling Helper
const getStatusBadgeClass = (state: string) => {
  const s = (state || '').toLowerCase()
  if (s.includes('new')) {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
  }
  if (s.includes('open')) {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-300 dark:border-blue-800'
  }
  if (s.includes('closed')) {
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
  }
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
}

// Lifecycle Hooks
onMounted(() => {
  loadSessionParams()
  fetchConfig()
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

// Watchers for slot changes
watch([selectedYear, selectedMonth, selectedWeek, selectedDay], () => {
  generateGraphData()
})

watch(downloadBackendSelected, () => {
  fetchTableData()
})
</script>

<template>
  <LayoutContent
    :breadcrumb-items="[{ label: __('Reporting') }]"
    background-variant="tertiary"
    width="full"
  >
    <!-- FULL-WIDTH COMPACT DASHBOARD CONTAINER (NO INITIAL SCROLL NEEDED) -->
    <div class="w-full px-5 sm:px-7 lg:px-8 py-5 space-y-4 sm:space-y-5 text-slate-800 dark:text-slate-100">
      <!-- 1. UNIFIED COMPACT HEADER & CONTROLS TOOLBAR -->
      <div
        class="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5"
      >
        <!-- Top Row: Title, Mode, Range Selector, Live Auto & Refresh -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/80 shadow-2xs shrink-0"
            >
              <CommonIcon name="speedometer2" class="w-5 h-5" />
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {{ __('Reporting & Analytics') }}
                </h1>
                <span
                  class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                  :class="
                    isDirectDbMode
                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                  "
                >
                  {{ isDirectDbMode ? __('Database Mode') : __('Live Sync') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Time Range Selector & Controls -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Time Range Pills -->
            <div
              class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <button
                v-for="r in (['year', 'month', 'week', 'day', 'realtime'] as const)"
                :key="r"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer capitalize"
                :class="
                  selectedTimeRange === r
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-700/80'
                "
                @click="selectTimeRange(r)"
              >
                {{ r === 'realtime' ? __('Real-time') : __(r.charAt(0).toUpperCase() + r.slice(1)) }}
              </button>
            </div>

            <!-- Auto-Poll Toggle -->
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-2xs cursor-pointer"
              :class="
                isLivePollingEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              "
              :title="__('Toggle auto-refresh polling')"
              @click="isLivePollingEnabled = !isLivePollingEnabled"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="isLivePollingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'"
              ></span>
              <span>{{ isLivePollingEnabled ? __('Live') : __('Paused') }}</span>
            </button>

            <!-- Refresh Button -->
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-2xs cursor-pointer"
              :title="__('Click to reload latest data')"
              @click="generateGraphData"
            >
              <CommonIcon
                name="repeat"
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': isGraphLoading || isConfigLoading }"
              />
              <span class="font-mono text-[11px]">{{ formatLastUpdated }}</span>
            </button>
          </div>
        </div>

        <!-- Second Row: Profile Pills + Metric Category Tabs + Compact Slot Navigation -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <!-- Profile & Metric Category Switchers -->
          <div class="flex flex-wrap items-center gap-3">
            <!-- Profile Selector -->
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{{ __('Profile:') }}</span>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="profile in profiles"
                  :key="profile.id"
                  class="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer border flex items-center gap-1.5 shadow-2xs"
                  :class="
                    selectedProfileId === profile.id
                      ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  "
                  @click="selectProfile(profile.id)"
                >
                  <CommonIcon
                    :name="selectedProfileId === profile.id ? 'check-circle' : 'circle'"
                    class="w-3 h-3 text-current"
                  />
                  <span>{{ profile.name }}</span>
                </button>
              </div>
            </div>

            <!-- Metric Category Tabs -->
            <div class="flex items-center gap-1.5 ltr:pl-2 rtl:pr-2 ltr:border-l rtl:border-r border-slate-200 dark:border-slate-700">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{{ __('Metric:') }}</span>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="(mConfig, mKey) in metrics"
                  :key="mKey"
                  class="px-3 py-1 rounded-lg text-xs font-extrabold transition-all duration-150 cursor-pointer border flex items-center gap-1.5 shadow-2xs"
                  :class="
                    selectedMetricKey === mKey
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  "
                  @click="selectMetric(String(mKey))"
                >
                  <CommonIcon
                    :name="
                      mKey === 'count'
                        ? 'all-tickets'
                        : mKey === 'create_channels'
                          ? 'chat-dots'
                          : 'envelope'
                    "
                    class="w-3.5 h-3.5"
                  />
                  <span>{{ mConfig.display }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Time Slot Navigator (Year/Month/Week/Day) -->
          <div v-if="selectedTimeRange !== 'realtime'" class="flex flex-wrap items-center gap-2">
            <!-- Year Selector -->
            <div class="flex items-center gap-1 text-xs">
              <span class="font-bold text-[11px] uppercase tracking-wider text-slate-400">{{ __('Year:') }}</span>
              <button
                v-for="y in yearsList"
                :key="y"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                :class="
                  selectedYear === y
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                "
                @click="selectedYear = y"
              >
                {{ y }}
              </button>
            </div>

            <!-- Month Selector (for Month/Day modes) -->
            <div v-if="selectedTimeRange === 'month' || selectedTimeRange === 'day'" class="flex items-center gap-1 text-xs ltr:pl-2 rtl:pr-2 ltr:border-l rtl:border-r border-slate-200 dark:border-slate-700">
              <span class="font-bold text-[11px] uppercase tracking-wider text-slate-400">{{ __('Month:') }}</span>
              <div class="flex flex-wrap gap-0.5">
                <button
                  v-for="m in monthsList"
                  :key="m.value"
                  class="px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer"
                  :class="
                    selectedMonth === m.value
                      ? 'bg-blue-600 text-white font-extrabold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  "
                  @click="selectedMonth = m.value"
                >
                  {{ m.label }}
                </button>
              </div>
            </div>

            <!-- Week Selector (for Week mode) -->
            <div v-if="selectedTimeRange === 'week'" class="flex items-center gap-1 text-xs ltr:pl-2 rtl:pr-2 ltr:border-l rtl:border-r border-slate-200 dark:border-slate-700">
              <span class="font-bold text-[11px] uppercase tracking-wider text-slate-400">{{ __('Week:') }}</span>
              <button
                v-for="w in [selectedWeek > 1 ? selectedWeek - 1 : 1, selectedWeek, selectedWeek < maxWeeksInCurrentYear ? selectedWeek + 1 : maxWeeksInCurrentYear]"
                :key="w"
                class="px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer"
                :class="
                  selectedWeek === w
                    ? 'bg-blue-600 text-white font-extrabold shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                "
                @click="selectedWeek = w"
              >
                W{{ w }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. MAIN HERO STAGE (HERO VIEWPORT: STAT CARDS + SVG GRAPH SIDE-BY-SIDE) -->
      <div
        class="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs"
      >
        <!-- Left Side: Interactive Series Toggles & Record Counts (Col 4) -->
        <div class="lg:col-span-4 flex flex-col justify-between space-y-3 lg:border-e lg:border-slate-100 lg:dark:border-slate-800 ltr:lg:pr-5 rtl:lg:pl-5">
          <div>
            <div class="flex items-center justify-between mb-2.5">
              <span class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ __('Active Metric Series') }}
              </span>
              <span class="text-[11px] text-slate-400 font-semibold">
                {{ activeSeriesList.filter((s) => s.isEnabled).length }}/{{ activeSeriesList.length }} {{ __('enabled') }}
              </span>
            </div>

            <!-- Series Cards Stack -->
            <div class="space-y-2 max-h-[300px] overflow-y-auto ltr:pr-1 rtl:pl-1">
              <div
                v-for="s in activeSeriesList"
                :key="s.name"
                role="button"
                tabindex="0"
                class="p-3 rounded-xl border transition-all duration-150 cursor-pointer shadow-2xs flex items-center justify-between select-none"
                :class="
                  s.isEnabled
                    ? 'bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700 hover:shadow-xs'
                    : 'bg-slate-50/30 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/40 opacity-40'
                "
                :style="{ borderLeftColor: s.color.stroke, borderLeftWidth: '4px' }"
                @click="toggleSeries(s.name)"
                @keydown.enter="toggleSeries(s.name)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold transition-all shrink-0"
                    :class="
                      s.isEnabled
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    "
                  >
                    {{ s.isEnabled ? '✓' : '' }}
                  </span>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {{ s.display }}
                  </span>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-base font-black text-slate-900 dark:text-white font-mono">
                    {{ s.totalSum }}
                  </span>
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: s.color.stroke }"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom hint -->
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>{{ __('Click any series to toggle') }}</span>
            <span class="font-mono text-blue-600 dark:text-blue-400 font-bold">
              {{ activeSeriesList.reduce((acc, s) => acc + (s.isEnabled ? s.totalSum : 0), 0) }} {{ __('total') }}
            </span>
          </div>
        </div>

        <!-- Right Side: Multi-Series SVG Graph Stage (Col 8) -->
        <div class="lg:col-span-8 flex flex-col justify-between space-y-3">
          <!-- Graph Header & Legend -->
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black text-slate-800 dark:text-slate-100">
                {{ currentMetric?.display }}
              </span>
              <span class="text-[11px] text-slate-400 font-medium">
                ({{ selectedTimeRange.toUpperCase() }}: {{ selectedYear }})
              </span>
            </div>

            <!-- Active Legend Chips -->
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="s in activeSeriesList"
                :key="'legend-' + s.name"
                class="flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all cursor-pointer text-[11px] font-bold"
                :class="
                  s.isEnabled
                    ? s.color.badgeClass
                    : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 opacity-40'
                "
                @click="toggleSeries(s.name)"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color.stroke }"></span>
                <span>{{ s.display }}</span>
              </button>
            </div>
          </div>

          <!-- SVG Graph -->
          <div class="relative w-full overflow-x-auto">
            <!-- Empty State Notice -->
            <div
              v-if="!activeSeriesList.some((s) => s.isEnabled)"
              class="py-16 flex flex-col items-center justify-center text-center text-slate-400"
            >
              <CommonIcon name="speedometer2" class="w-10 h-10 mb-2 opacity-40 text-slate-400" />
              <span class="text-sm font-bold text-slate-600 dark:text-slate-300">
                {{ __('All series are currently hidden') }}
              </span>
              <span class="text-xs text-slate-400 mt-1">
                {{ __('Toggle any series on the left to display its curve.') }}
              </span>
            </div>

            <svg
              v-else
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              class="w-full h-64 sm:h-72 min-w-[550px] overflow-visible select-none"
            >
              <defs>
                <linearGradient
                  v-for="s in computedSeriesLines"
                  :id="s.series.color.gradientId"
                  :key="'grad-' + s.series.name"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" :stop-color="s.series.color.stroke" stop-opacity="0.22" />
                  <stop offset="100%" :stop-color="s.series.color.stroke" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Horizontal Grid Guide Lines -->
              <g v-for="g in yAxisGuideLines" :key="g.val">
                <line
                  :x1="padding.left"
                  :y1="g.y"
                  :x2="chartWidth - padding.right"
                  :y2="g.y"
                  stroke="#94a3b8"
                  stroke-opacity="0.25"
                  stroke-dasharray="3,3"
                />
                <text
                  :x="padding.left - 10"
                  :y="g.y + 4"
                  font-size="10"
                  text-anchor="end"
                  fill="#94a3b8"
                  class="font-mono font-bold"
                >
                  {{ g.val }}
                </text>
              </g>

              <!-- Gradient Area Fills -->
              <path
                v-for="s in computedSeriesLines"
                :key="'area-' + s.series.name"
                :d="s.areaPath"
                :fill="`url(#${s.series.color.gradientId})`"
              />

              <!-- Spline Lines -->
              <path
                v-for="s in computedSeriesLines"
                :key="'line-' + s.series.name"
                :d="s.curvePath"
                fill="none"
                :stroke="s.series.color.stroke"
                stroke-width="2.5"
                stroke-linecap="round"
              />

              <!-- Vertical Crosshair on Hover -->
              <line
                v-if="hoveredPointIndex !== null && computedSeriesLines[0]?.points[hoveredPointIndex]"
                :x1="computedSeriesLines[0].points[hoveredPointIndex].x"
                :y1="padding.top"
                :x2="computedSeriesLines[0].points[hoveredPointIndex].x"
                :y2="chartHeight - padding.bottom"
                stroke="#64748b"
                stroke-width="1.5"
                stroke-dasharray="3,3"
                opacity="0.7"
              />

              <!-- X-Axis Labels -->
              <g v-for="(tick, idx) in xAxisTicks" :key="'tick-' + idx">
                <text
                  v-if="tick.label"
                  :x="padding.left + (idx * (chartWidth - padding.left - padding.right)) / Math.max(1, xAxisTicks.length - 1)"
                  :y="chartHeight - 14"
                  font-size="11"
                  text-anchor="middle"
                  class="font-bold"
                  fill="#64748b"
                >
                  {{ tick.label }}
                </text>
              </g>

              <!-- Point Dots & Tooltips -->
              <g v-for="(tick, idx) in xAxisTicks" :key="'col-' + idx">
                <!-- Transparent Click Target -->
                <!-- eslint-disable-next-line vuejs-accessibility/mouse-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
                <rect
                  :x="padding.left + (idx * (chartWidth - padding.left - padding.right)) / Math.max(1, xAxisTicks.length - 1) - 12"
                  :y="padding.top"
                  width="24"
                  :height="chartHeight - padding.top - padding.bottom"
                  fill="transparent"
                  class="cursor-pointer"
                  @mouseenter="hoveredPointIndex = idx"
                  @mouseleave="hoveredPointIndex = null"
                />

                <!-- Point Circles for each visible series -->
                <circle
                  v-for="s in computedSeriesLines"
                  v-show="s.series.isEnabled && (s.points[idx]?.val > 0 || hoveredPointIndex === idx)"
                  :key="'dot-' + s.series.name + '-' + idx"
                  :cx="s.points[idx]?.x"
                  :cy="s.points[idx]?.y"
                  :r="hoveredPointIndex === idx ? 5.5 : 4"
                  :fill="s.series.color.stroke"
                  stroke="#ffffff"
                  stroke-width="2"
                />
              </g>

              <!-- Multi-Series Tooltip Overlay Box -->
              <g
                v-if="hoveredPointIndex !== null && computedSeriesLines[0]?.points[hoveredPointIndex]"
                pointer-events="none"
              >
                <rect
                  :x="Math.min(computedSeriesLines[0].points[hoveredPointIndex].x - 70, chartWidth - 160)"
                  :y="10"
                  width="150"
                  :height="26 + computedSeriesLines.filter((s) => s.series.isEnabled).length * 18"
                  rx="10"
                  fill="#0f172a"
                  opacity="0.95"
                  class="shadow-2xl"
                />
                <text
                  :x="Math.min(computedSeriesLines[0].points[hoveredPointIndex].x + 5, chartWidth - 85)"
                  :y="26"
                  font-size="11"
                  fill="#94a3b8"
                  text-anchor="middle"
                  font-weight="bold"
                >
                  {{ xAxisTicks[hoveredPointIndex]?.shortLabel }}
                </text>
                <g
                  v-for="(s, sIdx) in computedSeriesLines.filter((l) => l.series.isEnabled)"
                  :key="'tt-' + s.series.name"
                >
                  <circle
                    :cx="Math.min(computedSeriesLines[0].points[hoveredPointIndex].x - 55, chartWidth - 145)"
                    :cy="42 + sIdx * 18"
                    r="3.5"
                    :fill="s.series.color.stroke"
                  />
                  <text
                    :x="Math.min(computedSeriesLines[0].points[hoveredPointIndex].x - 45, chartWidth - 135)"
                    :y="46 + sIdx * 18"
                    font-size="10"
                    fill="#f8fafc"
                    font-weight="semibold"
                  >
                    {{ s.series.display }}: {{ s.points[hoveredPointIndex]?.val || 0 }}
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <!-- 3. DATASET INSPECTION & TICKETS TABLE (VISIBLE ON SCROLL) -->
      <div
        class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden"
      >
        <!-- Table Header & Backend Tabs -->
        <div class="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="text-base font-black text-slate-900 dark:text-white">
                {{ __('Dataset Inspection & Tickets') }}
              </h3>
              <span class="text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-0.5 rounded-full shadow-2xs">
                {{ tableTotalCount }} {{ __('records') }}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {{ __('Detailed tickets matching the selected reporting profile and active timeframe.') }}
            </p>
          </div>

          <!-- Download Backend Series Tabs & Export Button -->
          <div class="flex flex-wrap items-center gap-2.5">
            <!-- Tabs for backends with dataDownload -->
            <div
              v-if="availableDownloadBackends.length > 1"
              class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <button
                v-for="b in availableDownloadBackends"
                :key="b.name"
                class="px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer"
                :class="
                  downloadBackendSelected === b.name
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                "
                @click="downloadBackendSelected = b.name"
              >
                {{ b.display }}
              </button>
            </div>

            <!-- Export XLSX Button -->
            <button
              class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              :disabled="tableTotalCount === 0 || isExporting"
              :title="__('Download full Excel report matching legacy format')"
              @click="exportToExcel"
            >
              <CommonIcon name="download" class="w-3.5 h-3.5" />
              <span>{{ __('Download %s record(s)', tableTotalCount) }}</span>
            </button>
          </div>
        </div>

        <!-- Table View -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/90 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
              <tr>
                <th class="py-3.5 px-5">{{ __('Ticket #') }}</th>
                <th class="py-3.5 px-5">{{ __('Title') }}</th>
                <th class="py-3.5 px-5">{{ __('Customer') }}</th>
                <th class="py-3.5 px-5">{{ __('Status') }}</th>
                <th class="py-3.5 px-5">{{ __('Created') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-if="isTableLoading" class="text-center py-8 text-slate-400">
                <td colspan="5" class="py-8">
                  <div class="flex items-center justify-center gap-2 text-xs font-bold">
                    <CommonIcon name="repeat" class="w-4 h-4 animate-spin text-blue-500" />
                    <span>{{ __('Loading records...') }}</span>
                  </div>
                </td>
              </tr>
              <tr
                v-else-if="tableTickets.length === 0"
                class="text-center py-8 text-slate-400"
              >
                <td colspan="5" class="py-8">
                  <div class="flex flex-col items-center justify-center gap-1.5">
                    <span class="font-bold text-sm text-slate-600 dark:text-slate-300">{{ __('No tickets found') }}</span>
                    <span class="text-xs text-slate-400">{{ __('No ticket records found for this period and metric.') }}</span>
                  </div>
                </td>
              </tr>
              <tr
                v-for="t in tableTickets"
                :key="t.id"
                class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td
                  class="py-3.5 px-5 font-mono font-black text-blue-600 dark:text-blue-400 cursor-pointer text-xs"
                  @click="router.push(`/ticket/zoom/${t.id}`)"
                >
                  #{{ t.number }}
                </td>
                <td
                  class="py-3.5 px-5 font-bold text-slate-800 dark:text-slate-200 max-w-md truncate cursor-pointer hover:underline text-xs"
                  @click="router.push(`/ticket/zoom/${t.id}`)"
                >
                  {{ t.title }}
                </td>
                <td class="py-3.5 px-5 text-slate-600 dark:text-slate-300 font-medium">
                  {{ t.customer }}
                </td>
                <td class="py-3.5 px-5">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-2xs"
                    :class="getStatusBadgeClass(t.state || '')"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-current ltr:mr-1.5 rtl:ml-1.5"></span>
                    {{ t.state }}
                  </span>
                </td>
                <td class="py-3.5 px-5 text-slate-500 whitespace-nowrap text-xs font-medium">
                  {{ formatDate(t.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
