<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useId } from 'vue'

// Student Hub: one section of the staff "New ticket" screen (Who is it for?, Triage…), its
// title with a small icon in the application colour. Used as a layout component in the form schema.
interface Props {
  title: string
  icon?: string
}

defineProps<Props>()

const headingId = useId()
</script>

<template>
  <section class="sh-create-panel" :aria-labelledby="headingId">
    <h2 :id="headingId" class="sh-create-panel__title">
      <span v-if="icon" class="sh-create-panel__icon"><CommonIcon :name="icon" size="small" decorative /></span>
      {{ $t(title) }}
    </h2>
    <slot />
  </section>
</template>
