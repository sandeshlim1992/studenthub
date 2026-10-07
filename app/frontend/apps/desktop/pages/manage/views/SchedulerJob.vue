<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { watchDebounced } from '@vueuse/shared'
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import {
  actionFields,
  actionProblems,
  conditionFields,
  conditionProblems,
  conditionToRows,
  isExpertCondition,
  performToRows,
  rowsToCondition,
  rowsToPerform,
  type ActionRow,
  type AutomationOptions,
  type ConditionRow,
} from '../components/Automation/automation.ts'
import AutomationActionEditor from '../components/Automation/AutomationActionEditor.vue'
import AutomationConditionEditor from '../components/Automation/AutomationConditionEditor.vue'
import AutomationTimeplanEditor from '../components/Automation/AutomationTimeplanEditor.vue'
import { emptyTimeplan, normalizeTimeplan, timeplanProblems, type Timeplan } from '../components/Automation/timeplan.ts'

// Student Hub: one scheduler job: when it runs, which tickets it picks and what it does to them.
// Saved through Zammad's jobs API (/api/v1/jobs).

interface Job {
  id: number
  name: string
  note: string | null
  active: boolean
  object: string
  disable_notification: boolean
  timeplan: Partial<Timeplan>
  condition: unknown
  perform: unknown
}

const route = useRoute()
const router = useRouter()
const { notify } = useNotifications()

const idFrom = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const jobId = computed(() => idFrom(route.params.jobId))
const copyId = computed(() => idFrom(route.query.copy))

const breadcrumbItems = computed(() => [
  { label: __('Administration'), to: '/manage' },
  { label: __('Scheduler'), to: '/manage/scheduler' },
  { label: jobId.value ? name.value || __('Job') : __('New job') },
])

const options = ref<AutomationOptions | null>(null)
const loadError = ref<string | null>(null)
const isSaving = ref(false)
const problems = ref<string[]>([])

const name = ref('')
const note = ref('')
const active = ref(true)
const disableNotification = ref(true)
const object = ref('Ticket')
const timeplan = ref<Timeplan>(emptyTimeplan())
const conditionRows = ref<ConditionRow[]>([])
const actionRows = ref<ActionRow[]>([])
// Conditions in Zammad's expert mode aren't edited here; they are kept as they are.
const expertCondition = ref<unknown>(null)

const conditionFieldList = computed(() => (options.value ? conditionFields(options.value) : []))
const actionFieldList = computed(() => (options.value ? actionFields(options.value) : []))
const isTicketJob = computed(() => object.value === 'Ticket')

const condition = computed(() =>
  expertCondition.value ?? rowsToCondition(conditionRows.value, conditionFieldList.value),
)

const reset = () => {
  loadError.value = null
  problems.value = []
  name.value = ''
  note.value = ''
  active.value = true
  disableNotification.value = true
  object.value = 'Ticket'
  timeplan.value = emptyTimeplan()
  conditionRows.value = []
  actionRows.value = []
  expertCondition.value = null
}

