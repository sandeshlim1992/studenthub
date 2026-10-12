<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { watchDebounced } from '@vueuse/shared'
import { ref } from 'vue'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Finds a person by name or email (Zammad's user search) and picks one: the id is the value, the
// name with the email is shown (and kept as value_completion, as the classic UI does).

interface FoundUser {
  id: number
  firstname?: string | null
  lastname?: string | null
  email?: string | null
  login?: string | null
}

defineProps<{ id: string }>()

const value = defineModel<string>({ required: true })
const completion = defineModel<string>('completion', { required: true })

const query = ref('')
const results = ref<{ id: string; label: string }[]>([])

const labelOf = (user: FoundUser) => {
  const name =
    [user.firstname, user.lastname].filter(Boolean).join(' ') || user.login || String(user.id)
  return user.email ? `${name} <${user.email}>` : name
}

watchDebounced(
  query,
  async (text) => {
    if (text.trim().length < 2) {
      results.value = []
      return
    }
    try {
      const users = await studenthubApi<FoundUser[]>(
        `/api/v1/users/search?query=${encodeURIComponent(text.trim())}&limit=10`,
      )
      results.value = (users ?? []).map((user) => ({ id: String(user.id), label: labelOf(user) }))
    } catch {
      results.value = []
    }
  },
  { debounce: 300 },
)

const pick = (user: { id: string; label: string }) => {
  value.value = user.id
  completion.value = user.label
  query.value = ''
  results.value = []
}

const clear = () => {
  value.value = ''
  completion.value = ''
}

const inputClass =
  'h-8 w-full rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <div class="flex min-w-60 grow flex-col gap-1.5">
    <div v-if="value" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
      <span>{{ completion || `#${value}` }}</span>
      <button type="button" class="text-xs text-[var(--sh-muted)] underline" @click="clear">
        {{ $t('Change') }}
      </button>
    </div>
    <template v-else>
      <label :for="id">
        <span class="sr-only">{{ $t('Find a person') }}</span>
        <input
          :id="id"
          v-model="query"
          type="search"
          :class="inputClass"
          :placeholder="$t('Name or email…')"
        />
      </label>
      <ul v-if="results.length" class="flex flex-col gap-1">
        <li v-for="user in results" :key="user.id">
          <button
            type="button"
            class="w-full rounded-md px-2 py-1 text-start text-sm text-[var(--sh-ink)] hover:bg-[var(--sh-app-soft)]"
            @click="pick(user)"
          >
            {{ user.label }}
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>
