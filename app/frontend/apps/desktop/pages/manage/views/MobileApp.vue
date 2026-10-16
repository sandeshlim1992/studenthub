<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import {
  readStudenthubQuickLinks,
  STUDENTHUB_QUICK_LINK_LABEL_MAX,
  STUDENTHUB_QUICK_LINK_URL_MAX,
  STUDENTHUB_QUICK_LINKS_MAX,
  studenthubQuickLinkSite,
  type StudenthubQuickLink,
} from '#shared/utils/studenthubQuickLinks.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Administration → Manage → Mobile app (Studenthub::MobileApp). For now the quick
// links on the mobile app's Home, a label and a web address each, in this order. Saved as the
// setting "studenthub_mobile_quick_links" through Zammad's settings API, which checks them again.

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: unknown }
}

const SETTING = 'studenthub_mobile_quick_links'

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Mobile app') },
]

const { notify } = useNotifications()

const settingId = ref<number | null>(null)
const saved = ref<StudenthubQuickLink[]>([])
const links = ref<StudenthubQuickLink[]>([])
const loadError = ref<string | null>(null)
const isSaving = ref(false)
// Errors show once saving was tried, not while a new link is still being typed.
const showErrors = ref(false)

const trimmed = computed(() =>
  links.value.map(({ label, url }) => ({ label: label.trim(), url: url.trim() })),
)

const isChanged = computed(() => JSON.stringify(trimmed.value) !== JSON.stringify(saved.value))

const linkError = ({ label, url }: StudenthubQuickLink) => {
  if (!label) return __('Enter a label.')
  if (!studenthubQuickLinkSite(url)) return __('Enter a full web address, starting with https://.')

  return undefined
}

const errors = computed(() => trimmed.value.map(linkError))

const load = async () => {
  try {
    const settings = await studenthubApi<SettingRecord[]>('/api/v1/settings')
    const setting = settings.find((entry) => entry.name === SETTING)
    if (!setting) throw new Error(__('The quick links could not be loaded.'))

    settingId.value = setting.id
    saved.value = readStudenthubQuickLinks(setting.state_current?.value)
    links.value = saved.value.map((link) => ({ ...link }))
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)

const addLink = async () => {
  links.value.push({ label: '', url: 'https://' })
  await nextTick()
  document.getElementById(`quick-link-label-${links.value.length - 1}`)?.focus()
}

const move = (index: number, offset: number) => {
  const [link] = links.value.splice(index, 1)
  links.value.splice(index + offset, 0, link)
}

const remove = (index: number) => {
  links.value.splice(index, 1)
}

const save = async () => {
  showErrors.value = true
  if (!settingId.value || errors.value.some(Boolean)) return

  isSaving.value = true
  try {
    const { value } = trimmed
    await studenthubApi(`/api/v1/settings/${settingId.value}`, {
      method: 'PUT',
      body: { state_current: { value } },
    })
    saved.value = value
    links.value = value.map((link) => ({ ...link }))
    showErrors.value = false
    notify({
      id: 'quick-links-saved',
      type: NotificationTypes.Success,
      message: __('Quick links saved.'),
    })
  } catch (error) {
    notify({
      id: 'quick-links-saved',
      type: NotificationTypes.Error,
      message: (error as Error).message,
    })
  } finally {
    isSaving.value = false
  }
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm font-normal text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const labelClass = 'flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
          {{ $t('Mobile app') }}
        </h1>
        <p class="mt-1 max-w-3xl text-sm text-[var(--sh-muted)]">
          {{ $t('What students see in the mobile app on their phone.') }}
        </p>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!settingId" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <section
        v-else
        aria-labelledby="mobile-app-quick-links"
        class="flex flex-col gap-4 rounded-xl border border-[var(--sh-line)] bg-white p-5"
      >
        <div>
          <h2 id="mobile-app-quick-links" class="font-semibold text-[var(--sh-ink)]">
            {{ $t('Quick links') }}
          </h2>
          <p class="text-sm text-[var(--sh-muted)]">
            {{
              $t(
                'Links to other websites, e.g. Moodle or the timetable, on the home screen of the mobile app. Students see them in this order, up to %s.',
                STUDENTHUB_QUICK_LINKS_MAX,
              )
            }}
          </p>
        </div>

        <p
          v-if="!links.length"
          class="rounded-lg border border-dashed border-[var(--sh-line)] px-4 py-6 text-center text-sm text-[var(--sh-muted)]"
        >
          {{ $t('No quick links yet.') }}
        </p>
        <ol v-else class="flex flex-col gap-3">
          <li
            v-for="(link, index) in links"
            :key="index"
            class="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--sh-line)] p-3"
            :aria-label="$t('Link %s', index + 1)"
          >
            <label :for="`quick-link-label-${index}`" :class="labelClass">
              {{ $t('Label') }}
              <input
                :id="`quick-link-label-${index}`"
                v-model="link.label"
                type="text"
                :maxlength="STUDENTHUB_QUICK_LINK_LABEL_MAX"
                :class="inputClass"
              />
            </label>
            <label :for="`quick-link-url-${index}`" :class="[labelClass, 'grow-[2]']">
              {{ $t('Web address') }}
              <input
                :id="`quick-link-url-${index}`"
                v-model="link.url"
                type="url"
                :maxlength="STUDENTHUB_QUICK_LINK_URL_MAX"
                :class="inputClass"
              />
            </label>
            <div class="flex gap-1 pt-6">
              <CommonButton
                variant="neutral"
                size="small"
                icon="chevron-up"
                :aria-label="$t('Move link %s up', index + 1)"
                :disabled="index === 0"
                @click="move(index, -1)"
              />
              <CommonButton
                variant="neutral"
                size="small"
                icon="chevron-down"
                :aria-label="$t('Move link %s down', index + 1)"
                :disabled="index === links.length - 1"
                @click="move(index, 1)"
              />
              <CommonButton
                variant="remove"
                size="small"
                icon="trash3"
                :aria-label="$t('Remove link %s', index + 1)"
                @click="remove(index)"
              />
            </div>
            <p
              v-if="showErrors && errors[index]"
              class="w-full text-sm font-semibold text-red-700"
              role="alert"
            >
              {{ $t(errors[index]) }}
            </p>
          </li>
        </ol>

        <div class="flex flex-wrap items-center gap-3">
          <CommonButton
            variant="secondary"
            size="medium"
            prefix-icon="plus"
            :disabled="links.length >= STUDENTHUB_QUICK_LINKS_MAX"
            @click="addLink"
          >
            {{ $t('Add link') }}
          </CommonButton>
          <CommonButton
            variant="primary"
            size="medium"
            class="bg-app! text-on-app! hover:bg-app-hover!"
            :disabled="!isChanged || isSaving"
            @click="save"
          >
            {{ isSaving ? $t('Saving…') : $t('Save quick links') }}
          </CommonButton>
        </div>
      </section>
    </div>
  </LayoutContent>
</template>
