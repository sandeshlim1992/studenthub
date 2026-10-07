<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Tags, moved from the classic admin: every tag with how many tickets have it; add,
// rename (renaming to an existing tag merges the two) and delete, and whether agents may create tags.

interface TagItem {
  id: number
  name: string
  count: number
}

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Tags') },
]

const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()

const tags = ref<TagItem[] | null>(null)
const tagNew = ref(true)
const loadError = ref<string | null>(null)
const isBusy = ref(false)
const filter = ref('')
const newTag = ref('')
const renamingId = ref<number | null>(null)
const renameName = ref('')

const load = async () => {
  try {
    const [list, settings] = await Promise.all([
      studenthubApi<TagItem[]>('/api/v1/tag_list'),
      studenthubApi<{ tag_new: boolean }>('/api/v1/studenthub/tag_settings'),
    ])
    tags.value = list
    tagNew.value = settings.tag_new
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  }
}

onMounted(load)
onActivated(() => {
  if (tags.value) void load()
})

const shown = computed(() => {
  const term = filter.value.trim().toLowerCase()
  return (tags.value ?? []).filter((tag) => !term || tag.name.toLowerCase().includes(term))
})

const run = async (action: () => Promise<unknown>, message: string) => {
  isBusy.value = true
  try {
    await action()
    notify({ id: 'tag-saved', type: NotificationTypes.Success, message })
    await load()
    return true
  } catch (error) {
    notify({ id: 'tag-error', type: NotificationTypes.Error, message: (error as Error).message })
    return false
  } finally {
    isBusy.value = false
  }
}

const add = async () => {
  const name = newTag.value.trim()
  if (!name) return
  if (await run(() => studenthubApi('/api/v1/tag_list', { method: 'POST', body: { name } }), __('Tag added.'))) {
    newTag.value = ''
  }
}

const startRename = (tag: TagItem) => {
  renamingId.value = tag.id
  renameName.value = tag.name
}

const rename = async () => {
  const id = renamingId.value
  const name = renameName.value.trim()
  if (!id || !name) return

  const existing = tags.value?.find((tag) => tag.id !== id && tag.name === name)
  if (existing && !(await waitForConfirmation(__('A tag with this name exists. Merge the two into one?')))) return

  if (
    await run(
      () => studenthubApi(`/api/v1/tag_list/${id}`, { method: 'PUT', body: { id, name } }),
      existing ? __('Tags merged.') : __('Tag renamed.'),
    )
  ) {
    renamingId.value = null
  }
}

const remove = async (tag: TagItem) => {
  const question = tag.count
    ? __('Delete this tag? It is removed from all tickets that have it.')
    : __('Delete this tag?')
  if (!(await waitForConfirmation(question))) return
  await run(() => studenthubApi(`/api/v1/tag_list/${tag.id}`, { method: 'DELETE' }), __('Tag deleted.'))
}

const toggleTagNew = () =>
  run(
    () => studenthubApi('/api/v1/studenthub/tag_settings', { method: 'PUT', body: { tag_new: !tagNew.value } }),
    tagNew.value ? __('Only admins can create tags now.') : __('Agents can create tags now.'),
  )

const inputClass =
  'h-9 rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
      <header>
        <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ $t('Tags') }}</h1>
        <p class="mt-1 text-sm text-[var(--sh-muted)]">
          {{ $t('Tags on tickets, e.g. for triggers, scheduler jobs and reports.') }}
        </p>
      </header>

      <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
      <p v-else-if="!tags" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

      <template v-else>
        <section aria-labelledby="tags-setting" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5">
          <div>
            <h2 id="tags-setting" class="font-semibold text-[var(--sh-ink)]">{{ $t('Agents can create new tags') }}</h2>
            <p class="text-sm text-[var(--sh-muted)]">
              {{ tagNew ? $t('Agents may type new tags on tickets.') : $t('Agents can only pick tags from this list.') }}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
            :class="tagNew ? 'bg-[var(--sh-app)]' : 'bg-slate-300'"
            :aria-checked="tagNew"
            :aria-label="$t('Agents can create new tags')"
            :disabled="isBusy"
            @click="toggleTagNew"
          >
            <span
              class="inline-block size-5 rounded-full bg-white shadow transition-transform"
              :class="tagNew ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5' : 'ltr:translate-x-0.5 rtl:-translate-x-0.5'"
            />
          </button>
        </section>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <label for="tags-filter">
            <span class="sr-only">{{ $t('Filter tags') }}</span>
            <input id="tags-filter" v-model="filter" type="search" :class="[inputClass, 'w-64']" :placeholder="$t('Filter tags…')" />
          </label>
          <form class="flex gap-2" @submit.prevent="add">
            <label for="tags-new">
              <span class="sr-only">{{ $t('New tag') }}</span>
              <input id="tags-new" v-model="newTag" type="text" :class="[inputClass, 'w-56']" :placeholder="$t('New tag…')" />
            </label>
            <CommonButton type="submit" variant="primary" size="medium" prefix-icon="plus" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy || !newTag.trim()">
              {{ $t('Add') }}
            </CommonButton>
          </form>
        </div>

        <p class="text-sm text-[var(--sh-muted)]">{{ $t('%s of %s tags', shown.length, tags.length) }}</p>

        <ul class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
          <li v-for="tag in shown" :key="tag.id" class="flex flex-wrap items-center gap-3 px-4 py-2.5" :aria-label="tag.name">
            <form v-if="renamingId === tag.id" class="flex grow flex-wrap items-center gap-2" @submit.prevent="rename">
              <label :for="`tag-rename-${tag.id}`" class="grow">
                <span class="sr-only">{{ $t('New name') }}</span>
                <input :id="`tag-rename-${tag.id}`" v-model="renameName" type="text" :class="[inputClass, 'w-full']" />
              </label>
              <CommonButton type="submit" variant="primary" size="small" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isBusy">{{ $t('Save') }}</CommonButton>
              <CommonButton variant="secondary" size="small" @click="renamingId = null">{{ $t('Cancel') }}</CommonButton>
            </form>
            <template v-else>
              <span class="grow font-semibold text-[var(--sh-ink)]">{{ tag.name }}</span>
              <span class="text-xs text-[var(--sh-muted)] tabular-nums">{{ $t('%s tickets', tag.count) }}</span>
              <CommonButton variant="neutral" size="small" icon="pencil" :aria-label="$t('Rename %s', tag.name)" @click="startRename(tag)" />
              <CommonButton variant="remove" size="small" icon="trash3" :aria-label="$t('Delete %s', tag.name)" :disabled="isBusy" @click="remove(tag)" />
            </template>
          </li>
        </ul>
      </template>
    </div>
  </LayoutContent>
</template>
