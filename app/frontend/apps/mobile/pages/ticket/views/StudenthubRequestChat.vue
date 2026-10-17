<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { i18n } from '#shared/i18n.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import {
  isAnswerValid,
  useStudenthubRequestChat,
  type RequestChatOption,
  type RequestSearchMatch,
} from '../composable/useStudenthubRequestChat.ts'
import { useStudenthubRequestSend } from '../composable/useStudenthubRequestSend.ts'

// Student Hub: New request as a chat (design B with E's search), for students; staff keep
// Zammad's New ticket form. Every visit starts a new conversation.

const FIRST_SUB_CATEGORIES = 6
const TYPED_INPUTS = ['text', 'longtext', 'number', 'date', 'datetime']

const session = useSessionStore()
const { ticketCreateEnabled } = useTicketCreateView()
const chat = useStudenthubRequestChat(() => session.user?.firstname || undefined)
const sender = useStudenthubRequestSend()

const { currentStep: step } = chat

const draft = ref('')
const invalid = ref(false)
const showAllSubCategories = ref(false)
const picked = ref<unknown[]>([])
const subject = ref('')
const isSubjectEdited = ref(false)
const isSending = ref(false)
const sendError = ref('')
const sent = ref<{ internalId: number; number: string } | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('file-input')

onMounted(() => {
  if (ticketCreateEnabled.value) chat.load()
})

const isSearchStep = computed(
  () => step.value?.id === 'category' || step.value?.id === 'subCategory',
)
const isTypedStep = computed(() => Boolean(step.value && TYPED_INPUTS.includes(step.value.input)))

const matches = computed(() => {
  if (!isSearchStep.value) return []

  const inCategory = step.value?.id === 'subCategory' ? chat.category.value?.value : undefined
  return chat.searchMatches(draft.value, inCategory)
})

const isSearching = computed(() => isSearchStep.value && draft.value.trim().length > 0)

const options = computed(() => {
  if (!step.value || isSearching.value) return []
  if (step.value.id === 'subCategory' && !showAllSubCategories.value) {
    return step.value.options.slice(0, FIRST_SUB_CATEGORIES)
  }
  return step.value.options
})

const hiddenSubCategories = computed(() =>
  step.value?.id === 'subCategory' && !showAllSubCategories.value && !isSearching.value
    ? Math.max(step.value.options.length - FIRST_SUB_CATEGORIES, 0)
    : 0,
)

const optionGroups = computed(() => {
  const groups = new Map<string, RequestChatOption[]>()
  options.value.forEach((option) => {
    const key = option.group ?? ''
    groups.set(key, [...(groups.get(key) ?? []), option])
  })
  return [...groups].map(([name, list]) => ({ name, options: list }))
})

const placeholder = computed(() => {
  if (isSearchStep.value) return i18n.t('Type a few words, e.g. ID card')
  if (step.value?.id === 'description') return i18n.t('What happened? At least 10 characters')
  return i18n.t('Your answer')
})

const inputType = computed(() => {
  if (step.value?.input === 'date') return 'date'
  if (step.value?.input === 'datetime') return 'datetime-local'
  return 'text'
})

const reset = () => {
  draft.value = ''
  invalid.value = false
  showAllSubCategories.value = false
  picked.value = []
}

const pick = (option: RequestChatOption) => {
  if (!step.value) return

  chat.answer(step.value.id, option.value, option.label)
  reset()
}

const pickMatch = (match: RequestSearchMatch) => {
  if (step.value?.id === 'subCategory') {
    chat.answer('subCategory', match.subCategory.value, match.subCategory.name)
  } else {
    chat.pickMatch(match)
  }
  reset()
}

const toggle = (option: RequestChatOption) => {
  picked.value = picked.value.includes(option.value)
    ? picked.value.filter((value) => value !== option.value)
    : [...picked.value, option.value]
}

const finishPicking = () => {
  if (!step.value) return

  const chosen = step.value.options.filter((option) => picked.value.includes(option.value))
  chat.answer(
    step.value.id,
    chosen.map((option) => option.value),
    chosen.map((option) => option.label).join(', '),
  )
  reset()
}

