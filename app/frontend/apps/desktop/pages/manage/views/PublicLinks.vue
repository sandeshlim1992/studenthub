<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Public Links, moved from the classic admin: links shown under the sign-in form (and,
// if chosen, on the sign-up and password reset pages), e.g. to the IT pages or a privacy notice.

type Screen = 'login' | 'signup' | 'password_reset'

interface PublicLink {
  id: number
  title: string
  link: string
  description: string | null
  screen: Screen[]
  new_tab: boolean
  prio: number
}

const SCREENS: { value: Screen; label: string }[] = [
  { value: 'login', label: __('Sign-in page') },
  { value: 'signup', label: __('Sign-up page') },
  { value: 'password_reset', label: __('Password reset page') },
]

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Public Links') },
]

const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()

const links = ref<PublicLink[]>([])
const isLoaded = ref(false)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

// The link being edited: null = none, id 0 = new
const editing = ref<PublicLink | null>(null)
const problems = ref<string[]>([])

const sorted = computed(() => [...links.value].sort((a, b) => a.prio - b.prio || a.id - b.id))

const load = async () => {
  try {
    links.value = await studenthubApi<PublicLink[]>('/api/v1/public_links')
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    isLoaded.value = true
  }
}

onMounted(load)
onActivated(() => {
  if (isLoaded.value) void load()
})

const startNew = () => {
  problems.value = []
  editing.value = { id: 0, title: '', link: '', description: '', screen: ['login'], new_tab: true, prio: 0 }
}

const startEdit = (link: PublicLink) => {
  problems.value = []
  editing.value = { ...link, description: link.description ?? '', screen: [...link.screen] }
}

