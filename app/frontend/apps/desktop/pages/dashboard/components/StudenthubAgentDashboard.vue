<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { i18n } from '#shared/i18n.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubAgentStats } from '../composables/useStudenthubAgentStats.ts'
import { useStudenthubDashboardActivity } from '../composables/useStudenthubDashboardActivity.ts'
import {
  STUDENTHUB_DASHBOARD_CHANNELS,
  type StudenthubDashboardTone,
  formatMinutes,
  greeting,
  share,
  studenthubMood,
} from '../utils/studenthubDashboard.ts'

import StudenthubDashboardActivity from './StudenthubDashboardActivity.vue'

import '../styles/studenthub-dashboard.css'

// Student Hub: the agents' dashboard ("Briefing"). One sentence on the day, then waiting time,
// escalations and reopened tickets next to the team, the workload with how tickets came in, and
// the latest activity. The figures are Zammad's own agent stats (useStudenthubAgentStats).

const session = useSessionStore()
const firstName = computed(() => session.user?.firstname || '')

const {
  isLoading: isStatsLoading,
  hasLoaded,
  load: loadStats,
  waiting,
  escalation,
  assigned,
  inProcess,
  reopen,
  channels,
} = useStudenthubAgentStats()

const {
  items: activityItems,
  isLoading: isActivityLoading,
  loadFailed: activityFailed,
  load: loadActivity,
} = useStudenthubDashboardActivity()

const refresh = () => Promise.all([loadStats(), loadActivity()])

onMounted(refresh)

const hello = computed(() => i18n.t(greeting(new Date()), firstName.value))

const summary = computed(() => {
  const parts: string[] = []

  const mine = assigned.value.own
  const escalated = escalation.value.own

  if (!mine) parts.push(i18n.t('You have no open tickets assigned.'))
  else if (mine === 1)
    parts.push(escalated ? i18n.t('Your one open ticket is escalated.') : i18n.t('Your one open ticket is not escalated.'))
  else if (!escalated) parts.push(i18n.t('None of your %s open tickets is escalated.', mine))
  else if (escalated === 1) parts.push(i18n.t('1 of your %s open tickets is escalated.', mine))
  else parts.push(i18n.t('%s of your %s open tickets are escalated.', escalated, mine))

  const { me, team } = waiting.value
  if (me > 0 && team !== null) {
    const difference = team - me
    if (difference > 0)
      parts.push(
        i18n.t(
          'Students waited %s for you today, %s less than the team.',
          formatMinutes(me),
          formatMinutes(difference),
        ),
      )
    else if (difference < 0)
      parts.push(
        i18n.t(
          'Students waited %s for you today, %s more than the team.',
          formatMinutes(me),
          formatMinutes(-difference),
        ),
      )
    else parts.push(i18n.t('Students waited %s for you today, the same as the team.', formatMinutes(me)))
  }

  return parts.join(' ')
})

interface Chip {
  tone: StudenthubDashboardTone
  text: string
}

const waitingChip = computed<Chip | null>(() => {
  const { me, team } = waiting.value
  if (!me || team === null) return null

  const difference = team - me
  if (difference > 0) return { tone: 'good', text: i18n.t('%s faster', formatMinutes(difference)) }
  if (difference < 0) return { tone: 'warn', text: i18n.t('%s slower', formatMinutes(-difference)) }
  return { tone: 'neutral', text: i18n.t('Same as the team') }
})

const reopenChip = computed<Chip | null>(() => {
  const { percent, average, total } = reopen.value
  if (average === null || !total) return null
  if (percent < average) return { tone: 'good', text: i18n.t('Below average') }
  if (percent > average) return { tone: 'warn', text: i18n.t('Above average') }
  return { tone: 'neutral', text: i18n.t('Average') }
})

const mood = computed(() => studenthubMood(escalation.value.state))

// Bars leave a little room above the larger of the two values.
const scale = (...values: (number | null)[]) =>
  Math.max(1, ...values.map((value) => value ?? 0)) * 1.2
</script>

