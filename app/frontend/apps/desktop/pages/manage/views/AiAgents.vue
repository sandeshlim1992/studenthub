<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface SettingRecord {
  id: number
  name: string
  state_current?: {
    value?: unknown
  }
}

interface AgentTypeDefinition {
  id: string
  name: string
  description?: string
  custom?: boolean
  definition?: {
    role_description?: string
    instruction?: string
    entity_context?: {
      object_attributes?: string[]
      articles?: string
    }
  }
}

interface AgentReferenceItem {
  id: number
  name?: string
}

interface AgentReferences {
  Trigger?: AgentReferenceItem[]
  Job?: AgentReferenceItem[]
  Macro?: AgentReferenceItem[]
  [key: string]: AgentReferenceItem[] | undefined
}

interface AiAgentRecord {
  id: number
  name: string
  agent_type: string
  note?: string
  active: boolean
  definition?: {
    role_description?: string
    instruction?: string
    instruction_context?: Record<string, unknown>
    entity_context?: {
      object_attributes?: string[]
      articles?: string
    }
    result_structure?: Record<string, unknown>
  }
  action_definition?: {
    mapping?: Record<string, unknown>
    conditions?: unknown[]
  }
  type_enrichment_data?: Record<string, unknown>
  references?: AgentReferences
  created_at?: string
  updated_at?: string
}

const router = useRouter()

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('AI') },
  { label: __('AI Agents') },
]

