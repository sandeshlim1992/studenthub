<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref, watch } from 'vue'

// Student Hub: the chosen customer's email on the New ticket screen ("Reply-to email" in the
// design). Read-only: replies always go to the customer's own address.
interface Props {
  customerId?: string | number | null
}

const props = defineProps<Props>()

const email = ref<string | null>(null)
let latestRequest = 0

watch(
  () => props.customerId,
  (customerId) => {
    latestRequest += 1
    const request = latestRequest
    email.value = null

    // A typed-in address (a new customer) is not an id yet.
    if (!customerId || !/^\d+$/.test(String(customerId))) {
      if (customerId) email.value = String(customerId)
      return
    }

    // fetch can throw at once (tests), so start it inside the promise chain.
    Promise.resolve()
      .then(() =>
        fetch(`/api/v1/users/${customerId}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        }),
      )
      .then((response) => (response.ok ? response.json() : null))
      .then((user: { email?: string } | null) => {
        if (request === latestRequest) email.value = user?.email || null
      })
      .catch(() => {
        if (request === latestRequest) email.value = null
      })
  },
  { immediate: true },
)
</script>

<template>
  <dl class="sh-customer-email">
    <dt class="sh-customer-email__label">{{ $t('Reply-to email') }}</dt>
    <dd class="sh-customer-email__value" :data-empty="!email || undefined">
      {{ email || $t('Filled in from the customer') }}
    </dd>
  </dl>
</template>
