<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import type {
  StudenthubDashboardView,
  StudenthubDashboardViewKey,
} from '#desktop/pages/dashboard/utils/studenthubDashboard.ts'

// Student Hub: the buttons above the dashboard for users with more than one dashboard
// (Team overview, My work, Approvals).
defineProps<{
  views: StudenthubDashboardView[]
}>()

const current = defineModel<StudenthubDashboardViewKey>()
</script>

<template>
  <div class="sh-dash-switch" role="group" :aria-label="$t('Dashboard view')">
    <button
      v-for="view in views"
      :key="view.value"
      type="button"
      :aria-pressed="current === view.value"
      @click="current = view.value"
    >
      {{ $t(view.label) }}
    </button>
  </div>
</template>
