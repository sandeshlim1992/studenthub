<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Student Hub: "My sites" on the manager dashboard: the numbers of each site (organisation)
// assigned to the manager, with a link to its view (GET /api/v1/studenthub/manager_sites/stats).
// Shown only to managers who have sites.

interface Count {
  name: string
  count: number
}

interface SiteStats {
  organization_id: number
  name: string
  view_link: string
  open: number
  new: number
  waiting: number
  escalated: number
  closed: number
  teams: Count[]
  categories: Count[]
}

interface Stats {
  sites: SiteStats[]
  settings: { new_period_days: number; closed_period_days: number }
}

const stats = ref<Stats | null>(null)
const hasError = ref(false)

const load = () =>
  // fetch can throw at once (tests), so start it inside the promise chain.
  Promise.resolve()
    .then(() =>
      fetch('/api/v1/studenthub/manager_sites/stats', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    .then(async (response) => {
      if (!response.ok) throw new Error(`${response.status}`)
      const data = (await response.json()) as Partial<Stats>
      stats.value = {
        sites: Array.isArray(data.sites) ? data.sites : [],
        settings: data.settings ?? { new_period_days: 7, closed_period_days: 30 },
      }
      hasError.value = false
    })
    .catch(() => {
      hasError.value = true
    })

onMounted(load)

defineExpose({ load })
</script>

<template>
  <section v-if="hasError || stats?.sites.length" aria-labelledby="studenthub-my-sites" class="space-y-4">
    <h2 id="studenthub-my-sites" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase dark:text-slate-300">
      {{ $t('My sites') }}
    </h2>

    <CommonAlert v-if="hasError" variant="danger">{{ $t('The site numbers could not be loaded. Try Refresh.') }}</CommonAlert>

    <div v-else-if="stats" class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <article
        v-for="site in stats.sites"
        :key="site.organization_id"
        class="flex flex-col gap-5 rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs dark:border-slate-700/80 dark:bg-slate-800"
        :aria-label="site.name"
      >
        <header class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">{{ site.name }}</h3>
          <CommonLink
            :link="`/tickets/view/${site.view_link}`"
            internal
            class="text-sm font-semibold text-[var(--sh-app)]! hover:underline"
          >
            {{ $t('Open site view') }} →
          </CommonLink>
        </header>

        <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <dt class="text-xs font-semibold text-slate-500">{{ $t('Open') }}</dt>
            <dd class="text-2xl font-black text-slate-900 tabular-nums dark:text-white">{{ site.open }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <dt class="text-xs font-semibold text-slate-500">{{ $t('New (%s days)', stats.settings.new_period_days) }}</dt>
            <dd class="text-2xl font-black text-slate-900 tabular-nums dark:text-white">{{ site.new }}</dd>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <dt class="text-xs font-semibold text-slate-500">{{ $t('Waiting') }}</dt>
            <dd class="text-2xl font-black text-slate-900 tabular-nums dark:text-white">{{ site.waiting }}</dd>
          </div>
          <div class="rounded-xl p-3" :class="site.escalated ? 'bg-red-50 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-900/40'">
            <dt class="text-xs font-semibold" :class="site.escalated ? 'text-red-700 dark:text-red-300' : 'text-slate-500'">
              {{ $t('Escalated') }}
            </dt>
            <dd
              class="text-2xl font-black tabular-nums"
              :class="site.escalated ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'"
            >
              {{ site.escalated }}
            </dd>
          </div>
          <div class="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <dt class="text-xs font-semibold text-slate-500">{{ $t('Closed (%s days)', stats.settings.closed_period_days) }}</dt>
            <dd class="text-2xl font-black text-slate-900 tabular-nums dark:text-white">{{ site.closed }}</dd>
          </div>
        </dl>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <h4 class="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{{ $t('Open by team') }}</h4>
            <ul v-if="site.teams.length" class="space-y-1.5 text-sm">
              <li v-for="team in site.teams" :key="team.name" class="flex justify-between gap-3">
                <span class="truncate">{{ team.name }}</span>
                <span class="font-semibold tabular-nums">{{ team.count }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-500">{{ $t('No open tickets.') }}</p>
          </div>
          <div>
            <h4 class="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{{ $t('Top categories (open)') }}</h4>
            <ul v-if="site.categories.length" class="space-y-1.5 text-sm">
              <li v-for="category in site.categories" :key="category.name" class="flex justify-between gap-3">
                <span class="truncate">{{ category.name }}</span>
                <span class="font-semibold tabular-nums">{{ category.count }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-500">{{ $t('No categories yet.') }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
