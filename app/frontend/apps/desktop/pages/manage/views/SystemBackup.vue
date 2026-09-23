<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  state_current?: { value?: unknown }
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('System') },
  { label: __('Backup') },
]

const isLoading = ref(true)
const storageMechanism = ref<string>('Database')
const copiedKey = ref<string | null>(null)

const fetchSettings = async () => {
  isLoading.value = true
  try {
    const res = await fetch('/api/v1/settings', {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (res.ok) {
      const data: SettingRecord[] = await res.json()
      const storageSetting = data.find((s) => s.name === 'storage_mechanism')
      if (storageSetting && storageSetting.state_current?.value) {
        storageMechanism.value = String(storageSetting.state_current.value)
      }
    }
  } catch {
    // Non-fatal fallback
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchSettings()
})

const cronCommand = '0 3 * * * /opt/zammad/contrib/backup/zammad_backup.sh'
const pgDumpCommand =
  'sudo -u postgres pg_dump -Fc zammad_production > zammad_backup_$(date +%Y%m%d_%H%M%S).dump'
const mySqlDumpCommand =
  'mysqldump -u root -p zammad_production | gzip > zammad_backup_$(date +%Y%m%d_%H%M%S).sql.gz'
const restoreCommand =
  '/opt/zammad/contrib/backup/zammad_restore.sh /var/tmp/zammad_backup/zammad_backup_*.tar.gz'

const copySnippet = async (text: string, key: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2500)
  } catch {
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2500)
  }
}

