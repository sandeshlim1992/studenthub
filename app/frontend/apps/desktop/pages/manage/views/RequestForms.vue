<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import RequestFormEditor from '#desktop/pages/manage/components/RequestForms/RequestFormEditor.vue'
import RequestFormPreview from '#desktop/pages/manage/components/RequestForms/RequestFormPreview.vue'
import {
  emptyDefinition,
  type RequestForm,
  type RequestFormDefinition,
  type RequestFormOptions,
  type RequestFormStatus,
} from '#desktop/pages/manage/components/RequestForms/types.ts'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: Request forms. For a Category › Sub-category, the extra ticket fields asked for when
// someone (e.g. HR) raises a ticket under it. A form is edited as a draft next to a preview of
// the wizard step it adds to, and applies once published (Studenthub::RequestForms).

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Manage') },
  { label: __('Request forms') },
]

const STATUS_LABELS: Record<RequestFormStatus, string> = {
  draft: __('Draft'),
  published: __('Published'),
  changed: __('Unpublished changes'),
}

const STATUS_CLASSES: Record<RequestFormStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-100 text-emerald-800',
  changed: 'bg-amber-100 text-amber-800',
}

const { notify } = useNotifications()
const { waitForVariantConfirmation, waitForConfirmation } = useConfirmation()

const forms = ref<RequestForm[]>([])
const options = ref<RequestFormOptions | null>(null)
const isLoaded = ref(false)
const loadError = ref<string | null>(null)
const isBusy = ref(false)

// The form being edited: its saved state (null while new) and the draft on screen.
const editing = ref<{ saved: RequestForm | null; draft: RequestFormDefinition } | null>(null)

const load = async () => {
  try {
    const data = await studenthubApi<{ forms: RequestForm[]; options: RequestFormOptions }>(
      '/api/v1/studenthub/request_forms',
    )
    forms.value = data.forms
    options.value = data.options
    loadError.value = null
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    isLoaded.value = true
  }
}

onMounted(load)
onActivated(() => {
  if (isLoaded.value && !editing.value) void load()
})

const labelOf = (list: { value: string; label: string }[] | undefined, value: string) =>
  list?.find((option) => option.value === value)?.label ?? value

const categoryLabel = (definition: RequestFormDefinition) =>
  labelOf(options.value?.categories, definition.category)

const audience = (definition: RequestFormDefinition) => {
  const names = [
    ...definition.organization_ids.map(
      (id) => options.value?.organizations.find((item) => item.id === id)?.name,
    ),
    ...definition.role_ids.map((id) => options.value?.roles.find((item) => item.id === id)?.name),
  ].filter(Boolean)

  return names.length ? names.join(', ') : __('Everyone')
}

const copy = (definition: RequestFormDefinition): RequestFormDefinition =>
  JSON.parse(JSON.stringify(definition))

const startNew = () => {
  editing.value = { saved: null, draft: emptyDefinition() }
}

const startEdit = (form: RequestForm) => {
  editing.value = { saved: form, draft: copy(form.draft) }
}

const isDirty = computed(() => {
  if (!editing.value) return false
  return (
    JSON.stringify(editing.value.draft) !==
    JSON.stringify(editing.value.saved?.draft ?? emptyDefinition())
  )
})

// The sub-categories of the other forms (one form per sub-category).
const taken = computed(
  () =>
    new Set(
      forms.value
        .filter((form) => form.id !== editing.value?.saved?.id)
        .flatMap((form) => [form.draft, form.published])
        .filter((definition): definition is RequestFormDefinition => Boolean(definition))
        .map((definition) => `${definition.category}::${definition.sub_category}`),
    ),
)

const status = computed<RequestFormStatus>(() => {
  const saved = editing.value?.saved
  if (!saved || saved.status === 'draft') return 'draft'
  return isDirty.value ? 'changed' : saved.status
})

