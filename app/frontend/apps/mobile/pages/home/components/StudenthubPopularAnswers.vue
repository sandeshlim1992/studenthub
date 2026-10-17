<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { studenthubApi } from '#shared/utils/studenthubApi.ts'

// Student Hub: the Knowledge Base answers admins chose for Home (Administration → Manage → Mobile
// app). The server gives only those still published in the help center; each one opens in the
// app's Help articles.

interface PopularAnswer {
  id: number
  title: string
}

const answers = ref<PopularAnswer[]>([])

onMounted(async () => {
  try {
    answers.value = await studenthubApi<PopularAnswer[]>(
      '/api/v1/studenthub/mobile_app/popular_answers',
    )
  } catch {
    // Home works without them.
  }
})
</script>

<template>
  <section
    v-if="answers.length"
    aria-labelledby="studenthub-popular-answers"
    class="flex flex-col gap-2"
  >
    <h2 id="studenthub-popular-answers" class="text-lg font-extrabold">
      {{ $t('Popular answers') }}
    </h2>
    <ul class="overflow-hidden rounded-2xl bg-gray-500">
      <li v-for="answer in answers" :key="answer.id" class="border-b border-gray-400 last:border-0">
        <CommonLink
          :link="`/knowledge-base/answers/${answer.id}`"
          class="flex items-center gap-3 px-4 py-3.5"
        >
          <CommonIcon name="book" size="small" class="shrink-0 text-blue" decorative />
          <span class="grow text-base font-medium">{{ answer.title }}</span>
        </CommonLink>
      </li>
    </ul>
  </section>
</template>
