<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { initializeBetaUi } from '#desktop/components/BetaUi/composables/useBetaUi.ts'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

const searchQuery = ref('')
const router = useRouter()

const handleRedirect = (target: string) => {
  if (target.startsWith('/manage') || target.startsWith('/report')) {
    router.push(target)
  } else {
    const { clearSwitchAndRedirect } = initializeBetaUi()
    clearSwitchAndRedirect(target)
  }
}

interface AdminItem {
  name: string
  icon: string
  target: string
  description: string
}

interface Category {
  title: string
  items: AdminItem[]
}

const categories = ref<Category[]>([
  {
    title: __('Manage'),
    items: [
      {
        name: __('Users'),
        icon: 'user-settings',
        target: '/manage/users',
        description: __('Manage user accounts, roles, and permissions.'),
      },
      {
        name: __('Groups'),
        icon: 'people-fill',
        target: '/manage/groups',
        description: __('Organize agents and assign ticket permissions.'),
      },
      {
        name: __('Organizations'),
        icon: 'buildings',
        target: '/manage/organizations',
        description: __('Group users into organizations.'),
      },
      {
        name: __('Overviews'),
        icon: 'card-list',
        target: '/manage/overviews',
        description: __('Customize ticket list views for agents.'),
      },
      {
        name: __('Text Modules'),
        icon: 'text-modules',
        target: '/manage/text_modules',
        description: __('Pre-written text snippets for fast replies.'),
      },
      {
        name: __('Macros'),
        icon: 'lightning',
        target: '/manage/macros',
        description: __('Run multiple ticket actions with one click.'),
      },
      {
        name: __('Templates'),
        icon: 'file',
        target: '/manage/templates',
        description: __('Predefined templates for new tickets.'),
      },
      {
        name: __('Checklists'),
        icon: 'check2-square',
        target: '/manage/checklists',
        description: __('Create task checklists for tickets.'),
      },
      {
        name: __('Service Level Agreements'),
        icon: 'clock',
        target: '/manage/slas',
        description: __('Define response, update, and solution time goals.'),
      },
      {
        name: __('Triggers'),
        icon: 'lightning',
        target: '/manage/triggers',
        description: __('Automated actions triggered on ticket creation or updates.'),
      },
      {
        name: __('Webhooks'),
        icon: 'globe',
        target: '/manage/webhooks',
        description: __('Send real-time updates to external services.'),
      },
      {
        name: __('Calendars'),
        icon: 'calendar',
        target: '/manage/calendars',
        description: __('Define business hours and holidays.'),
      },
      {
        name: __('Reporting & Analytics'),
        icon: 'speedometer2',
        target: '/report',
        description: __('Interactive ticket statistics, volume trends, and CSV exports.'),
      },
      {
        name: __('Report Profiles'),
        icon: 'calendar-range',
        target: '/manage/report_profiles',
        description: __('Configure analytical reporting views.'),
      },
      {
        name: __('Time Accounting'),
        icon: 'clock',
        target: '/manage/time_accounting',
        description: __('Track working time spent on tickets.'),
      },
      {
        name: __('Knowledge Base'),
        icon: 'book',
        target: '/manage/knowledge_base',
        description: __('Manage self-service articles and FAQs.'),
      },
    ],
  },
  {
    title: __('Channels'),
    items: [
      {
        name: __('Web'),
        icon: 'globe',
        target: '/manage/channels/web',
        description: __('Configure the customer ticket portal.'),
      },
      {
        name: __('Email'),
        icon: 'envelope',
        target: '/manage/channels/email',
        description: __('Set up inbound and outbound email addresses.'),
      },
      {
        name: __('SMS'),
        icon: 'sms',
        target: '/manage/channels/sms',
        description: __('Send notification messages via SMS.'),
      },
      {
        name: __('Chat'),
        icon: 'chat',
        target: '/manage/channels/chat',
        description: __('Integrate live web chat widgets.'),
      },
      {
        name: __('Google'),
        icon: 'google',
        target: '/manage/channels/google',
        description: __('Connect Google accounts for email.'),
      },
      {
        name: __('Microsoft 365'),
        icon: 'microsoft',
        target: '/manage/channels/microsoft365',
        description: __('Connect Microsoft 365 accounts.'),
      },
      {
        name: __('Microsoft 365 Graph'),
        icon: 'microsoft',
        target: '/manage/channels/microsoft_graph',
        description: __('Integrate via Microsoft Graph API.'),
      },
      {
        name: __('Facebook'),
        icon: 'facebook',
        target: '/manage/channels/facebook',
        description: __('Connect Facebook pages.'),
      },
      {
        name: __('Telegram'),
        icon: 'telegram',
        target: '/manage/channels/telegram',
        description: __('Connect Telegram bots.'),
      },
      {
        name: __('WhatsApp'),
        icon: 'whatsapp',
        target: '/manage/channels/whatsapp',
        description: __('Integrate WhatsApp Business messaging.'),
      },
      {
        name: __('Form'),
        icon: 'file',
        target: '/manage/channels/form',
        description: __('Configure contact and ticket forms.'),
      },
    ],
  },
  {
    title: __('Settings'),
    items: [
      {
        name: __('Branding'),
        icon: 'color',
        target: '/manage/settings/branding',
        description: __('Change product name, logo, and colors.'),
      },
      {
        name: __('Security'),
        icon: 'shield-lock',
        target: '/manage/settings/security',
        description: __('Set password policies and authentication.'),
      },
      {
        name: __('Ticket'),
        icon: 'all-tickets',
        target: '/manage/settings/ticket',
        description: __('Configure default ticket behaviors.'),
      },
      {
        name: __('System Settings'),
        icon: 'gear',
        target: '/manage/settings/system',
        description: __('Manage core application settings.'),
      },
    ],
  },
  {
    title: __('System'),
    items: [
      {
        name: __('Integrations'),
        icon: 'code',
        target: '/manage/system/integrations',
        description: __('Connect external integrations and tools.'),
      },
      {
        name: __('Objects'),
        icon: 'wrench',
        target: '/manage/system/objects',
        description: __('Add custom fields to tickets, users, etc.'),
      },
      {
        name: __('Core Workflows'),
        icon: 'split',
        target: '/manage/system/core_workflows',
        description: __('Define dynamic forms and page behavior.'),
      },
      {
        name: __('API'),
        icon: 'code-slash',
        target: '/manage/system/api',
        description: __('Generate API tokens and manage access.'),
      },
      {
        name: __('Monitoring'),
        icon: 'speedometer2',
        target: '/manage/system/monitoring',
        description: __('Check background job status and logs.'),
      },
      {
        name: __('Translations'),
        icon: 'translate',
        target: '/manage/system/translations',
        description: __('Customize system translation strings.'),
      },
      {
        name: __('Maintenance'),
        icon: 'wrench',
        target: '/manage/system/maintenance',
        description: __('Toggle maintenance mode and background tasks.'),
      },
      {
        name: __('Data Privacy'),
        icon: 'eye-slash',
        target: '/manage/system/data_privacy',
        description: __('Manage GDPR compliance and anonymization.'),
      },
      {
        name: __('Backup'),
        icon: 'floppy',
        target: '/manage/system/backup',
        description: __('Configure regular system database backups.'),
      },
      {
        name: __('Packages'),
        icon: 'download',
        target: '/manage/system/packages',
        description: __('Install third-party packages or addons.'),
      },
      {
        name: __('Sessions'),
        icon: 'clock-history',
        target: '/manage/system/sessions',
        description: __('Monitor active logged-in user sessions.'),
      },
      {
        name: __('System Report'),
        icon: 'clipboard',
        target: '/manage/system/system_report',
        description: __('Export and review system diagnostics report.'),
      },
      {
        name: __('Version'),
        icon: 'info-circle',
        target: '/manage/system/version',
        description: __('View current software build versions.'),
      },
    ],
  },
  {
    title: __('AI'),
    items: [
      {
        name: __('Provider'),
        icon: 'gear',
        target: '/manage/ai/provider',
        description: __('Configure LLM providers and credentials.'),
      },
      {
        name: __('Ticket Summary'),
        icon: 'magic',
        target: '/manage/ai/ticket_summary',
        description: __('Configure AI summary models for tickets.'),
      },
      {
        name: __('Writing Assistant'),
        icon: 'smart-assist-elaborate',
        target: '/manage/ai/text_tools',
        description: __('Manage prompts for composing and rewriting.'),
      },
      {
        name: __('AI Agents'),
        icon: 'ai-agent',
        target: '/manage/ai/ai_agents',
        description: __('Automate ticket classification and workflows.'),
      },
    ],
  },
])

