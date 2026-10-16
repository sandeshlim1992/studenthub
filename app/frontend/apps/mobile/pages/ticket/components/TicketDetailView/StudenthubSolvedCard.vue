<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useStudenthubCustomerTicket } from '../../composable/useStudenthubCustomerTicket.ts'

// Student Hub: "Did this solve your problem?" under the conversation of a resolved or closed
// request. Yes closes a resolved request and asks for the rating Feedback Collection is waiting
// for; No hands over to the chat box, whose message reopens the request.
const { overview, isBusy, isNotSolved, run } = useStudenthubCustomerTicket()
const router = useRouter()

const isSolved = ref(false)

const stage = computed(() => overview.value?.progress.stage)
const feedback = computed(() => overview.value?.feedback)

const isShown = computed(
  () => (stage.value === 'resolved' || stage.value === 'closed') && !isNotSolved.value,
)

const solved = async () => {
  if (stage.value === 'resolved' && overview.value?.actions.can_close) {
    if (!(await run('close', {}, __('Your request is closed.')))) return
  }

  isSolved.value = true
}

const notSolved = () => {
  if (overview.value?.actions.can_reopen) {
    isNotSolved.value = true
    return
  }

  router.push({ name: 'TicketCreate' })
}

const rate = (rating: number) => run('rating', { rating }, __('Thank you for your feedback.'))

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)
</script>

<template>
  <section
    v-if="isShown"
    class="mx-4 mb-4 flex flex-col gap-3 rounded-2xl bg-gray-500 p-4"
    data-test-id="studenthub-solved-card"
    aria-labelledby="studenthub-solved-title"
  >
    <template v-if="feedback?.state === 'submitted'">
      <h2 id="studenthub-solved-title" class="text-base font-bold">
        {{ $t('You rated our support') }}
      </h2>
      <span
        class="text-2xl text-yellow"
        role="img"
        :aria-label="$t('%s of 5 stars', feedback.rating)"
      >
        {{ stars(feedback.rating) }}
      </span>
    </template>

    <template v-else-if="isSolved && feedback?.state === 'awaiting'">
      <h2 id="studenthub-solved-title" class="text-base font-bold">
        {{ $t('Great! How did we do?') }}
      </h2>
      <div class="flex gap-1" role="group" :aria-label="$t('Rate our support')">
        <button
          v-for="rating in 5"
          :key="rating"
          class="flex size-11 items-center justify-center text-3xl text-gray-300"
          type="button"
          :disabled="isBusy"
          :aria-label="$t('%s of 5 stars', rating)"
          @click="rate(rating)"
        >
          ★
        </button>
      </div>
    </template>

    <h2 v-else-if="isSolved" id="studenthub-solved-title" class="text-base font-bold">
      {{ $t('Glad it is sorted. Thank you!') }}
    </h2>

    <template v-else>
      <h2 id="studenthub-solved-title" class="text-base font-bold">
        {{ $t('Did this solve your problem?') }}
      </h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          class="h-12 rounded-xl bg-green-highlight font-bold text-green"
          type="button"
          :disabled="isBusy"
          @click="solved"
        >
          {{ $t('Yes, thanks') }}
        </button>
        <button
          class="h-12 rounded-xl border-2 border-gray-300 font-bold"
          type="button"
          :disabled="isBusy"
          @click="notSolved"
        >
          {{ $t('No, still not fixed') }}
        </button>
      </div>
    </template>
  </section>
</template>
