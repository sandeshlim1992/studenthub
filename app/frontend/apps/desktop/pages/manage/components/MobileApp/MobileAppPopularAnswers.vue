<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

// Student Hub: the popular answers on the mobile app's Home (Studenthub::MobileApp::PopularAnswers),
// chosen from the Knowledge Base answers published in the help center. Saved as the setting
// "studenthub_mobile_popular_answers" through Zammad's settings API, which checks them again.

interface AnswerChoice {
  id: number
  title: string
  category: string
}

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: unknown }
}

const SETTING = 'studenthub_mobile_popular_answers'
const MAX_ANSWERS = 5
const MAX_RESULTS = 8

const { notify } = useNotifications()

const settingId = ref<number | null>(null)
const choices = ref<AnswerChoice[]>([])
const saved = ref<number[]>([])
const chosen = ref<number[]>([])
// Answers chosen before that are no longer published; saving leaves them out.
const unpublishedCount = ref(0)
const loadError = ref<string | null>(null)
const isLoaded = ref(false)
const isSaving = ref(false)
const query = ref('')

const choiceById = computed(() => new Map(choices.value.map((choice) => [choice.id, choice])))
const chosenAnswers = computed(() => chosen.value.flatMap((id) => choiceById.value.get(id) ?? []))
const isChanged = computed(() => chosen.value.join() !== saved.value.join())

const results = computed(() => {
  const words = query.value.trim().toLowerCase()
  if (!words) return []

  return choices.value
    .filter((choice) => !chosen.value.includes(choice.id))
    .filter((choice) => `${choice.title} ${choice.category}`.toLowerCase().includes(words))
    .slice(0, MAX_RESULTS)
})

const load = async () => {
  try {
    const [settings, answerChoices] = await Promise.all([
      studenthubApi<SettingRecord[]>('/api/v1/settings'),
      studenthubApi<AnswerChoice[]>('/api/v1/studenthub/mobile_app/answer_choices'),
    ])
    const setting = settings.find((entry) => entry.name === SETTING)
    if (!setting) throw new Error(__('The popular answers could not be loaded.'))

    const current = setting.state_current?.value
    const value = Array.isArray(current) ? (current as number[]) : []
    const published = new Set(answerChoices.map((choice) => choice.id))

    settingId.value = setting.id
    choices.value = answerChoices
    saved.value = value
    chosen.value = value.filter((id) => published.has(id))
    unpublishedCount.value = value.length - chosen.value.length
    isLoaded.value = true
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)

const add = (id: number) => {
  chosen.value.push(id)
  query.value = ''
}

const move = (index: number, offset: number) => {
  const [id] = chosen.value.splice(index, 1)
  chosen.value.splice(index + offset, 0, id)
}

const remove = (index: number) => {
  chosen.value.splice(index, 1)
}

const save = async () => {
  if (!settingId.value) return

  isSaving.value = true
  try {
    const value = [...chosen.value]
    await studenthubApi(`/api/v1/settings/${settingId.value}`, {
      method: 'PUT',
      body: { state_current: { value } },
    })
    saved.value = value
    unpublishedCount.value = 0
    notify({
      id: 'popular-answers-saved',
      type: NotificationTypes.Success,
      message: __('Popular answers saved.'),
    })
  } catch (error) {
    notify({
      id: 'popular-answers-saved',
      type: NotificationTypes.Error,
      message: (error as Error).message,
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section
    aria-labelledby="mobile-app-popular-answers"
    class="flex flex-col gap-4 rounded-xl border border-[var(--sh-line)] bg-white p-5"
  >
    <div>
      <h2 id="mobile-app-popular-answers" class="font-semibold text-[var(--sh-ink)]">
        {{ $t('Popular answers') }}
      </h2>
      <p class="text-sm text-[var(--sh-muted)]">
        {{
          $t(
            'Knowledge Base answers on the home screen of the mobile app, in this order, up to %s. Only answers published in the help center can be chosen.',
            MAX_ANSWERS,
          )
        }}
      </p>
    </div>

    <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
    <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
    <template v-else>
      <p v-if="unpublishedCount" class="text-sm font-semibold text-amber-800" role="status">
        {{
          $t(
            '%s chosen answer is no longer published. Students no longer see it; saving takes it off the list.',
            unpublishedCount,
          )
        }}
      </p>
      <p
        v-if="!chosenAnswers.length"
        class="rounded-lg border border-dashed border-[var(--sh-line)] px-4 py-6 text-center text-sm text-[var(--sh-muted)]"
      >
        {{ $t('No popular answers yet.') }}
      </p>
      <ol
        v-else
        class="flex flex-col divide-y divide-[var(--sh-line)] rounded-lg border border-[var(--sh-line)]"
      >
        <li
          v-for="(answer, index) in chosenAnswers"
          :key="answer.id"
          class="flex items-center gap-3 px-3 py-2"
          :aria-label="answer.title"
        >
          <span class="flex min-w-0 grow flex-col">
            <span class="truncate font-semibold text-[var(--sh-ink)]">{{ answer.title }}</span>
            <span class="truncate text-xs text-[var(--sh-muted)]">{{ answer.category }}</span>
          </span>
          <CommonButton
            variant="neutral"
            size="small"
            icon="chevron-up"
            :aria-label="$t('Move %s up', answer.title)"
            :disabled="index === 0"
            @click="move(index, -1)"
          />
          <CommonButton
            variant="neutral"
            size="small"
            icon="chevron-down"
            :aria-label="$t('Move %s down', answer.title)"
            :disabled="index === chosenAnswers.length - 1"
            @click="move(index, 1)"
          />
          <CommonButton
            variant="remove"
            size="small"
            icon="trash3"
            :aria-label="$t('Remove %s', answer.title)"
            @click="remove(index)"
          />
        </li>
      </ol>

      <div v-if="chosen.length < MAX_ANSWERS" class="flex flex-col gap-2">
        <label
          for="mobile-app-answer-search"
          class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]"
        >
          {{ $t('Add an answer') }}
          <input
            id="mobile-app-answer-search"
            v-model="query"
            type="search"
            :placeholder="$t('Search the published answers')"
            class="h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm font-normal text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
          />
        </label>
        <ul
          v-if="results.length"
          :aria-label="$t('Answers found')"
          class="flex flex-col divide-y divide-[var(--sh-line)] rounded-lg border border-[var(--sh-line)]"
        >
          <li v-for="choice in results" :key="choice.id" class="flex items-center gap-3 px-3 py-2">
            <span class="flex min-w-0 grow flex-col">
              <span class="truncate text-[var(--sh-ink)]">{{ choice.title }}</span>
              <span class="truncate text-xs text-[var(--sh-muted)]">{{ choice.category }}</span>
            </span>
            <CommonButton
              variant="secondary"
              size="small"
              prefix-icon="plus"
              :aria-label="$t('Add %s', choice.title)"
              @click="add(choice.id)"
            >
              {{ $t('Add') }}
            </CommonButton>
          </li>
        </ul>
        <p v-else-if="query.trim()" class="text-sm text-[var(--sh-muted)]">
          {{ $t('No published answer matches.') }}
        </p>
      </div>

      <div>
        <CommonButton
          variant="primary"
          size="medium"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          :disabled="!isChanged || isSaving || !settingId"
          @click="save"
        >
          {{ isSaving ? $t('Saving…') : $t('Save popular answers') }}
        </CommonButton>
      </div>
    </template>
  </section>
</template>