const typedAnswer = () => {
  const text = draft.value.trim()
  if (step.value?.input === 'number') return { value: Number(text), text }
  if (step.value?.input === 'date') return { value: text, text: i18n.date(text) }
  if (step.value?.input === 'datetime') {
    const iso = new Date(text).toISOString()
    return { value: iso, text: i18n.dateTime(iso) }
  }
  return { value: draft.value, text: draft.value.trim() }
}

const submitDraft = () => {
  if (!step.value || isSearchStep.value) return
  if (!draft.value.trim() || !isAnswerValid(step.value, draft.value)) {
    invalid.value = true
    return
  }

  const { value, text } = typedAnswer()
  chat.answer(step.value.id, value, text)
  reset()
}

const skip = () => {
  if (!step.value) return

  chat.skip(step.value.id)
  reset()
}

const change = (stepId: string) => {
  chat.change(stepId)
  isSubjectEdited.value = false
  sendError.value = ''
  reset()
}

const invalidText = computed(() => {
  if (step.value?.id === 'description') return i18n.t('Please write at least 10 characters.')
  if (step.value?.input === 'number') return i18n.t('Please enter a whole number.')
  return i18n.t('Please answer to go on.')
})

// The subject follows the answers until the student changes it.
watch(
  () => chat.request.value.subject,
  (auto) => {
    if (!isSubjectEdited.value) subject.value = auto
  },
  { immediate: true },
)

const chooseFiles = () => fileInput.value?.click()

const onFilesChosen = async () => {
  const chosen = fileInput.value?.files
  if (!chosen?.length) return

  await sender.attach(chosen)
  if (fileInput.value) fileInput.value.value = ''
}

const send = async () => {
  if (isSending.value || subject.value.trim().length < 5) return

  isSending.value = true
  sendError.value = ''
  try {
    sent.value = await sender.send({ ...chat.request.value, subject: subject.value.trim() })
  } catch (error) {
    sendError.value =
      (error as Error).message || i18n.t('Your request could not be sent. Please try again.')
  } finally {
    isSending.value = false
  }
}

