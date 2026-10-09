<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'

// The language the Knowledge Base is shown and written in, when it has more than one.

defineProps<{ selectId: string }>()

const { knowledgeBase, localeId } = useStudenthubKnowledgeBase()
</script>

<template>
  <label
    v-if="(knowledgeBase?.locales.length ?? 0) > 1"
    :for="selectId"
    class="flex flex-col gap-1 text-xs text-[var(--sh-muted)]"
  >
    {{ $t('Language') }}
    <select
      :id="selectId"
      v-model.number="localeId"
      class="h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)]"
    >
      <option v-for="locale in knowledgeBase?.locales" :key="locale.id" :value="locale.id">
        {{ locale.name }}
      </option>
    </select>
  </label>
</template>