const getCsrf = () =>
  (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || ''

const isLoading = ref(true)
const isSaving = ref(false)
const isDeletingId = ref<number | null>(null)

const errorMessage = ref('')
const successMessage = ref('')

const aiProviderEnabled = ref(false)
const agents = ref<AiAgentRecord[]>([])
const agentTypes = ref<AgentTypeDefinition[]>([])
const searchQuery = ref('')

const isLegalModalOpen = ref(false)
const isModalOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const formModalTab = ref<'basics' | 'prompt' | 'activation'>('basics')

const agentForm = ref({
  name: '',
  agent_type: 'TicketTitleRewriter',
  note: '',
  role_description: '',
  instruction: '',
  articles: 'last',
  active: true,
})

const showToast = (message: string, isError = false) => {
  if (isError) {
    errorMessage.value = message
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } else {
    successMessage.value = message
    setTimeout(() => {
      successMessage.value = ''
    }, 4000)
  }
}

const fetchAllData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [settingsRes, agentsRes, typesRes] = await Promise.all([
      fetch('/api/v1/settings', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/ai_agents', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/ai_agents/types', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (settingsRes.ok) {
      const settingsList: SettingRecord[] = await settingsRes.json()
      const providerSetting = settingsList.find((s) => s.name === 'ai_provider')
      aiProviderEnabled.value = Boolean(providerSetting?.state_current?.value)
    }

    if (typesRes.ok) {
      agentTypes.value = await typesRes.json()
    }

    if (agentsRes.ok) {
      agents.value = await agentsRes.json()
    } else {
      showToast(__('Failed to load AI agents.'), true)
    }
  } catch {
    showToast(__('Failed to connect to the server.'), true)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchAllData()
})

const filteredAgents = computed(() => {
  if (!searchQuery.value.trim()) return agents.value
  const query = searchQuery.value.toLowerCase().trim()
  return agents.value.filter(
    (agent) =>
      agent.name?.toLowerCase().includes(query) ||
      agent.agent_type?.toLowerCase().includes(query) ||
      agent.note?.toLowerCase().includes(query),
  )
})

const getAgentTypeName = (typeId: string) => {
  const found = agentTypes.value.find((t) => t.id === typeId)
  return found?.name || typeId || __('Custom AI Agent')
}

const getAgentTypeBadgeClass = (typeId: string) => {
  switch (typeId) {
    case 'TicketTitleRewriter':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
    case 'TicketPrioritizer':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    case 'TicketTagger':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
    case 'TicketCategorizer':
      return 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
    case 'TicketTextExtractor':
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300'
    case 'TicketGroupDispatcher':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }
}

const toggleAgentActive = async (agent: AiAgentRecord) => {
  const nextVal = !agent.active
  try {
    const res = await fetch(`/api/v1/ai_agents/${agent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ active: nextVal }),
    })

    if (res.ok) {
      agent.active = nextVal
      showToast(
        nextVal
          ? __('AI Agent "%s" activated.', agent.name)
          : __('AI Agent "%s" deactivated.', agent.name),
      )
    } else {
      showToast(__('Failed to update agent state.'), true)
    }
  } catch {
    showToast(__('An error occurred while updating the agent.'), true)
  }
}

const handleTypeChange = () => {
  const selected = agentTypes.value.find((t) => t.id === agentForm.value.agent_type)
  if (selected?.definition) {
    if (selected.definition.role_description) {
      agentForm.value.role_description = selected.definition.role_description
    }
    if (selected.definition.instruction) {
      agentForm.value.instruction = selected.definition.instruction
    }
    if (selected.definition.entity_context?.articles) {
      agentForm.value.articles = selected.definition.entity_context.articles
    }
  }
}

const openNewAgentModal = () => {
  isEditing.value = false
  editingId.value = null
  formModalTab.value = 'basics'

  const defaultType = agentTypes.value[0]?.id || 'TicketTitleRewriter'
  agentForm.value = {
    name: '',
    agent_type: defaultType,
    note: '',
    role_description: '',
    instruction: '',
    articles: 'last',
    active: true,
  }
  handleTypeChange()
  isModalOpen.value = true
}

const openEditAgentModal = (agent: AiAgentRecord) => {
  isEditing.value = true
  editingId.value = agent.id
  formModalTab.value = 'basics'

  agentForm.value = {
    name: agent.name || '',
    agent_type: agent.agent_type || 'TicketTitleRewriter',
    note: agent.note || '',
    role_description: agent.definition?.role_description || '',
    instruction: agent.definition?.instruction || '',
    articles: agent.definition?.entity_context?.articles || 'last',
    active: agent.active,
  }
  isModalOpen.value = true
}

const saveAgent = async () => {
  if (!agentForm.value.name.trim()) {
    showToast(__('Agent name is required.'), true)
    return
  }

  isSaving.value = true
  try {
    const payload: Record<string, unknown> = {
      name: agentForm.value.name.trim(),
      agent_type: agentForm.value.agent_type,
      note: agentForm.value.note.trim(),
      active: agentForm.value.active,
      definition: {
        role_description: agentForm.value.role_description.trim(),
        instruction: agentForm.value.instruction.trim(),
        entity_context: {
          object_attributes: ['title'],
          articles: agentForm.value.articles,
        },
      },
    }

    const url = isEditing.value ? `/api/v1/ai_agents/${editingId.value}` : '/api/v1/ai_agents'
    const method = isEditing.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      showToast(
        isEditing.value
          ? __('AI agent updated successfully.')
          : __('AI agent created successfully.'),
      )
      isModalOpen.value = false
      const agentsRes = await fetch('/api/v1/ai_agents', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (agentsRes.ok) {
        agents.value = await agentsRes.json()
      }
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || __('Failed to save AI agent.'), true)
    }
  } catch {
    showToast(__('An error occurred while saving the agent.'), true)
  } finally {
    isSaving.value = false
  }
}

const deleteAgent = async (agent: AiAgentRecord) => {
  if (!confirm(__('Are you sure you want to delete the AI agent "%s"?', agent.name))) {
    return
  }

  isDeletingId.value = agent.id
  try {
    const res = await fetch(`/api/v1/ai_agents/${agent.id}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': getCsrf(),
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (res.ok) {
      showToast(__('AI agent deleted successfully.'))
      agents.value = agents.value.filter((a) => a.id !== agent.id)
    } else {
      showToast(__('Failed to delete AI agent.'), true)
    }
  } catch {
    showToast(__('An error occurred while deleting the agent.'), true)
  } finally {
    isDeletingId.value = null
  }
}
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full max-w-6xl px-8 py-6 text-slate-800 dark:text-slate-100">
      <!-- Header -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            class="mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-300 dark:hover:bg-slate-800"
            :aria-label="__('Back to Management Overview')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="size-4" />
          </button>
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400"
          >
            <CommonIcon name="ai-agent" class="size-4" />
          </div>
          <div>
            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <h1 class="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
                {{ __('AI Agents') }}
              </h1>
              <span
                class="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
              >
                {{ __('AI Assistance') }}
              </span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{
                __(
                  'Configure autonomous AI agents that analyze incoming tickets, suggest tags, re-write titles, classify priorities, or execute custom decision workflows.',
                )
              }}
            </p>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex shrink-0 items-center space-x-3 rtl:space-x-reverse">
          <button
            type="button"
            class="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-hidden dark:border-slate-700 dark:bg-[#1e293b] dark:text-slate-200 dark:hover:bg-slate-800"
            :aria-label="__('Legal Information')"
            @click="isLegalModalOpen = true"
          >
            <CommonIcon
              name="info-circle"
              class="size-3.5 text-teal-600 ltr:mr-1.5 rtl:ml-1.5 dark:text-teal-400"
            />
            {{ __('Legal Information') }}
          </button>
        </div>
      </div>

      <!-- Feedback Notifications -->
      <div
        v-if="errorMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="alert-triangle"
            class="size-4 shrink-0 text-red-600 dark:text-red-400"
          />
          <span>{{ errorMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-red-500 hover:text-red-700"
          :aria-label="__('Dismiss')"
          @click="errorMessage = ''"
        >
          <CommonIcon name="close" class="size-3.5" />
        </button>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300"
      >
        <div class="flex items-center space-x-2 rtl:space-x-reverse">
          <CommonIcon
            name="check-circle"
            class="size-4 shrink-0 text-green-600 dark:text-green-400"
          />
          <span>{{ successMessage }}</span>
        </div>
        <button
          type="button"
          class="cursor-pointer text-green-500 hover:text-green-700"
          :aria-label="__('Dismiss')"
          @click="successMessage = ''"
        >
          <CommonIcon name="close" class="size-3.5" />
        </button>
      </div>

      <!-- Missing Provider Warning -->
      <div
        v-if="!aiProviderEnabled"
        class="mb-6 flex items-start space-x-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 rtl:space-x-reverse dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <CommonIcon
          name="alert-triangle"
          class="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div class="text-xs">
          <p class="font-semibold text-amber-900 dark:text-amber-200">
            {{ __('AI Provider Disabled') }}
          </p>
          <p class="mt-0.5 text-amber-700 dark:text-amber-300">
            {{
              __(
                'The provider configuration is disabled. Please set up the provider before proceeding in',
              )
            }}
            <router-link
              to="/manage/ai/provider"
              class="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
            >
              {{ __('AI > Provider') }}
            </router-link>
            .
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-500 shadow-xs dark:border-slate-800 dark:bg-[#1e293b] dark:text-slate-400"
      >
        <CommonIcon name="reload" class="mb-3 size-8 animate-spin text-teal-600" />
        <p class="text-xs font-medium">{{ __('Loading AI agents...') }}</p>
      </div>

      <!-- Main Agents Table Card -->
      <div
        v-else
        class="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <!-- Table Toolbar -->
        <div
          class="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
        >
          <div class="relative w-full max-w-sm">
            <span
              class="pointer-events-none absolute inset-y-0 flex items-center text-slate-400 ltr:left-3 rtl:right-3"
            >
              <CommonIcon name="search" class="size-4" />
            </span>
            <input
              id="search-ai-agents"
              v-model="searchQuery"
              type="text"
              :aria-label="__('Search AI agents')"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:bg-white focus:outline-hidden ltr:pr-3 ltr:pl-9 rtl:pr-9 rtl:pl-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-[#1e293b]"
              :placeholder="__('Search AI agents...')"
            />
          </div>

          <button
            type="button"
            class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-teal-700 focus:outline-hidden"
            @click="openNewAgentModal"
          >
            <CommonIcon name="plus" class="size-4 ltr:mr-1.5 rtl:ml-1.5" />
            {{ __('New AI Agent') }}
          </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs rtl:text-right">
            <thead
              class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
            >
              <tr>
                <th scope="col" class="px-6 py-3.5">
                  {{ __('Agent Name') }}
                </th>
                <th scope="col" class="px-6 py-3.5">
                  {{ __('Agent Type') }}
                </th>
                <th scope="col" class="px-6 py-3.5">
                  {{ __('Automation Usage') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-center">
                  {{ __('Active') }}
                </th>
                <th scope="col" class="px-6 py-3.5 text-right rtl:text-left">
                  {{ __('Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-if="filteredAgents.length === 0">
                <td
                  colspan="5"
                  class="px-6 py-12 text-center text-xs text-slate-400 dark:text-slate-500"
                >
                  <CommonIcon
                    name="ai-agent"
                    class="mx-auto mb-2 size-8 text-slate-300 dark:text-slate-600"
                  />
                  <p class="font-medium">
                    {{ __('No AI agents found.') }}
                  </p>
                </td>
              </tr>
              <tr
                v-for="agent in filteredAgents"
                :key="agent.id"
                class="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
              >
                <!-- Agent Name & Note -->
                <td class="px-6 py-4">
                  <div class="flex items-start space-x-3 rtl:space-x-reverse">
                    <div
                      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
                    >
                      <CommonIcon name="ai-agent" class="size-3.5" />
                    </div>
                    <div>
                      <p class="font-semibold text-slate-800 dark:text-slate-100">
                        {{ agent.name }}
                      </p>
                      <p
                        v-if="agent.note"
                        class="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        {{ agent.note }}
                      </p>
                    </div>
                  </div>
                </td>

                <!-- Agent Type Badge -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    :class="getAgentTypeBadgeClass(agent.agent_type)"
                  >
                    {{ getAgentTypeName(agent.agent_type) }}
                  </span>
                </td>

                <!-- References in Automations -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div
                    v-if="
                      (agent.references?.Trigger && agent.references.Trigger.length > 0) ||
                      (agent.references?.Job && agent.references.Job.length > 0) ||
                      (agent.references?.Macro && agent.references.Macro.length > 0)
                    "
                    class="flex flex-wrap gap-1.5"
                  >
                    <span
                      v-if="agent.references?.Trigger?.length"
                      class="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                      {{ __('Triggers') }} ({{ agent.references.Trigger.length }})
                    </span>
                    <span
                      v-if="agent.references?.Job?.length"
                      class="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                    >
                      {{ __('Schedulers') }} ({{ agent.references.Job.length }})
                    </span>
                    <span
                      v-if="agent.references?.Macro?.length"
                      class="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      {{ __('Macros') }} ({{ agent.references.Macro.length }})
                    </span>
                  </div>
                  <div v-else class="flex items-center">
                    <span
                      class="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                      :title="
                        __(
                          'For this agent to run, it needs to be used in an automation (e.g. trigger, scheduler, macro).',
                        )
                      "
                    >
                      <CommonIcon
                        name="alert-circle"
                        class="size-3 text-amber-500 ltr:mr-1 rtl:ml-1"
                      />
                      {{ __('Unused AI agent') }}
                    </span>
                  </div>
                </td>

                <!-- Active Toggle -->
                <td class="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    type="button"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                    :class="agent.active ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'"
                    :aria-label="__('Toggle active state for %s', agent.name)"
                    @click="toggleAgentActive(agent)"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      :class="
                        agent.active
                          ? 'ltr:translate-x-4 rtl:-translate-x-4'
                          : 'ltr:translate-x-0 rtl:translate-x-0'
                      "
                    />
                  </button>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 text-right whitespace-nowrap rtl:text-left">
                  <div
                    class="flex items-center justify-end space-x-1 rtl:justify-start rtl:space-x-reverse"
                  >
                    <!-- Edit -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      :title="__('Edit agent')"
                      @click="openEditAgentModal(agent)"
                    >
                      <CommonIcon name="edit" class="size-4" />
                    </button>

                    <!-- Delete -->
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      :title="__('Delete agent')"
                      :disabled="isDeletingId === agent.id"
                      @click="deleteAgent(agent)"
                    >
                      <CommonIcon
                        v-if="isDeletingId === agent.id"
                        name="reload"
                        class="size-4 animate-spin text-red-600"
                      />
                      <CommonIcon v-else name="trash" class="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Agent Add/Edit Modal -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="mb-5 flex items-center justify-between">
          <div class="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
            >
              <CommonIcon name="ai-agent" class="size-4" />
            </div>
            <h3 class="text-base font-bold text-slate-800 dark:text-white">
              {{ isEditing ? __('Edit AI Agent') : __('New AI Agent') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="__('Close dialog')"
            @click="isModalOpen = false"
          >
            <CommonIcon name="close" class="size-4" />
          </button>
        </div>

        <!-- Wizard Tabs -->
        <div
          class="mb-5 flex space-x-1 rounded-xl bg-slate-100 p-1 rtl:space-x-reverse dark:bg-slate-800"
        >
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            :class="
              formModalTab === 'basics'
                ? 'bg-white text-slate-800 shadow-2xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            "
            @click="formModalTab = 'basics'"
          >
            {{ __('1. Agent Identity') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            :class="
              formModalTab === 'prompt'
                ? 'bg-white text-slate-800 shadow-2xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            "
            @click="formModalTab = 'prompt'"
          >
            {{ __('2. Instructions & Scope') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors"
            :class="
              formModalTab === 'activation'
                ? 'bg-white text-slate-800 shadow-2xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            "
            @click="formModalTab = 'activation'"
          >
            {{ __('3. Activation') }}
          </button>
        </div>

        <form @submit.prevent="saveAgent">
          <!-- Tab 1: Basics -->
          <div v-show="formModalTab === 'basics'" class="space-y-4">
            <!-- Name -->
            <div>
              <label
                for="agent-form-name"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Agent Name') }} <span class="text-red-500">*</span>
              </label>
              <input
                id="agent-form-name"
                v-model="agentForm.name"
                type="text"
                required
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                :placeholder="__('e.g. VIP Priority Classifier')"
              />
            </div>

            <!-- Agent Type Selection -->
            <div>
              <label
                for="agent-form-type"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Agent Type') }} <span class="text-red-500">*</span>
              </label>
              <select
                id="agent-form-type"
                v-model="agentForm.agent_type"
                :disabled="isEditing"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden disabled:bg-slate-100 disabled:opacity-75 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                @change="handleTypeChange"
              >
                <option v-for="t in agentTypes" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
              <p
                v-if="agentTypes.find((t) => t.id === agentForm.agent_type)?.description"
                class="mt-1 text-[11px] text-slate-500 dark:text-slate-400"
              >
                {{ agentTypes.find((t) => t.id === agentForm.agent_type)?.description }}
              </p>
            </div>

            <!-- Note -->
            <div>
              <label
                for="agent-form-note"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Internal Note') }}
              </label>
              <input
                id="agent-form-note"
                v-model="agentForm.note"
                type="text"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                :placeholder="
                  __('Describe what this agent does and where it will be referenced...')
                "
              />
            </div>
          </div>

          <!-- Tab 2: Prompt & Scope -->
          <div v-show="formModalTab === 'prompt'" class="space-y-4">
            <!-- Role Description -->
            <div>
              <label
                for="agent-form-role"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Role Description') }}
              </label>
              <input
                id="agent-form-role"
                v-model="agentForm.role_description"
                type="text"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                :placeholder="
                  __(
                    'e.g. Your job is to analyze ticket content and create a meaningful title for it.',
                  )
                "
              />
            </div>

            <!-- Instructions -->
            <div>
              <label
                for="agent-form-instruction"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Instructions') }}
              </label>
              <textarea
                id="agent-form-instruction"
                v-model="agentForm.instruction"
                rows="6"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                :placeholder="__('Detailed rules and constraints for the AI agent...')"
              />
            </div>

            <!-- Articles to Analyze -->
            <div>
              <label
                for="agent-form-articles"
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {{ __('Articles to Analyze') }}
              </label>
              <select
                id="agent-form-articles"
                v-model="agentForm.articles"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="last">
                  {{ __('Last article (newest / triggering message)') }}
                </option>
                <option value="first">
                  {{ __('First article (original customer inquiry)') }}
                </option>
                <option value="all">
                  {{ __('All articles in ticket thread') }}
                </option>
              </select>
            </div>
          </div>

          <!-- Tab 3: Activation & Automation Usage -->
          <div v-show="formModalTab === 'activation'" class="space-y-4">
            <div
              class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div>
                <span class="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {{ __('Agent Status') }}
                </span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{
                    __(
                      'When enabled, triggers and schedulers configured with this agent can execute it.',
                    )
                  }}
                </span>
              </div>
              <button
                type="button"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                :class="agentForm.active ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'"
                :aria-label="__('Toggle active state')"
                @click="agentForm.active = !agentForm.active"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                  :class="
                    agentForm.active
                      ? 'ltr:translate-x-4 rtl:-translate-x-4'
                      : 'ltr:translate-x-0 rtl:translate-x-0'
                  "
                />
              </button>
            </div>

            <div
              class="rounded-xl border border-teal-100 bg-teal-50/50 p-4 dark:border-teal-900/30 dark:bg-teal-950/20"
            >
              <h4 class="mb-1 text-xs font-bold text-teal-900 dark:text-teal-200">
                {{ __('How to trigger this agent') }}
              </h4>
              <p class="text-[11px] leading-relaxed text-teal-700 dark:text-teal-300">
                {{
                  __(
                    'Once saved, navigate to Automations > Triggers, Schedulers, or Macros and select "AI Agent" in the perform action list to execute this agent automatically.',
                  )
                }}
              </p>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div
            class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800"
          >
            <div>
              <button
                v-if="formModalTab !== 'basics'"
                type="button"
                class="cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="formModalTab = formModalTab === 'activation' ? 'prompt' : 'basics'"
              >
                {{ __('Back') }}
              </button>
            </div>

            <div class="flex items-center space-x-2 rtl:space-x-reverse">
              <button
                type="button"
                class="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="isModalOpen = false"
              >
                {{ __('Cancel') }}
              </button>

              <button
                v-if="formModalTab !== 'activation'"
                type="button"
                class="cursor-pointer rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700"
                @click="formModalTab = formModalTab === 'basics' ? 'prompt' : 'activation'"
              >
                {{ __('Next') }}
              </button>

              <button
                v-else
                type="submit"
                class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700 focus:outline-hidden disabled:opacity-50"
                :disabled="isSaving"
              >
                <CommonIcon
                  v-if="isSaving"
                  name="reload"
                  class="size-3.5 animate-spin ltr:mr-1.5 rtl:ml-1.5"
                />
                {{ isEditing ? __('Save Changes') : __('Create Agent') }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Legal Information Modal -->
    <div
      v-if="isLegalModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-[#1e293b]"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center space-x-2 rtl:space-x-reverse">
            <CommonIcon name="info-circle" class="size-5 text-teal-600 dark:text-teal-400" />
            <h3 class="text-base font-bold text-slate-800 dark:text-white">
              {{ __('Legal Information') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            :aria-label="__('Close dialog')"
            @click="isLegalModalOpen = false"
          >
            <CommonIcon name="close" class="size-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            {{
              __(
                'This feature leverages artificial intelligence (AI) to generate or support outputs, recommendations, or automated processes. AI systems are probabilistic and may produce results that are incomplete, biased, or contextually inappropriate.',
              )
            }}
          </p>

          <div
            class="rounded-xl border border-teal-100 bg-teal-50/50 p-4 dark:border-teal-900/30 dark:bg-teal-950/20"
          >
            <h4 class="mb-2 font-bold text-teal-900 dark:text-teal-200">
              {{ __('Important Considerations for Admins') }}
            </h4>
            <ul class="list-disc space-y-2 ltr:pl-4 rtl:pr-4">
              <li>
                <strong>{{ __('User Awareness:') }}</strong>
                {{
                  __(
                    'Ensure end users understand that AI outputs require human review, especially for critical decisions (e.g., legal, financial, health, or safety-related).',
                  )
                }}
              </li>
              <li>
                <strong>{{ __('Configuration Responsibility:') }}</strong>
                {{
                  __(
                    "As an admin, you are responsible for configuring this feature in a way that aligns with your organization's policies and compliance requirements.",
                  )
                }}
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            class="cursor-pointer rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-teal-700"
            @click="isLegalModalOpen = false"
          >
            {{ __('Close') }}
          </button>
        </div>
      </div>
    </div>
  </LayoutContent>
</template>
