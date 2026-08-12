<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { initializeBetaUi } from '#desktop/components/BetaUi/composables/useBetaUi.ts'

const searchQuery = ref('')
const router = useRouter()

const handleRedirect = (target: string) => {
  if (target.startsWith('/manage')) {
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
      { name: __('Users'), icon: 'user-settings', target: '/manage/users', description: __('Manage user accounts, roles, and permissions.') },
      { name: __('Groups'), icon: 'people-fill', target: '/manage/groups', description: __('Organize agents and assign ticket permissions.') },
      { name: __('Organizations'), icon: 'buildings', target: '/manage/organizations', description: __('Group users into organizations.') },
      { name: __('Overviews'), icon: 'card-list', target: '/manage/overviews', description: __('Customize ticket list views for agents.') },
      { name: __('Text Modules'), icon: 'text-modules', target: '/manage/text_modules', description: __('Pre-written text snippets for fast replies.') },
      { name: __('Macros'), icon: 'lightning', target: '/manage/macros', description: __('Run multiple ticket actions with one click.') },
      { name: __('Templates'), icon: 'file', target: '/manage/templates', description: __('Predefined templates for new tickets.') },
      { name: __('Checklists'), icon: 'check2-square', target: '/manage/checklists', description: __('Create task checklists for tickets.') },
      { name: __('Service Level Agreements'), icon: 'clock', target: '/manage/slas', description: __('Define response, update, and solution time goals.') },
      { name: __('Triggers'), icon: 'lightning', target: '/manage/triggers', description: __('Automated actions triggered on ticket creation or updates.') },
      { name: __('Webhooks'), icon: 'globe', target: '/manage/webhooks', description: __('Send real-time updates to external services.') },
      { name: __('Calendars'), icon: 'calendar', target: '/manage/calendars', description: __('Define business hours and holidays.') },
      { name: __('Report Profiles'), icon: 'calendar-range', target: '/#manage/report_profiles', description: __('Configure analytical reporting views.') },
      { name: __('Time Accounting'), icon: 'clock', target: '/#manage/time_accounting', description: __('Track working time spent on tickets.') },
      { name: __('Knowledge Base'), icon: 'book', target: '/#manage/knowledge_base', description: __('Manage self-service articles and FAQs.') },
    ]
  },
  {
    title: __('Channels'),
    items: [
      { name: __('Web'), icon: 'globe', target: '/#channels/web', description: __('Configure the customer ticket portal.') },
      { name: __('Email'), icon: 'envelope', target: '/#channels/email', description: __('Set up inbound and outbound email addresses.') },
      { name: __('SMS'), icon: 'sms', target: '/#channels/sms', description: __('Send notification messages via SMS.') },
      { name: __('Chat'), icon: 'chat', target: '/#channels/chat', description: __('Integrate live web chat widgets.') },
      { name: __('Google'), icon: 'google', target: '/#channels/google', description: __('Connect Google accounts for email.') },
      { name: __('Microsoft 365'), icon: 'microsoft', target: '/#channels/microsoft365', description: __('Connect Microsoft 365 accounts.') },
      { name: __('Microsoft 365 Graph'), icon: 'microsoft', target: '/#channels/microsoft_graph', description: __('Integrate via Microsoft Graph API.') },
      { name: __('Facebook'), icon: 'facebook', target: '/#channels/facebook', description: __('Connect Facebook pages.') },
      { name: __('Telegram'), icon: 'telegram', target: '/#channels/telegram', description: __('Connect Telegram bots.') },
      { name: __('WhatsApp'), icon: 'whatsapp', target: '/#channels/whatsapp', description: __('Integrate WhatsApp Business messaging.') },
      { name: __('Form'), icon: 'file', target: '/#channels/form', description: __('Configure contact and ticket forms.') },
    ]
  },
  {
    title: __('Settings'),
    items: [
      { name: __('Branding'), icon: 'color', target: '/#settings/branding', description: __('Change product name, logo, and colors.') },
      { name: __('Security'), icon: 'shield-lock', target: '/#settings/security', description: __('Set password policies and authentication.') },
      { name: __('Ticket'), icon: 'all-tickets', target: '/#settings/ticket', description: __('Configure default ticket behaviors.') },
      { name: __('System Settings'), icon: 'gear', target: '/#settings/system', description: __('Manage core application settings.') },
    ]
  },
  {
    title: __('System'),
    items: [
      { name: __('Integrations'), icon: 'code', target: '/#system/integration', description: __('Connect external integrations and tools.') },
      { name: __('Objects'), icon: 'wrench', target: '/#system/object_manager', description: __('Add custom fields to tickets, users, etc.') },
      { name: __('Core Workflows'), icon: 'split', target: '/#system/core_workflow', description: __('Define dynamic forms and page behavior.') },
      { name: __('API'), icon: 'code-slash', target: '/#system/api', description: __('Generate API tokens and manage access.') },
      { name: __('Monitoring'), icon: 'speedometer2', target: '/#system/monitoring', description: __('Check background job status and logs.') },
      { name: __('Translations'), icon: 'translate', target: '/#system/translations', description: __('Customize system translation strings.') },
      { name: __('Maintenance'), icon: 'wrench', target: '/#system/maintenance', description: __('Toggle maintenance mode and background tasks.') },
      { name: __('Data Privacy'), icon: 'eye-slash', target: '/#system/data_privacy', description: __('Manage GDPR compliance and anonymization.') },
      { name: __('Backup'), icon: 'floppy', target: '/#system/backup', description: __('Configure regular system database backups.') },
      { name: __('Packages'), icon: 'download', target: '/#system/package', description: __('Install third-party packages or addons.') },
      { name: __('Sessions'), icon: 'clock-history', target: '/#system/sessions', description: __('Monitor active logged-in user sessions.') },
      { name: __('Version'), icon: 'info-circle', target: '/#system/version', description: __('View current software build versions.') },
    ]
  },
  {
    title: __('AI'),
    items: [
      { name: __('Ticket Summary'), icon: 'magic', target: '/#ai/ticket_summary', description: __('Configure AI summary models for tickets.') },
    ]
  }
])

