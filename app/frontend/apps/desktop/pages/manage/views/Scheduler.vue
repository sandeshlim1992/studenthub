<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import { describeTimeplan, type Timeplan } from '../components/Automation/timeplan.ts'

// Student Hub: the Scheduler (Zammad's scheduled jobs), moved from the classic admin. Jobs run at the
// chosen times and change the tickets that match their conditions.

interface Job {
  id: number
  name: string
  note: string | null
  active: boolean
  object: string
  timeplan: Partial<Timeplan>
  last_run_at: string | null
  next_run_at: string | null
  matching: number | null
}

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Scheduler') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const jobs = ref<Job[]>([])
const isLoaded = ref(false)
const loadError = ref<string | null>(null)
const busyId = ref<number | null>(null)

const load = async () => {
  try {
    jobs.value = await studenthubApi<Job[]>('/api/v1/jobs')
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    isLoaded.value = true
  }
}

onMounted(load)
onActivated(() => {
  if (isLoaded.value) void load()
})

const sortedJobs = computed(() =>
  [...jobs.value].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
)

const toggleActive = async (job: Job) => {
  busyId.value = job.id
  try {
    const saved = await studenthubApi<Job>(`/api/v1/jobs/${job.id}`, { method: 'PUT', body: { active: !job.active } })
    job.active = saved.active
    notify({
      id: 'scheduler-job-saved',
      type: NotificationTypes.Success,
      message: saved.active ? __('Job switched on.') : __('Job switched off.'),
    })
  } catch (error) {
    notify({ id: 'scheduler-job-error', type: NotificationTypes.Error, message: (error as Error).message })
  } finally {
    busyId.value = null
  }
}

const remove = async (job: Job) => {
  if (!(await waitForVariantConfirmation('delete'))) return

  busyId.value = job.id
  try {
    await studenthubApi(`/api/v1/jobs/${job.id}`, { method: 'DELETE' })
    jobs.value = jobs.value.filter((item) => item.id !== job.id)
    notify({ id: 'scheduler-job-deleted', type: NotificationTypes.Success, message: __('Job deleted.') })
  } catch (error) {
    notify({ id: 'scheduler-job-error', type: NotificationTypes.Error, message: (error as Error).message })
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Scheduler') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('Jobs that run at set times and change the tickets matching their conditions.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          @click="$router.push('/manage/scheduler/new')"
        >
          {{ $t('New job') }}
        </CommonButton>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
      <p v-else-if="!jobs.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No jobs yet.') }}</p>

      <div v-else class="overflow-x-auto rounded-xl border border-[var(--sh-line)] bg-white">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-start">
              <th class="px-4 py-2.5 text-start">{{ $t('Name') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Runs') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Last run') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Next run') }}</th>
              <th class="px-4 py-2.5 text-start">{{ $t('Active') }}</th>
              <th class="px-4 py-2.5"><span class="sr-only">{{ $t('Actions') }}</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--sh-line)]">
            <tr v-for="job in sortedJobs" :key="job.id" :class="{ 'opacity-60': !job.active }">
              <td class="px-4 py-3">
                <RouterLink
                  :to="`/manage/scheduler/${job.id}`"
                  class="font-semibold text-[var(--sh-ink)]! hover:text-[var(--sh-app)]! hover:underline"
                >
                  {{ job.name }}
                </RouterLink>
                <p v-if="job.note" class="mt-0.5 line-clamp-1 text-xs text-[var(--sh-muted)]">{{ job.note }}</p>
              </td>
              <td class="px-4 py-3 text-[var(--sh-ink-2)]">{{ describeTimeplan(job.timeplan) }}</td>
              <td class="px-4 py-3 text-[var(--sh-muted)]">
                <CommonDateTime v-if="job.last_run_at" :date-time="job.last_run_at" type="relative" />
                <span v-else>{{ $t('Never') }}</span>
              </td>
              <td class="px-4 py-3 text-[var(--sh-muted)]">
                <CommonDateTime v-if="job.active && job.next_run_at" :date-time="job.next_run_at" type="relative" />
                <span v-else>–</span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
                  :class="job.active ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
                  :aria-checked="job.active"
                  :aria-label="$t('Active: %s', job.name)"
                  :disabled="busyId === job.id"
                  @click="toggleActive(job)"
                >
                  <span
                    class="inline-block size-4 rounded-full bg-white shadow transition-transform"
                    :class="job.active ? 'ltr:translate-x-4.5 rtl:-translate-x-4.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'"
                  />
                </button>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <CommonButton
                    variant="neutral"
                    size="small"
                    icon="files"
                    :aria-label="$t('Copy %s', job.name)"
                    @click="$router.push({ path: '/manage/scheduler/new', query: { copy: job.id } })"
                  />
                  <CommonButton
                    variant="remove"
                    size="small"
                    icon="trash3"
                    :aria-label="$t('Delete %s', job.name)"
                    :disabled="busyId === job.id"
                    @click="remove(job)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </LayoutContent>
</template>
