<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'

// Student Hub: first page of the New ticket screen for managers who are also customers. A copy
// of the student portal's "How can we help?" card and category cards (TicketList.vue), in the
// application colour and without "Talk to Student Support". "Raise a New Ticket" opens the
// form, a category the step-by-step wizard.

export interface ManagerCreateCategory {
  key: string
  categoryValue: string
  label: string
  desc: string
  icon: string
}

const emit = defineEmits<{
  raise: []
  category: [category: ManagerCreateCategory]
}>()

const defaultCategories: ManagerCreateCategory[] = [
  {
    key: 'service_request',
    // eslint-disable-next-line zammad/zammad-detect-translatable-string -- value of the ticket field
    categoryValue: 'Service Request',
    label: __('Service Request'),
    desc: __('Account help, password resets, onboarding, ID cards & access'),
    icon: 'shield-user',
  },
  {
    key: 'software',
    categoryValue: 'Software',
    label: __('Software Support'),
    desc: __('MS Office, Outlook, VLE, SPSS, Windows, Wi-Fi & software licenses'),
    icon: 'laptop',
  },
  {
    key: 'hardware',
    categoryValue: 'Hardware',
    label: __('Hardware & Equipment'),
    desc: __('Laptops, desktop PCs, monitors, printers, scanners & classroom AV'),
    icon: 'devices',
  },
]

const categoryHints: Record<string, { icon: string; desc: string; key: string }> = {
  // eslint-disable-next-line zammad/zammad-detect-translatable-string -- value of the ticket field
  'Service Request': {
    icon: 'shield-user',
    desc: __('Account help, password resets, onboarding, ID cards, drive & access permissions'),
    key: 'service_request',
  },
  Software: {
    icon: 'laptop',
    desc: __('MS Office, Outlook, LSST Portal, SPSS, Windows, Wi-Fi, VPN & app licenses'),
    key: 'software',
  },
  Hardware: {
    icon: 'devices',
    desc: __('Desktop PCs, laptops, monitors, printers, scanners, attendance & AV setup'),
    key: 'hardware',
  },
}

const categories = ref<ManagerCreateCategory[]>(defaultCategories)

// Same source as the student portal's cards.
onMounted(async () => {
  try {
    const res = await fetch('/api/v1/ticket_wizard_metadata', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!res.ok) return

    const data = await res.json()
    if (!Array.isArray(data?.categories) || data.categories.length === 0) return

    categories.value = data.categories.map((c: { name: string; value: string }) => {
      const hint = categoryHints[c.value] || categoryHints[c.name]
      return {
        key: hint?.key || c.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        categoryValue: c.value,
        label: c.name,
        desc: hint?.desc || c.name,
        icon: hint?.icon || 'chat',
      }
    })
  } catch {
    // Keep the default categories.
  }
})
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <div
      class="relative overflow-hidden rounded-[28px] border border-white/[0.08] px-4.5 py-6 text-center shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:rounded-[32px] sm:px-10 sm:py-9 lg:px-12 lg:py-10"
      style="
        background:
          radial-gradient(circle at 92% 85%, rgb(255 255 255 / 0.14) 0%, rgb(255 255 255 / 0.05) 35%, transparent 65%),
          radial-gradient(circle at 12% 18%, rgb(0 0 0 / 0.18) 0%, transparent 55%),
          var(--sh-app);
      "
    >
      <div class="mb-3.5 flex items-center justify-center">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-2 ring-white/60 sm:h-14 sm:w-14 sm:p-2.5"
        >
          <img :src="studentHubLogo" alt="Student Hub" class="h-full w-full object-contain" />
        </div>
      </div>

      <div class="mb-2 flex items-center justify-center gap-2 sm:mb-2.5">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
        <span class="text-xs font-semibold tracking-[0.25em] text-[var(--sh-on-app-muted)] uppercase sm:text-sm">
          {{ $t('Begin Your Journey') }}
        </span>
      </div>

      <h1
        class="font-editorial text-2xl leading-tight font-medium tracking-normal text-[var(--sh-on-app)] sm:text-4xl lg:text-[42px]"
      >
        {{ $t('How can we help?') }}
      </h1>

      <p
        class="mx-auto mt-2 max-w-xl text-xs leading-relaxed font-light text-[var(--sh-on-app-muted)] sm:mt-2.5 sm:text-sm md:text-base"
      >
        {{
          $t(
            'Speak with our support team. We’ll help you find the right answers, resolve technical issues, and guide you through every step.',
          )
        }}
      </p>

      <div class="mt-5 flex justify-center sm:mt-6">
        <button
          type="button"
          class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[var(--sh-app)] shadow-sm transition-all duration-200 select-none hover:-translate-y-0.5 hover:bg-[var(--sh-app-soft)] hover:shadow-md active:translate-y-0 sm:w-auto sm:px-8 sm:text-base"
          @click="emit('raise')"
        >
          <span>{{ $t('Raise a New Ticket') }}</span>
          <span class="text-base leading-none" aria-hidden="true">→</span>
        </button>
      </div>
    </div>

    <div>
      <h2 class="mb-3 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
        {{ $t('Choose a Category') }}
      </h2>
      <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-5">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="group flex cursor-pointer flex-col items-center rounded-xl border border-slate-200/80 bg-white p-5 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out select-none hover:-translate-y-0.5 hover:border-[var(--sh-app-border)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] sm:p-6 lg:p-7"
          @click="emit('category', cat)"
        >
          <span
            class="mb-3.5 rounded-xl bg-slate-50/90 p-3.5 text-[var(--sh-app)] transition-colors duration-200 group-hover:bg-[var(--sh-app-soft)]"
          >
            <svg
              v-if="cat.icon === 'laptop'"
              class="h-9 w-9 transition-all duration-200 group-hover:scale-105"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <svg
              v-else-if="cat.icon === 'shield-user'"
              class="h-9 w-9 transition-all duration-200 group-hover:scale-105"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <svg
              v-else-if="cat.icon === 'devices'"
              class="h-9 w-9 transition-all duration-200 group-hover:scale-105"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="12" rx="2" />
              <line x1="6" y1="20" x2="18" y2="20" />
              <line x1="12" y1="16" x2="12" y2="20" />
            </svg>
            <svg
              v-else
              class="h-9 w-9 transition-all duration-200 group-hover:scale-105"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span
            class="text-base font-bold text-slate-900 transition-colors duration-150 group-hover:text-[var(--sh-app)]"
          >
            {{ $t(cat.label) }}
          </span>
          <span class="mt-1.5 text-xs leading-snug font-normal text-slate-500 sm:text-sm">
            {{ $t(cat.desc) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
