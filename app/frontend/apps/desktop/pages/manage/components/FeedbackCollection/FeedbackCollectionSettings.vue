<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { feedbackApi } from './api.ts'

import type { FeedbackConfig, FeedbackSettings } from './types.ts'

const props = defineProps<{ settings: FeedbackSettings }>()
const emit = defineEmits<{ saved: [settings: FeedbackSettings] }>()

const enabled = ref(props.settings.enabled)
const form = reactive<FeedbackConfig>({ ...props.settings.config, group_ids: [...props.settings.config.group_ids] })
const skipTagsText = ref(props.settings.config.skip_tags.join(', '))
const testAddress = ref('')
const isSaving = ref(false)
const isTesting = ref(false)
const message = ref<{ kind: 'success' | 'error'; text: string } | null>(null)
const testMessage = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

const selectedChannel = computed(() => props.settings.channels.find((channel) => channel.id === form.channel_id))
const allGroups = computed(() => form.group_ids.length === 0)

const inputClass =
  'h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold'
const hintClass = 'text-xs font-normal text-slate-600 dark:text-slate-400'

const toggleGroup = (id: number) => {
  const index = form.group_ids.indexOf(id)
  if (index === -1) form.group_ids.push(id)
  else form.group_ids.splice(index, 1)
}

const save = async () => {
  isSaving.value = true
  message.value = null
  try {
    const result = await feedbackApi.saveSettings({
      enabled: enabled.value,
      config: {
        ...form,
        skip_tags: skipTagsText.value.split(',').map((tag) => tag.trim()).filter(Boolean),
      },
    })
    emit('saved', result)
    enabled.value = result.enabled
    message.value = { kind: 'success', text: __('Settings saved.') }
  } catch (error) {
    message.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isSaving.value = false
  }
}

