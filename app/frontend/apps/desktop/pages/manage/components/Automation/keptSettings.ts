// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { isExpertCondition } from './automation.ts'

// Student Hub: the simple admin editors (Triggers, Macros, Templates, SLAs, Report Profiles, Time
// Accounting) show only some keys of a condition or action set. Zammad replaces the whole set on
// save, so the keys an editor doesn't show are set aside when it opens a record and saved back with
// the ones it built: saving never deletes them. Conditions in Zammad's "expert mode" aren't edited
// by these editors at all and are saved back as they were.

export type Settings = Record<string, unknown>

export interface KeptSettings {
  // The whole set, when it is in expert mode (conditions only).
  expert: Settings | null
  // The keys the editor doesn't show.
  kept: Settings
}

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Settings) : null

export const noKeptSettings = (): KeptSettings => ({ expert: null, kept: {} })

export const keepSettings = (settings: unknown, shownKeys: readonly string[]): KeptSettings => {
  const record = asRecord(settings)
  if (!record) return noKeptSettings()
  if (isExpertCondition(record)) return { expert: record, kept: {} }

  return {
    expert: null,
    kept: Object.fromEntries(Object.entries(record).filter(([key]) => !shownKeys.includes(key))),
  }
}

// What is saved: the kept keys plus the editor's own (or the expert-mode set as it was).
export const withKeptSettings = (keptSettings: KeptSettings, built: Settings): Settings =>
  keptSettings.expert ?? { ...keptSettings.kept, ...built }