const run = async (action: () => Promise<RequestForm | null>, message: string) => {
  isBusy.value = true
  try {
    const result = await action()
    notify({ id: 'request-form-saved', type: NotificationTypes.Success, message })
    await load()
    if (editing.value && result) editing.value = { saved: result, draft: copy(result.draft) }
    return true
  } catch (error) {
    notify({
      id: 'request-form-error',
      type: NotificationTypes.Error,
      message: (error as Error).message,
    })
    return false
  } finally {
    isBusy.value = false
  }
}

const saveDraft = () => {
  if (!editing.value) return Promise.resolve(false)
  const { saved, draft } = editing.value

  return run(
    () =>
      saved
        ? studenthubApi<RequestForm>(`/api/v1/studenthub/request_forms/${saved.id}`, {
            method: 'PUT',
            body: { draft },
          })
        : studenthubApi<RequestForm>('/api/v1/studenthub/request_forms', {
            method: 'POST',
            body: { draft },
          }),
    __('The draft has been saved.'),
  )
}

const formAction = (path: string, message: string) => {
  const saved = editing.value?.saved
  if (!saved) return Promise.resolve(false)

  return run(
    () =>
      studenthubApi<RequestForm>(`/api/v1/studenthub/request_forms/${saved.id}/${path}`, {
        method: 'POST',
      }),
    message,
  )
}

// Publishing sends what is on screen: unsaved changes are saved first.
const publish = async () => {
  if ((isDirty.value || !editing.value?.saved) && !(await saveDraft())) return
  await formAction('publish', __('The request form has been published.'))
}

const discardChanges = async () => {
  if (!(await waitForVariantConfirmation('unsaved'))) return
  const saved = editing.value?.saved
  if (!saved) return

  if (saved.status === 'changed') {
    await formAction('discard', __('The changes have been discarded.'))
  } else if (editing.value) {
    editing.value.draft = copy(saved.draft)
  }
}

const unpublish = async () => {
  if (!(await waitForConfirmation(__('Stop using this request form? It stays here as a draft.'))))
    return
  await formAction('unpublish', __('The request form is no longer used.'))
}

const remove = async () => {
  const saved = editing.value?.saved
  if (!saved || !(await waitForVariantConfirmation('delete'))) return

  const ok = await run(async () => {
    await studenthubApi(`/api/v1/studenthub/request_forms/${saved.id}`, { method: 'DELETE' })
    return null
  }, __('The request form has been deleted.'))
  if (ok) editing.value = null
}

const close = async () => {
  if (isDirty.value && !(await waitForVariantConfirmation('unsaved'))) return
  editing.value = null
  await load()
}