const sendTest = async () => {
  isTesting.value = true
  testMessage.value = null
  try {
    const result = await feedbackApi.testEmail(testAddress.value || undefined)
    testMessage.value = { kind: 'success', text: `${__('Test email sent to')} ${result.sent_to}.` }
  } catch (error) {
    testMessage.value = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <form class="flex max-w-3xl flex-col gap-6" @submit.prevent="save">
    <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <label for="feedback-enabled" class="flex cursor-pointer items-start gap-3">
        <input id="feedback-enabled" v-model="enabled" type="checkbox" class="mt-1 h-4 w-4 accent-blue-800" />
        <span>
          <span class="block text-sm font-bold">{{ $t('Send feedback requests') }}</span>
          <span :class="hintClass">
            {{ $t('When on, customers get a rating email after their ticket is closed. When off, no emails go out and feedback links show "not available".') }}
          </span>
        </span>
      </label>
    </section>

    <section class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 class="text-sm font-bold">{{ $t('Sending') }}</h3>
      <label for="feedback-channel" :class="labelClass">
        {{ $t('Send through') }}
        <select id="feedback-channel" v-model="form.channel_id" :class="inputClass">
          <option :value="null">{{ $t('Choose an email channel') }}</option>
          <option v-for="channel in settings.channels" :key="channel.id" :value="channel.id">
            {{ channel.label }}{{ channel.active ? '' : ` (${$t('inactive')})` }}
          </option>
        </select>
        <span :class="hintClass">{{ $t('Feedback emails use this Student Hub email channel and its sign-in. The account must be allowed to send as the address below.') }}</span>
        <span v-if="selectedChannel && !selectedChannel.active" class="text-xs font-semibold text-amber-800 dark:text-amber-300">
          {{ $t('This channel is inactive, so no feedback emails can be sent through it.') }}
        </span>
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label for="feedback-from-name" :class="labelClass">
          {{ $t('From name') }}
          <input id="feedback-from-name" v-model="form.from_name" type="text" maxlength="150" :class="inputClass" />
        </label>
        <label for="feedback-from-email" :class="labelClass">
          {{ $t('From address') }}
          <input id="feedback-from-email" v-model="form.from_email" type="email" :class="inputClass" />
        </label>
        <label for="feedback-reply-to" :class="labelClass">
          {{ $t('Reply-to address') }}
          <input id="feedback-reply-to" v-model="form.reply_to" type="email" :class="inputClass" />
        </label>
      </div>
      <div class="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <label for="feedback-test-address" :class="labelClass">
          {{ $t('Send a test email to') }}
          <input id="feedback-test-address" v-model="testAddress" type="email" :placeholder="$t('Your own address')" :class="inputClass" />
        </label>
        <button
          type="button"
          :disabled="isTesting"
          class="h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          @click="sendTest"
        >
          {{ isTesting ? $t('Sending…') : $t('Send test email') }}
        </button>
        <span class="text-xs text-slate-600 dark:text-slate-400">{{ $t('Uses the saved settings.') }}</span>
      </div>
      <p
        v-if="testMessage"
        role="status"
        class="text-sm font-medium"
        :class="testMessage.kind === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
      >
        {{ testMessage.text }}
      </p>
    </section>

    <section class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 class="text-sm font-bold">{{ $t('Which tickets get a request') }}</h3>
      <p :class="hintClass">{{ $t('A request is sent when a ticket changes to a closed state, by an agent or by a scheduler, and all of these rules match.') }}</p>

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-semibold">{{ $t('Groups') }}</legend>
        <span :class="hintClass">{{ allGroups ? $t('All groups. Tick groups to limit requests to them.') : $t('Only the ticked groups.') }}</span>
        <div class="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          <label
            v-for="group in settings.groups"
            :key="group.id"
            :for="`feedback-group-${group.id}`"
            class="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              :id="`feedback-group-${group.id}`"
              type="checkbox"
              class="h-4 w-4 accent-blue-800"
              :checked="form.group_ids.includes(group.id)"
              @change="toggleGroup(group.id)"
            />
            <span :class="{ 'text-slate-500': !group.active }">{{ group.name }}</span>
          </label>
        </div>
      </fieldset>

      <label for="feedback-require-owner" class="flex cursor-pointer items-center gap-2 text-sm">
        <input id="feedback-require-owner" v-model="form.require_owner" type="checkbox" class="h-4 w-4 accent-blue-800" />
        {{ $t('Only when the ticket has an owner') }}
      </label>

      <label for="feedback-skip-tags" :class="labelClass">
        {{ $t('Skip tickets with these tags') }}
        <input id="feedback-skip-tags" v-model="skipTagsText" type="text" :placeholder="$t('e.g. spam, no-survey')" :class="inputClass" />
        <span :class="hintClass">{{ $t('Separate tags with commas.') }}</span>
      </label>

      <label for="feedback-resend-days" :class="labelClass">
        {{ $t("Don't ask again for the same ticket within") }}
        <span class="flex items-center gap-2">
          <input id="feedback-resend-days" v-model.number="form.resend_after_days" type="number" min="0" max="3650" class="w-28" :class="inputClass" />
          <span class="font-normal">{{ $t('days') }}</span>
        </span>
        <span :class="hintClass">{{ $t('0 asks every time a ticket is closed, including after it was reopened.') }}</span>
      </label>
    </section>

    <section class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 class="text-sm font-bold">{{ $t('After a customer answers') }}</h3>
      <label for="feedback-internal-note" class="flex cursor-pointer items-center gap-2 text-sm">
        <input id="feedback-internal-note" v-model="form.add_internal_note" type="checkbox" class="h-4 w-4 accent-blue-800" />
        {{ $t('Add the rating and comment to the ticket as an internal note') }}
      </label>
      <span :class="hintClass">{{ $t('Every agent who can open the ticket reads the note. Leave it off to keep ratings for admins only.') }}</span>
      <label for="feedback-notify-email" :class="labelClass">
        {{ $t('Also email each answer to') }}
        <input id="feedback-notify-email" v-model="form.notify_email" type="email" :placeholder="$t('Leave empty to send nothing')" :class="inputClass" />
      </label>
    </section>

    <section class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
      <span class="font-semibold">{{ $t('Feedback page address') }}:</span>
      <code class="break-all text-xs">{{ settings.feedback_url }}…</code>
      <p :class="hintClass" class="mt-1">{{ $t('Built from the system FQDN and HTTP type settings.') }}</p>
    </section>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        :disabled="isSaving"
        class="h-10 cursor-pointer rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
      >
        {{ isSaving ? $t('Saving…') : $t('Save settings') }}
      </button>
      <span
        v-if="message"
        role="status"
        class="text-sm font-medium"
        :class="message.kind === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
      >
        {{ message.text }}
      </span>
    </div>
  </form>
</template>