const filteredCategories = computed(() => {
  if (!searchQuery.value) return categories.value

  const query = searchQuery.value.toLowerCase()
  return categories.value
    .map((cat) => {
      const matchedItems = cat.items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
      )
      return {
        title: cat.title,
        items: matchedItems,
      }
    })
    .filter((cat) => cat.items.length > 0)
})

const breadcrumbItems = [{ label: __('Administration') }]
</script>

<template>
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Search area -->
      <div class="mb-8">
        <div class="mb-2 flex items-center gap-3">
          <button
            type="button"
            class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
            :title="__('Back')"
            @click="router.back()"
          >
            <CommonIcon name="arrow-left" class="h-4 w-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {{ __('Administration') }}
          </h1>
        </div>
        <p class="mb-6 text-sm text-slate-500 dark:text-slate-400">
          {{ __('Manage and configure all settings of your helpdesk application.') }}
        </p>

        <div class="relative max-w-md">
          <input
            v-model="searchQuery"
            type="text"
            :aria-label="__('Search administration modules...')"
            :placeholder="__('Search administration modules...')"
            class="w-full rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm text-slate-900 transition-all duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden ltr:pr-4 ltr:pl-10 rtl:pr-10 rtl:pl-4 dark:border-[#2d3f5c] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:placeholder:text-[#475569] dark:focus:bg-[#1e2d45]"
          />
          <div
            class="absolute top-1/2 -translate-y-1/2 text-slate-400 ltr:left-3.5 rtl:right-3.5 dark:text-[#475569]"
          >
            <CommonIcon name="search" class="h-4 w-4" />
          </div>
        </div>
      </div>

      <!-- Categories and cards -->
      <div v-if="filteredCategories.length > 0" class="space-y-8">
        <div v-for="category in filteredCategories" :key="category.title" class="space-y-4">
          <h2
            class="px-1 text-[11px] font-semibold tracking-widest text-slate-400 uppercase dark:text-slate-500"
          >
            {{ category.title }}
          </h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="item in category.items"
              :key="item.name"
              type="button"
              class="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-50 hover:shadow-lg hover:shadow-blue-500/5 dark:border-[#1e293b] dark:bg-[#0f172a]/40 dark:hover:bg-[#1e293b]/50"
              @click="handleRedirect(item.target)"
            >
              <!-- Card icon & header -->
              <div class="mb-2 flex items-start justify-between">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-[#1e293b]/80 dark:text-[#60a5fa] dark:group-hover:bg-[#1e3a5f]/40 group-hover:dark:text-blue-400"
                >
                  <CommonIcon :name="item.icon" class="h-5 w-5" />
                </div>
                <div
                  class="-translate-y-1 text-slate-300 opacity-0 transition-all transition-colors duration-200 group-hover:text-blue-500 group-hover:opacity-100 ltr:translate-x-1 rtl:-translate-x-1 dark:text-[#475569] dark:group-hover:text-blue-400"
                >
                  <CommonIcon name="arrow-right-short" class="h-5 w-5" />
                </div>
              </div>

              <!-- Card title & description -->
              <h3
                class="mb-1 text-sm font-semibold text-slate-800 transition-colors group-hover:text-slate-900 dark:text-slate-200 group-hover:dark:text-slate-100"
              >
                {{ item.name }}
              </h3>
              <p class="line-clamp-2 text-xs leading-normal text-slate-500 dark:text-slate-400">
                {{ item.description }}
              </p>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-[#1e293b] dark:text-slate-500"
        >
          <CommonIcon name="search" class="h-6 w-6" />
        </div>
        <h3 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {{ __('No modules found') }}
        </h3>
        <p class="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          {{ __('No administration modules matched your search query. Try another keyword.') }}
        </p>
      </div>
    </div>
  </LayoutContent>
</template>
