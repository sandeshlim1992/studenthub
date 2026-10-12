<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { KeptSettings } from './keptSettings.ts'

// Student Hub: tells the admin what a simple editor keeps without showing it (keptSettings.ts).
interface Props {
  settings: KeptSettings
}

const props = defineProps<Props>()

const keys = computed(() => Object.keys(props.settings.kept))
</script>

<template>
  <CommonAlert v-if="settings.expert" variant="info">
    {{
      $t(
        "These conditions use the classic admin's expert mode. They are kept as they are; edit them there.",
      )
    }}
  </CommonAlert>
  <CommonAlert v-else-if="keys.length" variant="info">
    <span>
      {{ $t('Kept as they are (edit them in the classic admin):') }}
      <template v-for="(key, index) in keys" :key="key">
        <code class="break-all">{{ key }}</code
        ><template v-if="index < keys.length - 1">, </template>
      </template>
    </span>
  </CommonAlert>
</template>