<template>
  <div class="sh-dash" data-test-id="studenthub-agent-dashboard">
    <header class="sh-dash-hero">
      <div>
        <h1>{{ hello }}</h1>
        <p class="sh-dash-summary">{{ hasLoaded ? summary : $t('Loading your figures…') }}</p>
      </div>
      <CommonButton
        variant="secondary"
        prefix-icon="arrow-repeat"
        :disabled="isStatsLoading || isActivityLoading"
        @click="refresh"
      >
        {{ $t('Refresh') }}
      </CommonButton>
    </header>

    <div class="sh-dash-three">
      <section class="sh-dash-card" :aria-label="$t('Waiting time today')">
        <header class="sh-dash-card__head">
          <span class="sh-dash-sq"><CommonIcon name="clock" size="xs" decorative /></span>
          <h2>{{ $t('Waiting time today') }}</h2>
        </header>
        <div class="sh-dash-row">
          <span class="sh-dash-big">{{ formatMinutes(waiting.me) }}</span>
          <span v-if="waitingChip" class="sh-dash-chip" :data-tone="waitingChip.tone">{{ waitingChip.text }}</span>
        </div>
        <span v-if="!waiting.me" class="sh-dash-sub">{{ $t('No student has waited for a reply from you today.') }}</span>
        <div v-if="waiting.me" class="sh-dash-vs">
          <span>{{ $t('You') }}</span>
          <span class="sh-dash-track"><span :style="{ width: `${share(waiting.me, scale(waiting.me, waiting.team))}%` }" /></span>
          <b>{{ formatMinutes(waiting.me) }}</b>
        </div>
        <div v-if="waiting.me && waiting.team !== null" class="sh-dash-vs">
          <span>{{ $t('Team') }}</span>
          <span class="sh-dash-track"><span data-team :style="{ width: `${share(waiting.team, scale(waiting.me, waiting.team))}%` }" /></span>
          <span>{{ formatMinutes(waiting.team) }}</span>
        </div>
      </section>

      <section class="sh-dash-card" :aria-label="$t('Escalations')">
        <header class="sh-dash-card__head">
          <span class="sh-dash-sq"><CommonIcon name="exclamation-triangle" size="xs" decorative /></span>
          <h2>{{ $t('Escalations') }}</h2>
        </header>
        <div class="sh-dash-row">
          <span class="sh-dash-big">{{ escalation.own }}<small>{{ $t('of %s', assigned.own) }}</small></span>
          <span v-if="mood" class="sh-dash-chip" :data-tone="mood.tone">{{ $t('Mood: %s', $t(mood.label)) }}</span>
        </div>
        <span class="sh-dash-track"><span data-tone="warn" :style="{ width: `${share(escalation.own, assigned.own)}%` }" /></span>
        <span class="sh-dash-sub">{{ $t('%s escalated across your teams', escalation.total) }}</span>
      </section>

      <section class="sh-dash-card" :aria-label="$t('Reopened by students')">
        <header class="sh-dash-card__head">
          <span class="sh-dash-sq"><CommonIcon name="arrow-repeat" size="xs" decorative /></span>
          <h2>{{ $t('Reopened by students') }}</h2>
        </header>
        <div class="sh-dash-row">
          <span class="sh-dash-big">{{ reopen.percent }}<small>%</small></span>
          <span v-if="reopenChip" class="sh-dash-chip" :data-tone="reopenChip.tone">{{ reopenChip.text }}</span>
        </div>
        <div class="sh-dash-vs">
          <span>{{ $t('You') }}</span>
          <span class="sh-dash-track"><span :style="{ width: `${share(reopen.percent, scale(reopen.percent, reopen.average))}%` }" /></span>
          <b>{{ reopen.percent }}%</b>
        </div>
        <div v-if="reopen.average !== null" class="sh-dash-vs">
          <span>{{ $t('Team') }}</span>
          <span class="sh-dash-track"><span data-team :style="{ width: `${share(reopen.average, scale(reopen.percent, reopen.average))}%` }" /></span>
          <span>{{ reopen.average }}%</span>
        </div>
        <span class="sh-dash-sub">{{ $t('%s of %s closed tickets', reopen.count, reopen.total) }}</span>
      </section>
    </div>

    <div class="sh-dash-two">
      <section class="sh-dash-card" :aria-label="$t('Your workload')">
        <header class="sh-dash-card__head">
          <span class="sh-dash-sq"><CommonIcon name="list-ul" size="xs" decorative /></span>
          <h2>{{ $t('Your workload') }}</h2>
          <CommonLink class="sh-dash-card__link" link="/tickets/view/my_assigned" internal>
            {{ $t('View my tickets') }} →
          </CommonLink>
        </header>
        <div class="sh-dash-pair">
          <div>
            <div class="sh-dash-label">{{ $t('Assigned to you') }}</div>
            <div class="sh-dash-big">{{ assigned.own }}<small>{{ $t('of %s open', assigned.total) }}</small></div>
            <span v-if="assigned.average !== null" class="sh-dash-sub">
              {{ $t('Average per agent: %s', assigned.average) }}
            </span>
          </div>
          <div>
            <div class="sh-dash-label">{{ $t('In process') }}</div>
            <div class="sh-dash-big">{{ inProcess.percent }}<small>%</small></div>
            <span class="sh-dash-sub">
              {{ $t('%s of %s', inProcess.count, inProcess.total) }}<template v-if="inProcess.average !== null"> · {{ $t('average %s', `${inProcess.average}%`) }}</template>
            </span>
          </div>
        </div>
        <div class="sh-dash-label">{{ $t('How your tickets came in') }}</div>
        <template v-if="channels.total">
          <div class="sh-dash-stack" role="img" :aria-label="channels.list.map((channel) => `${$t(STUDENTHUB_DASHBOARD_CHANNELS[channel.key].label)} ${channel.count}`).join(', ')">
            <span
              v-for="channel in channels.list"
              :key="channel.key"
              :style="{ width: `${(channel.count / channels.total) * 100}%`, backgroundColor: STUDENTHUB_DASHBOARD_CHANNELS[channel.key].color }"
            />
          </div>
          <ul class="sh-dash-legend">
            <li v-for="channel in channels.list" :key="channel.key">
              <i :style="{ backgroundColor: STUDENTHUB_DASHBOARD_CHANNELS[channel.key].color }" />
              {{ $t(STUDENTHUB_DASHBOARD_CHANNELS[channel.key].label) }}
              <b>{{ Math.round((channel.count / channels.total) * 100) }}%</b>
              <span class="sh-dash-sub">({{ channel.count }})</span>
            </li>
          </ul>
        </template>
        <p v-else class="sh-dash-empty">{{ $t('No tickets handled yet.') }}</p>
      </section>

      <StudenthubDashboardActivity
        :items="activityItems"
        :is-loading="isActivityLoading"
        :load-failed="activityFailed"
      />
    </div>
  </div>
</template>
