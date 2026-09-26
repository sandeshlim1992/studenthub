<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import CommonDialog from '#desktop/components/CommonDialog/CommonDialog.vue'

interface ShortcutItem {
  keys: string[]
  description: string
  note?: string
}

interface ShortcutCategory {
  title: string
  icon: string
  shortcuts: ShortcutItem[]
}

const categories: ShortcutCategory[] = [
  {
    title: __('Navigation'),
    icon: 'compass',
    shortcuts: [
      { keys: ['D', 'H'], description: __('Go to Dashboard') },
      { keys: ['O'], description: __('Go to Overviews') },
      { keys: ['S'], description: __('Focus Search bar') },
      { keys: ['A'], description: __('Toggle Notifications') },
      { keys: ['N'], description: __('Create New Ticket') },
      { keys: ['U'], description: __('Open User Menu') },
      { keys: ['?'], description: __('Open Keyboard Shortcuts') },
      { keys: ['W'], description: __('Close active tab') },
      { keys: ['Tab'], description: __('Switch to next tab') },
      { keys: ['Shift', 'Tab'], description: __('Switch to previous tab') },
      { keys: ['Shift', 'L'], description: __('Sign out') },
    ],
  },
  {
    title: __('Ticket Details'),
    icon: 'ticket',
    shortcuts: [
      { keys: ['M', 'X'], description: __('Open Note composer') },
      { keys: ['G', 'R'], description: __('Reply to latest article') },
      { keys: ['J', 'I'], description: __('Toggle internal / public note') },
      { keys: ['C'], description: __('Update ticket as closed') },
      { keys: ['.'], description: __('Copy ticket # to clipboard'), note: __('2x for title, 3x for URL') },
      { keys: ['Ctrl', 'Enter'], description: __('Submit & update ticket') },
    ],
  },
  {
    title: __('System & Theme'),
    icon: 'gear',
    shortcuts: [
      { keys: ['D'], description: __('Toggle Dark Mode') },
      { keys: ['T'], description: __('Inline Translations (Admin)') },
      { keys: ['Esc'], description: __('Close modals & dropdowns') },
    ],
  },
]
</script>

<template>
  <CommonDialog
    name="keyboard-shortcuts"
    :header-title="__('Keyboard Shortcuts')"
    header-icon="keyboard"
    class="max-w-4xl"
    :footer-action-options="{
      hideCancelButton: true,
      actionLabel: __('Close'),
    }"
  >
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-1 max-h-[70vh] overflow-y-auto">
      <div
        v-for="category in categories"
        :key="category.title"
        class="flex flex-col gap-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 p-4"
      >
        <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <CommonIcon :name="category.icon" class="text-emerald-500" />
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {{ category.title }}
          </h3>
        </div>

        <ul class="flex flex-col gap-2.5">
          <li
            v-for="(shortcut, idx) in category.shortcuts"
            :key="idx"
            class="flex items-start justify-between gap-2 text-xs"
          >
            <div class="flex flex-col">
              <span class="text-slate-700 dark:text-slate-300 font-medium">
                {{ shortcut.description }}
              </span>
              <span v-if="shortcut.note" class="text-[11px] text-slate-400 dark:text-slate-500">
                {{ shortcut.note }}
              </span>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <kbd
                v-for="key in shortcut.keys"
                :key="key"
                class="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded shadow-xs"
              >
                {{ key }}
              </kbd>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </CommonDialog>
</template>