const isDatabaseStorage = computed(() => {
  return storageMechanism.value.toLowerCase().includes('database')
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div class="mb-2 flex items-center gap-3">
              <button
                type="button"
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                :title="__('Back to Administration')"
                :aria-label="__('Back to Administration')"
                @click="router.push('/manage')"
              >
                <CommonIcon name="arrow-left" class="h-4 w-4" />
              </button>
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
                >
                  <CommonIcon name="floppy" class="h-4 w-4" />
                </div>
                <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {{ __('Backup & Disaster Recovery') }}
                </h1>
              </div>
              <span
                class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ __('System') }}
              </span>
            </div>
            <p class="text-sm text-slate-500 ltr:ml-11 rtl:mr-11 dark:text-slate-400">
              {{
                __(
                  'Configure automated database dumps, filesystem snapshots, and verify disaster recovery protocols.',
                )
              }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <a
              href="https://docs.zammad.org/en/latest/appendix/backup-and-restore/index.html"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <span>{{ __('Official Backup Docs') }}</span>
              <CommonIcon name="arrow-up-right" class="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <!-- Storage & Strategy Overview Card -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start space-x-4 rtl:space-x-reverse">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400"
              >
                <CommonIcon name="floppy" class="h-6 w-6" />
              </div>
              <div>
                <div class="flex items-center space-x-2 rtl:space-x-reverse">
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">
                    {{ __('Storage & Backup Architecture') }}
                  </h2>
                  <span
                    class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 uppercase dark:bg-blue-900/50 dark:text-blue-300"
                  >
                    {{ storageMechanism }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{
                    isDatabaseStorage
                      ? __(
                          'Your attachments are stored directly in the database. A single database dump encapsulates all data, configuration, and files.',
                        )
                      : __(
                          'Your attachments are stored on the server filesystem. Backups must include both the database dump and the /opt/zammad/storage directory.',
                        )
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Automated Backup Script Guide -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-1 flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="gear" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Automated Backup Setup (Recommended)') }}
            </h2>
          </div>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {{
              __(
                'Zammad includes automated scripts out of the box that bundle the database, configuration files, and attachments into a unified timestamped archive.',
              )
            }}
          </p>

          <div class="space-y-4">
            <!-- Step 1: Config -->
            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('1. Configuration File') }}
              </span>
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {{
                  __('Configure target directory, retention hold days, and notification email in:')
                }}
                <code
                  class="text-2xs rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-800 ltr:ml-1 rtl:mr-1 dark:bg-slate-700 dark:text-slate-200"
                >
                  /opt/zammad/contrib/backup/config
                </code>
              </p>
            </div>

            <!-- Step 2: Cron schedule -->
            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {{ __('2. Nightly Cronjob Schedule') }}
                  </span>
                  <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {{
                      __(
                        'Add this entry to root crontab (`crontab -e`) to execute backups daily at 03:00 AM:',
                      )
                    }}
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  :aria-label="__('Copy Cron Command')"
                  @click="copySnippet(cronCommand, 'cron')"
                >
                  <CommonIcon
                    :name="copiedKey === 'cron' ? 'check2' : 'clipboard'"
                    class="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1"
                  />
                  {{ copiedKey === 'cron' ? __('Copied!') : __('Copy') }}
                </button>
              </div>
              <pre
                class="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-xs text-blue-400 dark:bg-black"
                >{{ cronCommand }}</pre>
            </div>
          </div>
        </div>

        <!-- Manual Backup Commands Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- PostgreSQL Command -->
          <div
            class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
          >
            <div>
              <span
                class="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                {{ __('Manual Database Dump') }}
              </span>
              <h3 class="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {{ __('PostgreSQL Quick Export') }}
              </h3>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ __('Create a compressed binary dump of the PostgreSQL database:') }}
              </p>
              <pre
                class="text-2xs mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-slate-200 dark:bg-black"
                >{{ pgDumpCommand }}</pre>
            </div>
            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                :aria-label="__('Copy PostgreSQL Dump Command')"
                @click="copySnippet(pgDumpCommand, 'pg')"
              >
                <CommonIcon
                  :name="copiedKey === 'pg' ? 'check2' : 'clipboard'"
                  class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ copiedKey === 'pg' ? __('Copied!') : __('Copy Command') }}
              </button>
            </div>
          </div>

          <!-- MySQL Command -->
          <div
            class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
          >
            <div>
              <span
                class="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                {{ __('Manual Database Dump') }}
              </span>
              <h3 class="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {{ __('MySQL / MariaDB Export') }}
              </h3>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ __('Create a compressed SQL dump of the MySQL database:') }}
              </p>
              <pre
                class="text-2xs mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-slate-200 dark:bg-black"
                >{{ mySqlDumpCommand }}</pre>
            </div>
            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                :aria-label="__('Copy MySQL Dump Command')"
                @click="copySnippet(mySqlDumpCommand, 'mysql')"
              >
                <CommonIcon
                  :name="copiedKey === 'mysql' ? 'check2' : 'clipboard'"
                  class="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ copiedKey === 'mysql' ? __('Copied!') : __('Copy Command') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Disaster Recovery & Restore Checklist -->
        <div
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
        >
          <div class="mb-1 flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="shield-check" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 class="text-base font-bold text-slate-900 dark:text-white">
              {{ __('Disaster Recovery & Restore Procedure') }}
            </h2>
          </div>
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {{
              __(
                'To restore Zammad on an existing or newly provisioned host, follow the verified four-step restoration protocol.',
              )
            }}
          </p>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">
                {{ __('Step 1') }}
              </span>
              <h4 class="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Stop Workers') }}
              </h4>
              <p class="text-2xs mt-1 font-mono text-slate-500 dark:text-slate-400">
                <code>systemctl stop zammad</code>
              </p>
            </div>

            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">
                {{ __('Step 2') }}
              </span>
              <h4 class="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Run Restore Script') }}
              </h4>
              <p class="text-2xs mt-1 font-mono text-slate-500 dark:text-slate-400">
                <code>zammad_restore.sh &lt;file&gt;</code>
              </p>
            </div>

            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">
                {{ __('Step 3') }}
              </span>
              <h4 class="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Rebuild Search Index') }}
              </h4>
              <p class="text-2xs mt-1 font-mono text-slate-500 dark:text-slate-400">
                <code>zammad run rake searchindex:rebuild</code>
              </p>
            </div>

            <div
              class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">
                {{ __('Step 4') }}
              </span>
              <h4 class="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                {{ __('Restart Services') }}
              </h4>
              <p class="text-2xs mt-1 font-mono text-slate-500 dark:text-slate-400">
                <code>systemctl start zammad</code>
              </p>
            </div>
          </div>

          <div
            class="mt-4 flex items-center justify-between rounded-xl bg-slate-100 p-3 dark:bg-slate-800"
          >
            <span class="font-mono text-xs text-slate-700 dark:text-slate-300">
              {{ restoreCommand }}
            </span>
            <button
              type="button"
              class="shrink-0 text-xs font-semibold text-blue-600 hover:underline ltr:ml-2 rtl:mr-2 dark:text-blue-400"
              :aria-label="__('Copy Restore Command')"
              @click="copySnippet(restoreCommand, 'restore')"
            >
              {{ copiedKey === 'restore' ? __('Copied!') : __('Copy Command') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
