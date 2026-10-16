<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import CommonLogo from '#shared/components/CommonLogo/CommonLogo.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <!-- Student Hub: design option 5, the product logo above a large left-aligned title. -->
  <CommonLogo class="h-14 w-auto" />
  <h1 class="mt-10 mb-6 text-4xl font-extrabold">
    {{ $t(title) }}
  </h1>
  <template v-if="$c.maintenance_mode">
    <div class="mb-4 flex items-center rounded-xl bg-red px-4 py-2 text-white">
      {{
        $t(
          'Student Hub is currently in maintenance mode. Only administrators can log in. Please wait until the maintenance window is over.',
        )
      }}
    </div>
  </template>
  <template v-if="$c.maintenance_login && $c.maintenance_login_message">
    <!-- eslint-disable vue/no-v-html -->
    <div
      class="mb-4 rounded-xl bg-green px-4 py-2 text-white"
      v-html="$c.maintenance_login_message"
    ></div>
  </template>
</template>