const load = async () => {
  reset()
  try {
    options.value = await studenthubApi<AutomationOptions>('/api/v1/studenthub/automation/options')
    const sourceId = jobId.value ?? copyId.value
    if (!sourceId) return

    const job = await studenthubApi<Job>(`/api/v1/jobs/${sourceId}`)
    name.value = jobId.value ? job.name : `${job.name} (copy)`
    note.value = job.note ?? ''
    active.value = jobId.value ? job.active : false
    disableNotification.value = job.disable_notification
    object.value = job.object
    timeplan.value = normalizeTimeplan(job.timeplan)
    if (isExpertCondition(job.condition)) expertCondition.value = job.condition
    else conditionRows.value = conditionToRows(job.condition, conditionFieldList.value)
    actionRows.value = performToRows(job.perform, actionFieldList.value)
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

// The page is kept alive: start again from the server each time it is shown.
let skipNextActivation = false
onMounted(() => {
  skipNextActivation = true
  void load()
})
onActivated(() => {
  if (skipNextActivation) {
    skipNextActivation = false
    return
  }
  void load()
})
watch([jobId, copyId], () => load())

// How many tickets the conditions pick now.
const matchCount = ref<number | null>(null)
watchDebounced(
  condition,
  async (value) => {
    if (!isTicketJob.value || !Object.keys(value as object).length) {
      matchCount.value = null
      return
    }
    try {
      const result = await studenthubApi<{ object_count: number }>('/api/v1/tickets/selector', {
        method: 'POST',
        body: { condition: value },
      })
      matchCount.value = result.object_count
    } catch {
      matchCount.value = null
    }
  },
  { debounce: 600, deep: true },
)

const checkProblems = () => {
  const found: string[] = []
  if (!name.value.trim()) found.push(__('Give the job a name.'))
  found.push(...timeplanProblems(timeplan.value))
  if (!expertCondition.value && !conditionRows.value.length) {
    found.push(__('Add at least one condition, so the job does not change every ticket.'))
  }
  found.push(...conditionProblems(conditionRows.value, conditionFieldList.value))
  if (!actionRows.value.length) found.push(__('Add at least one action.'))
  found.push(...actionProblems(actionRows.value, actionFieldList.value))
  problems.value = found
  return found.length === 0
}

const save = async () => {
  if (!checkProblems()) return

  isSaving.value = true
  const payload = {
    name: name.value.trim(),
    note: note.value.trim(),
    active: active.value,
    object: object.value,
    disable_notification: disableNotification.value,
    timeplan: timeplan.value,
    condition: condition.value,
    perform: rowsToPerform(actionRows.value, actionFieldList.value),
  }

  try {
    if (jobId.value) await studenthubApi(`/api/v1/jobs/${jobId.value}`, { method: 'PUT', body: payload })
    else await studenthubApi('/api/v1/jobs', { method: 'POST', body: payload })
    notify({ id: 'scheduler-job-saved', type: NotificationTypes.Success, message: __('The job has been saved.') })
    await router.push('/manage/scheduler')
  } catch (error) {
    problems.value = [(error as Error).message]
  } finally {
    isSaving.value = false
  }
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
        {{ jobId ? $t('Edit job') : $t('New job') }}
      </h1>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!options" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <CommonAlert v-else-if="!isTicketJob" variant="warning">
        {{ $t('This job works on %s records. Edit it in the classic admin (Scheduler).', object) }}
      </CommonAlert>

      <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="save">
        <section aria-labelledby="job-basics" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="job-basics" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('Job') }}</h2>
          <label for="job-name" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Name') }}
            <input id="job-name" v-model="name" type="text" required :class="inputClass" />
          </label>
          <label for="job-note" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Note') }}
            <input id="job-note" v-model="note" type="text" maxlength="250" :class="inputClass" />
          </label>
          <div class="flex flex-wrap gap-5">
            <label for="job-active" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
              <input id="job-active" v-model="active" type="checkbox" />
              {{ $t('Active') }}
            </label>
            <label for="job-quiet" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
              <input id="job-quiet" v-model="disableNotification" type="checkbox" />
              {{ $t("Don't notify agents about the changes this job makes") }}
            </label>
          </div>
        </section>

        <section aria-labelledby="job-when" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="job-when" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('When it runs') }}</h2>
          <AutomationTimeplanEditor v-model="timeplan" />
        </section>

        <section aria-labelledby="job-which" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="job-which" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
              {{ $t('Which tickets (all conditions must match)') }}
            </h2>
            <span v-if="matchCount !== null" class="text-sm font-semibold text-[var(--sh-app)]" role="status">
              {{ $t('%s tickets match now', matchCount) }}
            </span>
          </div>
          <CommonAlert v-if="expertCondition" variant="info">
            {{ $t('These conditions use the classic admin\'s expert mode. They are kept as they are; edit them there.') }}
          </CommonAlert>
          <AutomationConditionEditor v-else v-model="conditionRows" :fields="conditionFieldList" id-prefix="job-condition" />
        </section>

        <section aria-labelledby="job-what" class="flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <h2 id="job-what" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">{{ $t('What happens to them') }}</h2>
          <AutomationActionEditor v-model="actionRows" :fields="actionFieldList" id-prefix="job-action" />
        </section>

        <CommonAlert v-if="problems.length" variant="danger" role="alert">
          <ul class="list-disc ps-4">
            <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>

        <div class="flex justify-end gap-2">
          <CommonButton variant="secondary" size="medium" @click="router.push('/manage/scheduler')">
            {{ $t('Cancel') }}
          </CommonButton>
          <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isSaving">
            {{ $t('Save job') }}
          </CommonButton>
        </div>
      </form>
    </div>
  </LayoutContent>
</template>
