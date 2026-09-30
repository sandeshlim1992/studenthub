<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { inject } from 'vue'

const switchToWizard = inject<(() => void) | null>('switchToWizard', null)
</script>

<template>
  <div
    class="customer-ticket-card relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/[0.04] transition-all duration-300 dark:border-neutral-700 dark:bg-neutral-800"
  >
    <!-- Ambient Emerald Radial Glow at the Top -->
    <div
      class="pointer-events-none absolute -top-24 inset-x-0 mx-auto h-72 w-[650px] rounded-full bg-radial from-emerald-100/50 via-emerald-50/20 to-transparent blur-2xl dark:from-emerald-950/20"
      aria-hidden="true"
    />

    <div class="@container relative z-10 flex flex-col gap-6 p-6 sm:p-8 md:p-10">
      <!-- Quick link to guided intake wizard -->
      <div v-if="switchToWizard" class="flex justify-end -mt-2 -mb-2">
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 hover:border-emerald-300 transition-all hover:-translate-y-0.5"
          @click="switchToWizard"
        >
          <span>✨</span>
          <span>{{ $t('Switch to guided wizard') }}</span>
          <span>→</span>
        </button>
      </div>
      <!-- Elegant Header with Emerald Brand Accents -->
      <div class="flex flex-col items-center text-center">
        <!-- Floating Emerald Icon Badge -->
        <div
          class="mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[#15803d] text-white shadow-lg shadow-emerald-600/25 ring-4 ring-emerald-50 shrink-0 dark:ring-neutral-700"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>

        <h1
          class="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white"
          aria-current="page"
        >
          {{ $t('Submit a Support Request') }}
        </h1>

        <p class="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-neutral-400">
          {{
            $t(
              'Please provide the details of your inquiry or issue below. Our support team will review and respond promptly.',
            )
          }}
        </p>

        <!-- Subtle Elegant Divider with Emerald Center Node -->
        <div class="mt-5 flex w-full items-center justify-center gap-3">
          <div
            class="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-emerald-200/80 dark:via-neutral-700 dark:to-emerald-800/80"
          />
          <div
            class="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900"
          />
          <div
            class="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 to-emerald-200/80 dark:via-neutral-700 dark:to-emerald-800/80"
          />
        </div>
      </div>

      <!-- Form Slot (All Inputs, Editor, Attachments, Dropdowns) -->
      <slot />

      <!-- Bottom Trust Note -->
      <div
        class="mt-2 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400 dark:border-neutral-700/80 dark:text-neutral-400"
      >
        <div
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50 text-emerald-600 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-400"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span>{{
          $t('Your request is authenticated and routed securely to official student services.')
        }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* High-end Input Fields Styling */
:deep(.formkit-inner) {
  border-radius: 0.75rem !important;
  background-color: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  outline: none !important;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}

:deep(.formkit-inner:hover) {
  border-color: #a7f3d0 !important;
  background-color: #ffffff !important;
  outline: none !important;
}

:deep(.formkit-inner:focus-within) {
  border-color: #10b981 !important;
  background-color: #ffffff !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
  outline: none !important;
}

:deep(input[type='text']) {
  background-color: transparent !important;
  color: #0f172a !important;
  font-size: 0.875rem !important;
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
  outline: none !important;
}

:deep(input[type='text']::placeholder) {
  color: #94a3b8 !important;
}

/* Form Labels & Required Marker */
:deep(.formkit-label) {
  font-size: 0.8125rem !important;
  font-weight: 700 !important;
  color: #334155 !important;
  margin-bottom: 0.375rem !important;
  letter-spacing: -0.01em !important;
}

:deep(.required::after) {
  background-color: #10b981 !important;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2) !important;
}

/* Rich Text Editor Styling */
:deep(.field-editor) {
  border-radius: 0.75rem !important;
  overflow: hidden !important;
  transition: all 150ms ease !important;
}

:deep([class*='sticky'][class*='border-blue-200']) {
  border-top-left-radius: 0.75rem !important;
  border-top-right-radius: 0.75rem !important;
  border-color: #e2e8f0 !important;
  background-color: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
  border-left: 1px solid #e2e8f0 !important;
  border-right: 1px solid #e2e8f0 !important;
  border-top: 1px solid #e2e8f0 !important;
  transition: all 150ms ease !important;
}

:deep(.editor-input-container) {
  border-bottom-left-radius: 0.75rem !important;
  border-bottom-right-radius: 0.75rem !important;
  border-color: #e2e8f0 !important;
  border-left: 1px solid #e2e8f0 !important;
  border-right: 1px solid #e2e8f0 !important;
  border-bottom: 1px solid #e2e8f0 !important;
  background-color: #ffffff !important;
  transition: all 150ms ease !important;
}

:deep(.field-editor:hover [class*='border-blue-200']),
:deep(.field-editor:hover .editor-input-container) {
  border-color: #a7f3d0 !important;
}

:deep(.field-editor:focus-within [class*='border-blue-200']),
:deep(.field-editor:focus-within .editor-input-container) {
  border-color: #10b981 !important;
}

:deep(.field-editor:focus-within) {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
}

:deep(.action-button:hover),
:deep(.action-toolbar button:hover) {
  background-color: #ecfdf5 !important;
  color: #065f46 !important;
  border-radius: 0.5rem !important;
}

:deep(.tiptap) {
  min-height: 140px !important;
  padding: 0.875rem 1rem !important;
  font-size: 0.875rem !important;
  line-height: 1.6 !important;
  color: #1e293b !important;
}

/* File Attachments Area */
:deep(.file-list-container) {
  background-color: #f8fafc !important;
  border: 1.5px dashed #cbd5e1 !important;
  border-radius: 0.75rem !important;
  padding: 0.75rem !important;
  transition: all 200ms ease !important;
}

:deep(.file-list-container:hover) {
  background-color: #f0fdf4 !important;
  border-color: #34d399 !important;
}

:deep(.file-list-container button) {
  background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  color: #047857 !important;
  font-weight: 600 !important;
  border-radius: 0.625rem !important;
  transition: all 150ms ease !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
}

:deep(.file-list-container button:hover) {
  background-color: #10b981 !important;
  color: #ffffff !important;
  border-color: #10b981 !important;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.25) !important;
}

/* Dropdowns & Selects (Group, State) */
:deep([role='combobox']),
:deep(select) {
  color: #0f172a !important;
  font-size: 0.875rem !important;
}

:deep(.formkit-inner:hover .fill-stone-200),
:deep(.formkit-inner:focus-within .fill-stone-200) {
  fill: #059669 !important;
}
</style>