const editingTitle = computed(() => {
  const draft = editing.value?.draft
  if (!draft) return ''
  return draft.title || draft.sub_category || __('New request form')
})
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <template v-if="!editing">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
              {{ $t('Request forms') }}
            </h1>
            <p class="mt-1 max-w-3xl text-sm text-[var(--sh-muted)]">
              {{
                $t(
                  'Ask for extra details when a ticket is raised under a chosen sub-category, e.g. the start date for a new starter. Forms are drafts until you publish them.',
                )
              }}
            </p>
          </div>
          <CommonButton
            variant="primary"
            size="medium"
            prefix-icon="plus"
            class="bg-app! text-on-app! hover:bg-app-hover!"
            :disabled="!options"
            @click="startNew"
          >
            {{ $t('New request form') }}
          </CommonButton>
        </header>

        <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>
        <p v-else-if="!isLoaded" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
        <p
          v-else-if="!forms.length"
          class="rounded-xl border border-dashed border-[var(--sh-line)] bg-white px-4 py-8 text-center text-sm text-[var(--sh-muted)]"
        >
          {{ $t('No request forms yet. Every sub-category uses the standard form.') }}
        </p>

        <ul
          v-else
          class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white"
        >
          <li
            v-for="form in forms"
            :key="form.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3"
            :aria-label="form.draft.title || form.draft.sub_category"
          >
            <div class="flex min-w-0 grow flex-col gap-0.5">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-[var(--sh-ink)]">{{
                  form.draft.title || form.draft.sub_category
                }}</span>
                <span
                  class="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                  :class="STATUS_CLASSES[form.status]"
                >
                  {{ $t(STATUS_LABELS[form.status]) }}
                </span>
              </span>
              <span class="text-xs text-[var(--sh-muted)]">
                {{ categoryLabel(form.draft) }} › {{ form.draft.sub_category }} ·
                {{ $t('%s field(s)', form.draft.fields.length) }} ·
                {{ $t('For: %s', $t(audience(form.draft))) }}
              </span>
              <span
                v-for="problem in form.published_problems"
                :key="problem"
                class="text-xs font-semibold text-red-700"
              >
                {{ $t('Not applied: %s', $t(problem)) }}
              </span>
            </div>
            <CommonButton
              variant="neutral"
              size="small"
              icon="pencil"
              :aria-label="$t('Edit %s', form.draft.title || form.draft.sub_category)"
              @click="startEdit(form)"
            />
          </li>
        </ul>
      </template>

      <template v-else-if="options">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              class="flex items-center gap-1 self-start text-sm font-semibold text-[var(--sh-app)] hover:underline"
              @click="close"
            >
              <CommonIcon name="chevron-left" size="xs" decorative />
              {{ $t('All request forms') }}
            </button>
            <h1
              class="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-[var(--sh-ink)]"
            >
              {{ editingTitle }}
              <span
                class="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                :class="STATUS_CLASSES[status]"
              >
                {{ $t(STATUS_LABELS[status]) }}
              </span>
            </h1>
          </div>
          <div class="flex flex-wrap gap-2">
            <CommonButton
              v-if="editing.saved"
              variant="remove"
              size="medium"
              :disabled="isBusy"
              @click="remove"
            >
              {{ $t('Delete') }}
            </CommonButton>
            <CommonButton
              v-if="editing.saved?.published"
              variant="secondary"
              size="medium"
              :disabled="isBusy"
              @click="unpublish"
            >
              {{ $t('Unpublish') }}
            </CommonButton>
            <CommonButton
              v-if="editing.saved && (isDirty || editing.saved.status === 'changed')"
              variant="secondary"
              size="medium"
              :disabled="isBusy"
              @click="discardChanges"
            >
              {{ $t('Discard changes') }}
            </CommonButton>
            <CommonButton
              variant="secondary"
              size="medium"
              :disabled="isBusy || (!isDirty && Boolean(editing.saved))"
              @click="saveDraft"
            >
              {{ $t('Save draft') }}
            </CommonButton>
            <CommonButton
              variant="primary"
              size="medium"
              class="bg-app! text-on-app! hover:bg-app-hover!"
              :disabled="isBusy || status === 'published'"
              @click="publish"
            >
              {{ editing.saved?.published ? $t('Publish changes') : $t('Publish') }}
            </CommonButton>
          </div>
        </header>

        <CommonAlert v-if="editing.saved?.published_problems.length" variant="danger" role="alert">
          {{ $t('The published form is not applied:') }}
          <ul class="list-disc ps-4">
            <li v-for="problem in editing.saved.published_problems" :key="problem">
              {{ $t(problem) }}
            </li>
          </ul>
        </CommonAlert>
        <CommonAlert
          v-if="editing.saved && !isDirty && editing.saved.problems.length"
          variant="warning"
        >
          {{ $t('Before publishing:') }}
          <ul class="list-disc ps-4">
            <li v-for="problem in editing.saved.problems" :key="problem">{{ $t(problem) }}</li>
          </ul>
        </CommonAlert>

        <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <RequestFormEditor
            :key="editing.saved?.id ?? 'new'"
            v-model="editing.draft"
            :options="options"
            :taken="taken"
          />
          <div class="lg:sticky lg:top-4">
            <RequestFormPreview
              :definition="editing.draft"
              :category-label="categoryLabel(editing.draft)"
            />
          </div>
        </div>
      </template>
    </div>
  </LayoutContent>
</template>
