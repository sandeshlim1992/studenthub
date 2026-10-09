<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import StudenthubRequestFormSection from '#desktop/components/StudenthubRequestForm/StudenthubRequestFormSection.vue'

import type { RequestFormDefinition } from './types.ts'

// Student Hub: the request form being edited, shown as the student wizard's Details step shows it
// (the same form component, so the fields are the real ones). "Submit" only checks the answers.

const props = defineProps<{
  definition: RequestFormDefinition
  categoryLabel: string
}>()

const width = ref<'desktop' | 'phone'>('desktop')
const section = ref<InstanceType<typeof StudenthubRequestFormSection>>()
const outcome = ref<'ok' | 'missing' | null>(null)

const hasSubCategory = computed(() => Boolean(props.definition.sub_category))

watch(
  () => props.definition.fields,
  () => {
    outcome.value = null
  },
  { deep: true },
)

const tryIt = async () => {
  const answers = await section.value?.submit()
  outcome.value = answers === null ? 'missing' : 'ok'
}
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="$t('Preview')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-[var(--sh-ink)]">
        {{ $t('Preview: as the person raising the ticket sees it') }}
      </h2>
      <div
        class="flex rounded-lg border border-[var(--sh-line)] bg-white p-0.5 text-xs font-semibold"
        role="radiogroup"
        :aria-label="$t('Screen size')"
      >
        <button
          v-for="option in ['desktop', 'phone'] as const"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="width === option"
          class="rounded-md px-2.5 py-1"
          :class="
            width === option
              ? 'bg-[var(--sh-app)] text-white'
              : 'text-[var(--sh-muted)] hover:text-[var(--sh-ink)]'
          "
          @click="width = option"
        >
          {{ option === 'desktop' ? $t('Desktop') : $t('Phone') }}
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-dashed border-[var(--sh-line)] bg-slate-100 p-3 sm:p-4">
      <div
        class="mx-auto flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        :class="width === 'phone' ? 'max-w-[390px]' : 'max-w-2xl'"
      >
        <p v-if="!hasSubCategory" class="py-10 text-center text-sm text-slate-500">
          {{ $t('Choose a category and sub-category to see the form.') }}
        </p>

        <template v-else>
          <div class="text-center">
            <p class="text-xl font-black tracking-tight text-slate-900">
              {{ $t('Provide ticket details') }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{
                $t(
                  'Review your choices below, enter a subject, and describe what you need help with.',
                )
              }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200/80 bg-slate-50 p-3">
            <p class="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
              {{ $t('Your Selections') }}
            </p>
            <div class="flex flex-wrap gap-2 text-xs font-bold text-emerald-800">
              <span class="rounded-xl border border-emerald-200 bg-white px-3 py-1.5"
                >📁 {{ categoryLabel }}</span
              >
              <span class="rounded-xl border border-emerald-200 bg-white px-3 py-1.5"
                >🏷️ {{ definition.sub_category }}</span
              >
              <span class="rounded-xl border border-emerald-200 bg-white px-3 py-1.5"
                >📍 {{ $t('Campus') }}</span
              >
            </div>
          </div>

          <StudenthubRequestFormSection
            v-if="definition.fields.length || definition.help_text"
            ref="section"
            :form="definition"
          />

          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-bold text-slate-800 sm:text-sm">
              {{ $t('Subject / Short Title') }} <span class="text-rose-500">*</span>
            </span>
            <span
              class="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-400"
            >
              {{ definition.sub_category }}
            </span>
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-bold text-slate-800 sm:text-sm">
              {{ $t('Description / Issue Details') }} <span class="text-rose-500">*</span>
            </span>
            <span
              class="h-24 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-400"
            >
              {{ $t('Describe your issue in short and simple...') }}
            </span>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <p
              v-if="outcome"
              class="grow text-xs font-semibold"
              :class="outcome === 'ok' ? 'text-emerald-700' : 'text-rose-600'"
              role="status"
            >
              {{
                outcome === 'ok'
                  ? $t('Everything required is filled in. Nothing was sent.')
                  : $t('Some required fields are empty.')
              }}
            </p>
            <button
              type="button"
              class="rounded-xl bg-[#16a34a] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#15803d]"
              @click="tryIt"
            >
              {{ $t('Submit Ticket') }} →
            </button>
          </div>
        </template>
      </div>
    </div>
    <p class="text-xs text-[var(--sh-muted)]">
      {{
        $t(
          'Fill the form in and press Submit Ticket to check the required fields. Nothing is sent.',
        )
      }}
    </p>
  </section>
</template>