// New messages come in at the bottom, as in a chat.
watch(
  () => [chat.messages.value.length, chat.isComplete.value, sent.value],
  async () => {
    await nextTick()
    window.scrollTo({ top: document.body.scrollHeight })
  },
)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header
      class="sticky top-0 z-10 flex items-center gap-2 border-b-[0.5px] border-white/10 bg-gray-600 px-2 py-2"
    >
      <CommonLink
        link="/"
        class="flex size-11 shrink-0 items-center justify-center rounded-full"
        :aria-label="$t('Close')"
      >
        <CommonIcon name="close" size="small" decorative />
      </CommonLink>
      <div class="flex min-w-0 flex-1 flex-col">
        <h1 class="truncate text-base leading-5 font-bold">{{ $t('New request') }}</h1>
        <p class="truncate text-xs leading-4 text-gray">{{ $t('Student Hub support') }}</p>
      </div>
    </header>

    <main
      class="flex flex-1 flex-col gap-2.5 px-4 pt-4 pb-36"
      role="log"
      :aria-label="$t('Conversation')"
      aria-live="polite"
    >
      <p
        v-if="!ticketCreateEnabled"
        class="self-start rounded-2xl rounded-bl-md bg-gray-500 px-3.5 py-2.5 text-base"
      >
        {{ $t('Raising requests is switched off. Please contact Student Support.') }}
      </p>
      <template v-else-if="chat.loadError.value">
        <p class="self-start rounded-2xl rounded-bl-md bg-gray-500 px-3.5 py-2.5 text-base">
          {{ $t('New request is not available right now. Please try again in a moment.') }}
        </p>
        <button
          type="button"
          class="self-start rounded-full border border-blue px-4 py-2 text-sm font-semibold"
          @click="chat.load"
        >
          {{ $t('Try again') }}
        </button>
      </template>

      <template v-else>
        <template v-for="message in chat.messages.value" :key="message.id">
          <p
            v-if="message.from === 'hub'"
            class="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-gray-500 px-3.5 py-2.5 text-base whitespace-pre-line"
          >
            {{ message.text }}
          </p>
          <div v-else class="flex max-w-[85%] flex-col items-end gap-0.5 self-end">
            <p class="rounded-2xl rounded-br-md bg-blue px-3.5 py-2.5 text-base text-white">
              {{ message.text }}
            </p>
            <button
              v-if="message.stepId && !sent"
              type="button"
              class="min-h-8 px-1 text-xs font-semibold text-gray"
              :aria-label="$t('Change: %s', message.text)"
              @click="change(message.stepId)"
            >
              {{ $t('Change') }}
            </button>
          </div>
        </template>

        <p
          v-if="chat.isWaiting.value || isSending"
          class="self-start rounded-2xl rounded-bl-md bg-gray-500 px-4 py-2.5 text-base tracking-widest"
          :aria-label="$t('Student Hub is typing')"
        >
          …
        </p>

        <div
          v-if="step && !sent && matches.length"
          class="flex flex-wrap gap-2"
          role="group"
          :aria-label="$t('Matches')"
        >
          <button
            v-for="match in matches"
            :key="`${match.category.value}:${match.subCategory.value}`"
            type="button"
            class="flex min-h-10 flex-col items-start rounded-2xl border border-blue bg-gray-500 px-3.5 py-1.5 text-start"
            @click="pickMatch(match)"
          >
            <span class="text-sm font-semibold">{{ match.subCategory.name }}</span>
            <span class="text-xs text-gray">{{ match.category.name }}</span>
          </button>
        </div>
        <p v-else-if="isSearching" class="self-start text-sm text-gray">
          {{ $t('Nothing matches. Pick a category, then choose Others.') }}
        </p>

        <div
          v-if="step && !isTypedStep && !isSearching"
          class="flex flex-col gap-2.5"
          role="group"
          :aria-label="step.prompt"
        >
          <div v-for="group in optionGroups" :key="group.name" class="flex flex-col gap-1.5">
            <span v-if="group.name" class="text-xs font-bold tracking-wide text-gray">{{
              group.name
            }}</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in group.options"
                :key="String(option.value)"
                type="button"
                class="min-h-10 rounded-full border px-3.5 text-sm font-semibold"
                :class="
                  picked.includes(option.value) ? 'border-blue bg-blue' : 'border-blue bg-gray-500'
                "
                :aria-pressed="step.input === 'multi' ? picked.includes(option.value) : undefined"
                @click="step.input === 'multi' ? toggle(option) : pick(option)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="hiddenSubCategories"
              type="button"
              class="min-h-10 rounded-full bg-gray-400 px-3.5 text-sm font-semibold"
              @click="showAllSubCategories = true"
            >
              {{ $t('Show all %s', step.options.length) }}
            </button>
            <button
              v-if="step.input === 'multi'"
              type="button"
              class="min-h-10 rounded-full bg-blue px-4 text-sm font-bold disabled:opacity-50"
              :disabled="step.required && !picked.length"
              @click="finishPicking"
            >
              {{ $t('Done') }}
            </button>
            <button
              v-if="!step.required"
              type="button"
              class="min-h-10 rounded-full bg-gray-400 px-3.5 text-sm font-semibold"
              @click="skip"
            >
              {{ $t('Skip') }}
            </button>
          </div>
        </div>

        <section
          v-if="chat.isComplete.value && !sent"
          class="flex w-[90%] flex-col gap-3 self-start rounded-2xl rounded-bl-md bg-gray-500 p-4"
          :aria-label="$t('Your request')"
        >
          <p class="text-sm text-gray">{{ $t('Here is your request. Send it?') }}</p>
          <label for="studenthub-request-subject" class="flex flex-col gap-1 text-sm font-semibold">
            {{ $t('Subject') }}
            <input
              id="studenthub-request-subject"
              v-model="subject"
              type="text"
              class="h-11 rounded-xl border border-gray-300 bg-black px-3 text-base font-normal outline-none focus:border-blue"
              @input="isSubjectEdited = true"
            />
          </label>
          <p class="text-sm">
            {{ chat.request.value.categoryName }} › {{ chat.request.value.subCategoryName }} ·
            {{ chat.request.value.campus }}
          </p>
          <ul v-if="sender.files.value.length" class="flex flex-col gap-1">
            <li
              v-for="file in sender.files.value"
              :key="file.id"
              class="flex items-center gap-2 rounded-xl bg-gray-400 px-3 py-1.5 text-sm"
            >
              <CommonIcon name="attachment" size="xs" decorative />
              <span class="grow truncate">{{ file.name }}</span>
              <button
                type="button"
                class="flex size-8 items-center justify-center"
                :aria-label="$t('Remove %s', file.name)"
                @click="sender.detach(file)"
              >
                <CommonIcon name="close-small" size="xs" decorative />
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="min-h-11 rounded-xl border border-dashed border-gray-300 text-sm font-semibold disabled:opacity-50"
            :disabled="sender.isUploading.value"
            @click="chooseFiles"
          >
            {{ sender.isUploading.value ? $t('Adding…') : $t('Add a photo or file') }}
          </button>
          <p v-if="sendError" class="text-sm font-semibold text-red" role="alert">
            {{ sendError }}
          </p>
          <button
            type="button"
            class="h-12 rounded-xl bg-blue text-base font-bold disabled:opacity-50"
            :disabled="isSending || subject.trim().length < 5"
            @click="send"
          >
            {{ isSending ? $t('Sending…') : $t('Send request') }}
          </button>
        </section>

        <section
          v-if="sent"
          class="flex w-[90%] flex-col gap-2 self-start rounded-2xl rounded-bl-md bg-green-highlight p-4"
          :aria-label="$t('Request sent')"
        >
          <p class="flex items-center gap-2 text-base font-bold text-green">
            <CommonIcon name="check" size="small" decorative />
            {{ $t('Sent as ticket #%s', sent.number) }}
          </p>
          <p class="text-sm">
            {{
              $t(
                'We will reply in Student Hub and by email. You can add to it from the ticket at any time.',
              )
            }}
          </p>
          <div class="flex gap-2 pt-1">
            <CommonLink
              :link="`/tickets/${sent.internalId}`"
              class="flex h-11 flex-1 items-center justify-center rounded-xl bg-blue font-bold"
            >
              {{ $t('View ticket') }}
            </CommonLink>
            <CommonLink
              link="/"
              class="flex h-11 items-center rounded-xl bg-gray-500 px-4 font-semibold"
            >
              {{ $t('Home') }}
            </CommonLink>
          </div>
        </section>
      </template>
    </main>

    <input
      ref="file-input"
      type="file"
      multiple
      class="hidden"
      :aria-label="$t('Add a photo or file')"
      @change="onFilesChosen"
    />

    <div
      v-if="step && !sent && (isSearchStep || isTypedStep)"
      class="fixed bottom-0 z-10 border-t-[0.5px] border-white/10 bg-gray-600 px-3 pt-2 pb-safe-1 ltr:right-0 ltr:left-0 rtl:right-0 rtl:left-0"
    >
      <p v-if="invalid" class="pb-1.5 text-sm font-semibold text-red" role="alert">
        {{ invalidText }}
      </p>
      <form class="flex items-end gap-2 pb-2" @submit.prevent="submitDraft">
        <button
          v-if="step.id === 'description'"
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-400 disabled:opacity-50"
          :aria-label="$t('Add a photo or file')"
          :disabled="sender.isUploading.value"
          @click="chooseFiles"
        >
          <CommonIcon name="attachment" size="base" decorative />
        </button>
        <textarea
          v-if="step.input === 'longtext'"
          v-model="draft"
          class="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-gray-300 bg-black px-3 py-2.5 text-base leading-5 outline-none focus:border-blue"
          rows="2"
          :aria-label="step.prompt"
          :placeholder="placeholder"
          @input="invalid = false"
        ></textarea>
        <input
          v-else
          v-model="draft"
          :type="isSearchStep ? 'search' : inputType"
          :inputmode="step.input === 'number' ? 'numeric' : undefined"
          class="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-black px-3 text-base outline-none focus:border-blue"
          :aria-label="isSearchStep ? $t('Search what you need help with') : step.prompt"
          :placeholder="placeholder"
          @input="invalid = false"
        />
        <button
          v-if="!isSearchStep"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue text-white disabled:opacity-50"
          type="submit"
          :disabled="!draft.trim()"
          :aria-label="$t('Send')"
        >
          <CommonIcon name="arrow-up" size="base" decorative />
        </button>
      </form>
      <ul
        v-if="step.id === 'description' && sender.files.value.length"
        class="flex flex-wrap gap-1.5 pb-2"
      >
        <li
          v-for="file in sender.files.value"
          :key="file.id"
          class="rounded-full bg-gray-400 px-2.5 py-1 text-xs"
        >
          {{ file.name }}
        </li>
      </ul>
    </div>
  </div>
</template>