const filteredCategories = computed(() => {
  if (!searchQuery.value) return categories.value

  const query = searchQuery.value.toLowerCase()
  return categories.value
    .map((cat) => {
      const matchedItems = cat.items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
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
        <div class="flex items-center gap-3 mb-2">
          <button
            @click="router.back()"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ __('Administration') }}</h1>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ __('Manage and configure all settings of your helpdesk application.') }}</p>
        
        <div class="relative max-w-md">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="__('Search administration modules...')"
            class="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-[#2d3f5c] rounded-xl text-slate-900 dark:text-[#94a3b8] placeholder:text-slate-400 dark:placeholder:text-[#475569] text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e2d45] transition-all duration-150"
          />
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#475569]">
            <CommonIcon name="search" class="w-4 h-4" />
          </div>
        </div>
      </div>

      <!-- Categories and cards -->
      <div v-if="filteredCategories.length > 0" class="space-y-8">
        <div v-for="category in filteredCategories" :key="category.title" class="space-y-4">
          <h2 class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
            {{ category.title }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div
              v-for="item in category.items"
              :key="item.name"
              @click="handleRedirect(item.target)"
              class="group relative flex flex-col p-5 rounded-2xl border border-slate-200 dark:border-[#1e293b] bg-white dark:bg-[#0f172a]/40 hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 hover:border-blue-500/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden shadow-xs hover:shadow-lg hover:shadow-blue-500/5"
            >
              <!-- Card icon & header -->
              <div class="flex items-start justify-between mb-2">
                <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1e293b]/80 group-hover:bg-blue-50 dark:group-hover:bg-[#1e3a5f]/40 flex items-center justify-center text-slate-500 dark:text-[#60a5fa] group-hover:text-blue-600 group-hover:dark:text-blue-400 transition-colors">
                  <CommonIcon :name="item.icon" class="w-5 h-5" />
                </div>
                <div class="text-slate-300 dark:text-[#475569] group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors translate-x-1 -translate-y-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <CommonIcon name="arrow-right-short" class="w-5 h-5" />
                </div>
              </div>
              
              <!-- Card title & description -->
              <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 group-hover:dark:text-slate-100 transition-colors mb-1">
                {{ item.name }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
                {{ item.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
          <CommonIcon name="search" class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ __('No modules found') }}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm">{{ __('No administration modules matched your search query. Try another keyword.') }}</p>
      </div>
    </div>
  </LayoutContent>
</template>