const toggleScreen = (screen: Screen) => {
  if (!editing.value) return
  editing.value.screen = editing.value.screen.includes(screen)
    ? editing.value.screen.filter((item) => item !== screen)
    : [...editing.value.screen, screen]
}

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'public-link-saved', type: NotificationTypes.Success, message })
    await load()
    return true
  } catch (error) {
    notify({ id: 'public-link-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const save = async () => {
  const link = editing.value
  if (!link) return

  const found: string[] = []
  if (!link.title.trim()) found.push(__('Enter a title.'))
  if (!link.link.trim()) found.push(__('Enter the address of the link.'))
  if (!link.screen.length) found.push(__('Choose at least one page.'))
  problems.value = found
  if (found.length) return

  const payload = {
    title: link.title.trim(),
    link: link.link.trim(),
    description: link.description?.trim() || null,
    screen: link.screen,
    new_tab: link.new_tab,
  }

  const ok = await run(
    () =>
      link.id
        ? studenthubApi(`/api/v1/public_links/${link.id}`, { method: 'PUT', body: payload })
        : studenthubApi('/api/v1/public_links', { method: 'POST', body: payload }),
    __('The link has been saved.'),
  )
  if (ok) editing.value = null
}

const remove = async (link: PublicLink) => {
  if (!(await waitForVariantConfirmation('delete'))) return
  await run(() => studenthubApi(`/api/v1/public_links/${link.id}`, { method: 'DELETE' }), __('Link deleted.'))
}

const move = (link: PublicLink, step: -1 | 1) => {
  const order = [...sorted.value]
  const index = order.findIndex((item) => item.id === link.id)
  const target = index + step
  if (target < 0 || target >= order.length) return
  ;[order[index], order[target]] = [order[target], order[index]]

  return run(
    () =>
      studenthubApi('/api/v1/public_links_prio', {
        method: 'POST',
        body: { prios: order.map((item, position) => [item.id, position + 1]) },
      }),
    __('The order has been saved.'),
  )
}

const screenLabel = (screen: Screen) => SCREENS.find((item) => item.value === screen)?.label ?? screen

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Public Links') }}</h1>
          <p class="mt-1 text-sm text-[var(--sh-muted)]">
            {{ $t('Links shown under the sign-in form, e.g. to IT help pages or a privacy notice.') }}
          </p>
        </div>
        <CommonButton
          variant="primary"
          size="medium"
          prefix-icon="plus"
          class="bg-app! text-on-app! hover:bg-app-hover!"
          :disabled="Boolean(editing)"
          @click="startNew"
        >
          {{ $t('New link') }}
        </CommonButton>
      </header>

      <form
        v-if="editing"
        class="flex flex-col gap-3 rounded-xl border border-[var(--sh-app)] bg-white p-5"
        :aria-label="editing.id ? $t('Edit link') : $t('New link')"
        novalidate
        @submit.prevent="save"
      >
        <h2 class="font-semibold text-[var(--sh-ink)]">{{ editing.id ? $t('Edit link') : $t('New link') }}</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label for="public-link-title" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Title') }}
            <input id="public-link-title" v-model="editing.title" type="text" maxlength="200" :class="inputClass" />
          </label>
          <label for="public-link-link" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
            {{ $t('Address') }}
            <input id="public-link-link" v-model="editing.link" type="url" maxlength="500" placeholder="https://" :class="inputClass" />
          </label>
        </div>
        <label for="public-link-description" class="flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]">
          {{ $t('Description (shown when pointing at the link)') }}
          <input id="public-link-description" v-model="editing.description" type="text" maxlength="200" :class="inputClass" />
        </label>
        <fieldset class="flex flex-wrap gap-4">
          <legend class="mb-1 text-sm font-semibold text-[var(--sh-ink)]">{{ $t('Shown on') }}</legend>
          <label v-for="screen in SCREENS" :key="screen.value" :for="`public-link-screen-${screen.value}`" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
            <input
              :id="`public-link-screen-${screen.value}`"
              type="checkbox"
              :checked="editing.screen.includes(screen.value)"
              @change="toggleScreen(screen.value)"
            />
            {{ $t(screen.label) }}
          </label>
        </fieldset>
        <label for="public-link-new-tab" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
          <input id="public-link-new-tab" v-model="editing.new_tab" type="checkbox" />
          {{ $t('Open in a new tab') }}
        </label>
        <CommonAlert v-if="problems.length" variant="danger" role="alert">
          <ul class="list-disc ps-4">
            <li v-for="problem in problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>
        <div class="flex justify-end gap-2">
          <CommonButton variant="secondary" size="medium" @click="editing = null">{{ $t('Cancel') }}</CommonButton>
          <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy">
            {{ $t('Save link') }}
          </CommonButton>
        </div>
      </form>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
      <p v-else-if="!links.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No links yet.') }}</p>

      <ol v-else class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
        <li v-for="(link, index) in sorted" :key="link.id" class="flex flex-wrap items-center gap-3 px-4 py-3" :aria-label="link.title">
          <div class="flex flex-col">
            <button
              type="button"
              class="rounded p-0.5 text-[var(--sh-muted)] hover:text-[var(--sh-app)] disabled:opacity-30"
              :aria-label="$t('Move %s up', link.title)"
              :disabled="index === 0 || isBusy"
              @click="move(link, -1)"
            >
              <CommonIcon name="chevron-up" size="xs" decorative />
            </button>
            <button
              type="button"
              class="rounded p-0.5 text-[var(--sh-muted)] hover:text-[var(--sh-app)] disabled:opacity-30"
              :aria-label="$t('Move %s down', link.title)"
              :disabled="index === sorted.length - 1 || isBusy"
              @click="move(link, 1)"
            >
              <CommonIcon name="chevron-down" size="xs" decorative />
            </button>
          </div>
          <div class="flex min-w-0 grow flex-col">
            <span class="font-semibold text-[var(--sh-ink)]">{{ link.title }}</span>
            <a :href="link.link" target="_blank" rel="noopener noreferrer" class="truncate text-xs text-[var(--sh-app)] hover:underline">
              {{ link.link }}
            </a>
            <span class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="screen in link.screen"
                :key="screen"
                class="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700"
              >
                {{ $t(screenLabel(screen)) }}
              </span>
            </span>
          </div>
          <CommonButton variant="neutral" size="small" icon="pencil" :aria-label="$t('Edit %s', link.title)" :disabled="Boolean(editing)" @click="startEdit(link)" />
          <CommonButton variant="remove" size="small" icon="trash3" :aria-label="$t('Delete %s', link.title)" :disabled="isBusy" @click="remove(link)" />
        </li>
      </ol>
    </div>
  </LayoutContent>
</template>
