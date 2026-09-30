<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts"></script>

<template>
  <div
    class="agent-ticket-card relative overflow-hidden rounded-3xl border border-emerald-100/90 bg-white shadow-xl shadow-emerald-950/[0.04] transition-all duration-300 dark:border-neutral-700 dark:bg-neutral-800"
  >
    <!-- Top Decorative Emerald / Forest Gradient Line -->
    <div class="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400" />

    <!-- Ambient Emerald Radial Glow at the Top -->
    <div
      class="pointer-events-none absolute -top-24 inset-x-0 mx-auto h-64 w-[600px] rounded-full bg-radial from-emerald-100/40 via-emerald-50/15 to-transparent blur-2xl dark:from-emerald-950/20"
      aria-hidden="true"
    />

    <div class="@container relative z-10 flex flex-col gap-4 p-5 sm:px-8 sm:py-6 md:px-10 md:py-6">
      <!-- Elegant Header with Emerald Brand Accents (Condensed) -->
      <div class="flex flex-col items-center text-center">
        <!-- Floating Emerald Icon Badge -->
        <div
          class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-[#15803d] text-white shadow-md shadow-emerald-600/20 ring-3 ring-emerald-50 shrink-0 dark:ring-neutral-700"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
            />
          </svg>
        </div>

        <h1
          class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white"
          aria-current="page"
        >
          {{ $t('New ticket') }}
        </h1>

        <p class="mt-1 max-w-md text-xs leading-normal text-slate-500 sm:text-sm dark:text-neutral-400">
          {{
            $t(
              'Enter customer details and ticket information below to create and route a new ticket.',
            )
          }}
        </p>

        <!-- Subtle Elegant Divider with Emerald Center Node -->
        <div class="mt-3 flex w-full items-center justify-center gap-3">
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

      <!-- Form Slot (Channel Tabs, Inputs, Editor, Attachments, Dropdowns) -->
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
/* High-end Input Fields Styling (strictly excluded for channel tabs and toggle buttons) */
:deep(.formkit-outer:not(.channel-tabs-outer):not([data-type*='toggle']) .formkit-inner:not(.channel-tabs-inner):not(:has([role='tablist']))) {
  border-radius: 0.75rem !important;
  background-color: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  outline: none !important;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}

:deep(.formkit-outer:not(.channel-tabs-outer):not([data-type*='toggle']) .formkit-inner:not(.channel-tabs-inner):not(:has([role='tablist'])):hover) {
  border-color: #a7f3d0 !important;
  background-color: #ffffff !important;
  outline: none !important;
}

:deep(.formkit-outer:not(.channel-tabs-outer):not([data-type*='toggle']) .formkit-inner:not(.channel-tabs-inner):not(:has([role='tablist'])):focus-within) {
  border-color: #10b981 !important;
  background-color: #ffffff !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15) !important;
  outline: none !important;
}

/* ZERO BORDERS / ZERO BACKGROUND on FormKit wrappers for Channel Tabs */
:deep(.channel-tabs-outer),
:deep([data-type*='toggle'].formkit-outer),
:deep(.formkit-outer:has([role='tablist'])) {
  display: flex !important;
  justify-content: center !important;
  width: 100% !important;
  margin: 0 auto 0.5rem auto !important;
  border: none !important;
  border-width: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

:deep(.channel-tabs-block),
:deep([data-type*='toggle'] .formkit-block),
:deep(.channel-tabs-outer .formkit-wrapper),
:deep([data-type*='toggle'] .formkit-wrapper) {
  display: flex !important;
  justify-content: center !important;
  width: auto !important;
  border: none !important;
  border-width: 0 !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.channel-tabs-inner),
:deep(.channel-tabs-outer .formkit-inner),
:deep([data-type*='toggle'] .formkit-inner),
:deep(.formkit-outer:has([role='tablist']) .formkit-inner),
:deep(.formkit-inner:has([role='tablist'])) {
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  display: flex !important;
  justify-content: center !important;
  width: auto !important;
}

:deep(.channel-tabs-inner:hover),
:deep(.channel-tabs-outer .formkit-inner:hover),
:deep([data-type*='toggle'] .formkit-inner:hover),
:deep(.formkit-inner:has([role='tablist']):hover),
:deep(.channel-tabs-inner:focus-within),
:deep(.channel-tabs-outer .formkit-inner:focus-within),
:deep([data-type*='toggle'] .formkit-inner:focus-within),
:deep(.formkit-inner:has([role='tablist']):focus-within) {
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Hide scroll arrow buttons in toggleButtons */
:deep(.channel-tabs-outer button[class*='-translate-y-1/2']),
:deep([data-type*='toggle'] button[class*='-translate-y-1/2']),
:deep([role='tablist'] ~ button) {
  display: none !important;
}

/* The SINGLE Clean Segmented Control Tab Bar Container (EXACTLY ONE Border only!) */
:deep(.channel-tabs-strip),
:deep(.channel-tabs-inner > div),
:deep(.channel-tabs-outer .formkit-inner > div),
:deep([data-type*='toggle'] .formkit-inner > div),
:deep(.channel-tabs-outer div.bg-blue-200.rounded-full),
:deep([data-type*='toggle'] div.bg-blue-200.rounded-full) {
  background-color: #f1f5f9 !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 9999px !important;
  padding: 0.25rem !important;
  display: inline-flex !important;
  width: auto !important;
  max-width: 100% !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04) !important;
  align-items: center !important;
}

/* Tab List ul: ZERO borders, ZERO background */
:deep(.channel-tabs-outer ul),
:deep(.channel-tabs-outer ul[role='tablist']),
:deep([data-type*='toggle'] ul),
:deep([data-type*='toggle'] ul[role='tablist']),
:deep(ul[role='tablist']) {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.125rem !important;
  overflow: visible !important;
}

/* Tab List Item li: ZERO borders, ZERO background */
:deep(.channel-tabs-outer li:not(.absolute)),
:deep([data-type*='toggle'] li:not(.absolute)),
:deep(li[data-tab]) {
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Active Sliding Marker: Simple clean white pill, ZERO border */
:deep(.channel-tabs-outer li.absolute),
:deep([data-type*='toggle'] li.absolute),
:deep(li.absolute.rounded-full) {
  background: #ffffff !important;
  background-color: #ffffff !important;
  border: none !important;
  border-width: 0 !important;
  border-radius: 9999px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06) !important;
}

/* Tab Buttons: Simple text + icon, ZERO borders */
:deep(.channel-tabs-outer button),
:deep(.channel-tabs-outer [role='tab']),
:deep([data-type*='toggle'] button),
:deep([data-type*='toggle'] [role='tab']),
:deep([role='tab']) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.375rem !important;
  padding: 0.375rem 1rem !important;
  border-radius: 9999px !important;
  font-size: 0.8125rem !important;
  font-weight: 500 !important;
  letter-spacing: -0.01em !important;
  color: #475569 !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  cursor: pointer !important;
  transition: color 150ms ease !important;
  white-space: nowrap !important;
  text-decoration: none !important;
  position: relative !important;
  z-index: 10 !important;
}

:deep(.channel-tabs-outer [role='tab'] span),
:deep([data-type*='toggle'] [role='tab'] span),
:deep([role='tab'] span) {
  display: inline-block !important;
  visibility: visible !important;
  position: static !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: visible !important;
  clip: auto !important;
  color: inherit !important;
}

:deep(.channel-tabs-outer [role='tab'] svg),
:deep([data-type*='toggle'] [role='tab'] svg),
:deep([role='tab'] svg),
:deep(.channel-tabs-outer [role='tab'] .common-icon),
:deep([data-type*='toggle'] [role='tab'] .common-icon),
:deep([role='tab'] .common-icon) {
  color: #64748b !important;
  width: 1.125rem !important;
  height: 1.125rem !important;
  transition: color 150ms ease !important;
}

:deep(.channel-tabs-outer button:hover),
:deep(.channel-tabs-outer [role='tab']:hover),
:deep([data-type*='toggle'] button:hover),
:deep([data-type*='toggle'] [role='tab']:hover),
:deep([role='tab']:hover) {
  color: #0f172a !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

:deep(.channel-tabs-outer [role='tab']:hover svg),
:deep([data-type*='toggle'] [role='tab']:hover svg),
:deep([role='tab']:hover svg),
:deep(.channel-tabs-outer [role='tab']:hover .common-icon),
:deep([data-type*='toggle'] [role='tab']:hover .common-icon),
:deep([role='tab']:hover .common-icon) {
  color: #0f172a !important;
}

/* Active Selected Tab: Dark slate text, ZERO borders */
:deep(.channel-tabs-outer button[aria-selected='true']),
:deep(.channel-tabs-outer [role='tab'][aria-selected='true']),
:deep([data-type*='toggle'] button[aria-selected='true']),
:deep([data-type*='toggle'] [role='tab'][aria-selected='true']),
:deep([role='tab'][aria-selected='true']) {
  color: #0f172a !important;
  font-weight: 600 !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

:deep(.channel-tabs-outer [role='tab'][aria-selected='true'] svg),
:deep([data-type*='toggle'] [role='tab'][aria-selected='true'] svg),
:deep([role='tab'][aria-selected='true'] svg),
:deep(.channel-tabs-outer [role='tab'][aria-selected='true'] .common-icon),
:deep([data-type*='toggle'] [role='tab'][aria-selected='true'] .common-icon),
:deep([role='tab'][aria-selected='true'] .common-icon) {
  color: #0f172a !important;
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

/* Dropdowns & Selects (Group, State, Priority, etc.) */
:deep([role='combobox']),
:deep(select) {
  color: #0f172a !important;
  font-size: 0.875rem !important;
}

:deep(.formkit-inner:hover .fill-stone-200),
:deep(.formkit-inner:focus-within .fill-stone-200) {
  fill: #059669 !important;
}

/* Dark Mode Overrides */
:deep(.dark) .agent-ticket-card,
.dark :deep(.agent-ticket-card) {
  background-color: #1f2937 !important;
  border-color: #374151 !important;
}

:deep(.dark) .formkit-inner,
.dark :deep(.formkit-inner) {
  background-color: #111827 !important;
  border-color: #374151 !important;
}

:deep(.dark) input[type='text'],
.dark :deep(input[type='text']) {
  color: #f9fafb !important;
}

:deep(.dark) .formkit-label,
.dark :deep(.formkit-label) {
  color: #e5e7eb !important;
}

:deep(.dark) .editor-input-container,
.dark :deep(.editor-input-container) {
  background-color: #111827 !important;
  border-color: #374151 !important;
}

:deep(.dark) [class*='sticky'][class*='border-blue-200'],
.dark :deep([class*='sticky'][class*='border-blue-200']) {
  background-color: #1f2937 !important;
  border-color: #374151 !important;
}

:deep(.dark) .tiptap,
.dark :deep(.tiptap) {
  color: #f9fafb !important;
}

:deep(.dark) .channel-tabs-inner,
:deep(.dark) [data-type*='toggle'] .formkit-inner,
.dark :deep(.channel-tabs-inner),
.dark :deep([data-type*='toggle'] .formkit-inner) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

:deep(.dark) .channel-tabs-strip,
:deep(.dark) .channel-tabs-inner > div,
:deep(.dark) .channel-tabs-outer .formkit-inner > div,
:deep(.dark) [data-type*='toggle'] .formkit-inner > div,
:deep(.dark) .channel-tabs-outer div.bg-blue-200.rounded-full,
.dark :deep(.channel-tabs-strip),
.dark :deep(.channel-tabs-inner > div),
.dark :deep(.channel-tabs-outer .formkit-inner > div),
.dark :deep([data-type*='toggle'] .formkit-inner > div),
.dark :deep(.channel-tabs-outer div.bg-blue-200.rounded-full) {
  background-color: #111827 !important;
  border: 1px solid #374151 !important;
  box-shadow: none !important;
}

:deep(.dark) .channel-tabs-outer li.absolute,
:deep(.dark) [data-type*='toggle'] li.absolute,
.dark :deep(.channel-tabs-outer li.absolute),
.dark :deep([data-type*='toggle'] li.absolute) {
  background-color: #1f2937 !important;
  border: none !important;
  border-width: 0 !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4) !important;
}

:deep(.dark) .channel-tabs-outer button,
:deep(.dark) .channel-tabs-outer [role='tab'],
:deep(.dark) [data-type*='toggle'] button,
:deep(.dark) [data-type*='toggle'] [role='tab'],
.dark :deep(.channel-tabs-outer button),
.dark :deep(.channel-tabs-outer [role='tab']),
.dark :deep([data-type*='toggle'] button),
.dark :deep([data-type*='toggle'] [role='tab']) {
  color: #94a3b8 !important;
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
}

:deep(.dark) .channel-tabs-outer [role='tab'] svg,
:deep(.dark) [data-type*='toggle'] [role='tab'] svg,
.dark :deep(.channel-tabs-outer [role='tab'] svg),
.dark :deep([data-type*='toggle'] [role='tab'] svg) {
  color: #94a3b8 !important;
}

:deep(.dark) .channel-tabs-outer [role='tab']:hover,
:deep(.dark) [data-type*='toggle'] [role='tab']:hover,
.dark :deep(.channel-tabs-outer [role='tab']:hover),
.dark :deep([data-type*='toggle'] [role='tab']:hover) {
  color: #f1f5f9 !important;
}

:deep(.dark) .channel-tabs-outer [role='tab'][aria-selected='true'],
:deep(.dark) [data-type*='toggle'] [role='tab'][aria-selected='true'],
.dark :deep(.channel-tabs-outer [role='tab'][aria-selected='true']),
.dark :deep([data-type*='toggle'] [role='tab'][aria-selected='true']) {
  color: #f1f5f9 !important;
  background: transparent !important;
  border: none !important;
}

:deep(.dark) .channel-tabs-outer [role='tab'][aria-selected='true'] svg,
:deep(.dark) [data-type*='toggle'] [role='tab'][aria-selected='true'] svg,
.dark :deep(.channel-tabs-outer [role='tab'][aria-selected='true'] svg),
.dark :deep([data-type*='toggle'] [role='tab'][aria-selected='true'] svg) {
  color: #f1f5f9 !important;
}
</style>
