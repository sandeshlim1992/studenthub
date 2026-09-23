<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

// Interfaces
interface SettingRecord {
  id: number
  name: string
  title: string
  description: string
  area: string
  state_current?: { value?: unknown }
  state_initial?: { value?: unknown }
  options?: Record<string, unknown>
}

interface ChannelAccount {
  id: number
  area: string
  active: boolean
  group_id?: number
  options?: {
    inbound?: {
      adapter?: string
      options?: {
        host?: string
        user?: string
        password?: string
        port?: string | number
        ssl?: string | boolean
        ssl_verify?: boolean
        folder?: string
        keep_on_server?: boolean
      }
    }
    outbound?: {
      adapter?: string
      options?: {
        host?: string
        user?: string
        password?: string
        port?: string | number
        ssl?: string | boolean
      }
    }
  }
  status_in?: string
  status_out?: string
  last_log_in?: string
  last_log_out?: string
}

interface EmailAddressRecord {
  id: number
  channel_id: number
  name: string
  email: string
  active: boolean
}

interface GroupRecord {
  id: number
  name: string
  active: boolean
}

interface PostmasterFilterRecord {
  id?: number
  name: string
  active: boolean
  note?: string
  match: Record<string, { operator: string; value: string } | string>
  perform: Record<string, { value: unknown } | unknown>
}

interface SignatureRecord {
  id?: number
  name: string
  body: string
  active: boolean
  note?: string
  created_at?: string
  updated_at?: string
}

const router = useRouter()

// State
const activeTab = ref<'accounts' | 'filters' | 'signatures' | 'settings'>('accounts')
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Accounts Data
const accountChannels = ref<ChannelAccount[]>([])
const notificationChannels = ref<ChannelAccount[]>([])
const emailAddresses = ref<EmailAddressRecord[]>([])
const groups = ref<GroupRecord[]>([])
const notificationSender = ref('')

// Filters & Signatures Data
const postmasterFilters = ref<PostmasterFilterRecord[]>([])
const signatures = ref<SignatureRecord[]>([])

// Settings Data
const settingsMap = ref<Record<string, SettingRecord>>({})
const formSettings = ref({
  ticket_subject_size: 110,
  ticket_subject_re: 'RE',
  ticket_subject_fwd: 'FWD',
  ticket_define_email_from: 'AgentNameSystemAddressName',
  ticket_define_email_from_separator: 'via',
  postmaster_max_size: 10,
  postmaster_send_reject_if_mail_too_large: true,
  postmaster_follow_up_search_in: ['subject_references'],
  postmaster_sender_is_agent_search_for_customer: true,
  notification_sender: '',
  send_no_auto_response_reg_exp: '(mailer-daemon|postmaster|abuse|root|noreply|noreply.+?|no-reply|no-reply.+?)@.+?',
})
const initialFormSettings = ref({ ...formSettings.value })

// Modals
const isAccountModalOpen = ref(false)
const accountWizardStep = ref<1 | 2 | 3>(1)
const isProbing = ref(false)
const isTestingInbound = ref(false)
const isTestingOutbound = ref(false)
const probeResult = ref<{ result?: string; message?: string } | null>(null)
const inboundTestResult = ref<{ result?: string; message?: string } | null>(null)
const outboundTestResult = ref<{ result?: string; message?: string } | null>(null)

const editingAccountId = ref<number | null>(null)
const accountForm = ref({
  realname: '',
  email: '',
  password: '',
  group_id: 1,
  // Inbound
  inbound_adapter: 'imap',
  inbound_host: '',
  inbound_user: '',
  inbound_password: '',
  inbound_port: '993',
  inbound_ssl: 'ssl',
  inbound_ssl_verify: true,
  inbound_folder: 'INBOX',
  inbound_keep_on_server: false,
  // Outbound
  outbound_adapter: 'smtp',
  outbound_host: '',
  outbound_user: '',
  outbound_password: '',
  outbound_port: '587',
  outbound_ssl: 'starttls',
})

// Notification Modal
const isNotificationModalOpen = ref(false)
const notificationForm = ref({
  adapter: 'smtp',
  host: '',
  user: '',
  password: '',
  port: '587',
  ssl: 'starttls',
})

// Change Group Modal
const isChangeGroupModalOpen = ref(false)
const changeGroupAccountId = ref<number | null>(null)
const changeGroupTargetId = ref<number>(1)

// Email Address / Alias Modal
const isAliasModalOpen = ref(false)
const aliasForm = ref({
  id: null as number | null,
  channel_id: 0,
  name: '',
  email: '',
  active: true,
})

// Filter Modal
const isFilterModalOpen = ref(false)
const editingFilterId = ref<number | null>(null)
const filterForm = ref({
  name: '',
  active: true,
  note: '',
  conditions: [] as Array<{ header: string; operator: string; value: string }>,
  actions: [] as Array<{ target: string; value: string }>,
})

// Signature Modal
const isSignatureModalOpen = ref(false)
const editingSignatureId = ref<number | null>(null)
const signatureForm = ref({
  name: '',
  body: '',
  active: true,
  note: '',
})

const breadcrumbItems = [
  { label: __('Administration'), to: '/manage' },
  { label: __('Channels') },
  { label: __('Email') },
]

const getCsrf = () => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta ? meta.getAttribute('content') || '' : ''
}

const showSuccess = (msg: string) => {
  successMessage.value = msg
  errorMessage.value = ''
  setTimeout(() => { successMessage.value = '' }, 4000)
}

const showError = (msg: string) => {
  errorMessage.value = msg
  successMessage.value = ''
}

const hasUnsavedSettings = computed(() => {
  return JSON.stringify(formSettings.value) !== JSON.stringify(initialFormSettings.value)
})

// Load All Data
const loadAllData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [channelsRes, filtersRes, signaturesRes, settingsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels_email', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/postmaster_filters', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/signatures', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/settings', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (channelsRes.ok) {
      const data = await channelsRes.json()
      const assets = data.assets || {}
      
      const accList: ChannelAccount[] = []
      if (Array.isArray(data.account_channel_ids)) {
        for (const cid of data.account_channel_ids) {
          const ch = assets.Channel?.[cid]
          if (ch) accList.push(ch)
        }
      }
      accountChannels.value = accList

      const notifList: ChannelAccount[] = []
      if (Array.isArray(data.notification_channel_ids)) {
        for (const cid of data.notification_channel_ids) {
          const ch = assets.Channel?.[cid]
          if (ch) notifList.push(ch)
        }
      }
      notificationChannels.value = notifList

      const addrList: EmailAddressRecord[] = []
      if (Array.isArray(data.email_address_ids)) {
        for (const aid of data.email_address_ids) {
          const addr = assets.EmailAddress?.[aid]
          if (addr) addrList.push(addr)
        }
      }
      emailAddresses.value = addrList

      notificationSender.value = data.config?.notification_sender || ''
    }

    if (filtersRes.ok) {
      postmasterFilters.value = await filtersRes.json()
    }

    if (signaturesRes.ok) {
      signatures.value = await signaturesRes.json()
    }

    if (groupsRes.ok) {
      groups.value = await groupsRes.json()
    }

    if (settingsRes.ok) {
      const allSettings: SettingRecord[] = await settingsRes.json()
      const map: Record<string, SettingRecord> = {}
      for (const s of allSettings) {
        if (s.area === 'Email::Base') {
          map[s.name] = s
        }
      }
      settingsMap.value = map

      // Populate form settings
      formSettings.value = {
        ticket_subject_size: Number(map['ticket_subject_size']?.state_current?.value ?? 110),
        ticket_subject_re: String(map['ticket_subject_re']?.state_current?.value ?? 'RE'),
        ticket_subject_fwd: String(map['ticket_subject_fwd']?.state_current?.value ?? 'FWD'),
        ticket_define_email_from: String(map['ticket_define_email_from']?.state_current?.value ?? 'AgentNameSystemAddressName'),
        ticket_define_email_from_separator: String(map['ticket_define_email_from_separator']?.state_current?.value ?? 'via'),
        postmaster_max_size: Number(map['postmaster_max_size']?.state_current?.value ?? 10),
        postmaster_send_reject_if_mail_too_large: Boolean(map['postmaster_send_reject_if_mail_too_large']?.state_current?.value ?? true),
        postmaster_follow_up_search_in: Array.isArray(map['postmaster_follow_up_search_in']?.state_current?.value)
          ? (map['postmaster_follow_up_search_in']?.state_current?.value as string[])
          : ['subject_references'],
        postmaster_sender_is_agent_search_for_customer: Boolean(map['postmaster_sender_is_agent_search_for_customer']?.state_current?.value ?? true),
        notification_sender: String(map['notification_sender']?.state_current?.value ?? ''),
        send_no_auto_response_reg_exp: String(map['send_no_auto_response_reg_exp']?.state_current?.value ?? ''),
      }
      initialFormSettings.value = { ...formSettings.value }
    }
  } catch (e) {
    showError(__('An unexpected error occurred while loading email configuration.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// Group Lookup Helper
const getGroupName = (groupId?: number) => {
  if (!groupId) return '-'
  const g = groups.value.find((item) => item.id === groupId)
  return g ? g.name : `Group #${groupId}`
}

// Linked Email Address Helper
const getChannelAddresses = (channelId: number) => {
  return emailAddresses.value.filter((a) => a.channel_id === channelId)
}

// Account Enable / Disable
const toggleChannelActive = async (channel: ChannelAccount) => {
  const url = channel.active ? '/api/v1/channels_email_disable' : '/api/v1/channels_email_enable'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ id: channel.id }),
    })
    if (res.ok) {
      channel.active = !channel.active
      showSuccess(channel.active ? __('Email account enabled.') : __('Email account disabled.'))
    } else {
      showError(__('Failed to update account status.'))
    }
  } catch (e) {
    showError(__('An error occurred updating account status.'))
    console.error(e)
  }
}

// Delete Channel
const deleteChannel = async (channel: ChannelAccount) => {
  if (!confirm(__('Are you sure you want to delete this email account? This action cannot be undone.'))) {
    return
  }
  try {
    const res = await fetch('/api/v1/channels_email', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ id: channel.id }),
    })
    if (res.ok) {
      accountChannels.value = accountChannels.value.filter((c) => c.id !== channel.id)
      showSuccess(__('Email account deleted successfully.'))
    } else {
      showError(__('Failed to delete email account.'))
    }
  } catch (e) {
    showError(__('An error occurred while deleting email account.'))
    console.error(e)
  }
}

// Change Group
const openChangeGroupModal = (channel: ChannelAccount) => {
  changeGroupAccountId.value = channel.id
  changeGroupTargetId.value = channel.group_id || (groups.value[0]?.id ?? 1)
  isChangeGroupModalOpen.value = true
}

const saveChangeGroup = async () => {
  if (!changeGroupAccountId.value) return
  try {
    const res = await fetch(`/api/v1/channels_email_group/${changeGroupAccountId.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ group_id: changeGroupTargetId.value }),
    })
    if (res.ok) {
      const ch = accountChannels.value.find((c) => c.id === changeGroupAccountId.value)
      if (ch) ch.group_id = changeGroupTargetId.value
      isChangeGroupModalOpen.value = false
      showSuccess(__('Destination group updated.'))
    } else {
      showError(__('Failed to update destination group.'))
    }
  } catch (e) {
    showError(__('An error occurred updating destination group.'))
    console.error(e)
  }
}

// Alias (Email Address) Management
const openAddAliasModal = (channelId: number) => {
  aliasForm.value = {
    id: null,
    channel_id: channelId,
    name: '',
    email: '',
    active: true,
  }
  isAliasModalOpen.value = true
}

const saveAlias = async () => {
  if (!aliasForm.value.email || !aliasForm.value.channel_id) return
  const isEdit = Boolean(aliasForm.value.id)
  const url = isEdit ? `/api/v1/email_addresses/${aliasForm.value.id}` : '/api/v1/email_addresses'
  const method = isEdit ? 'PUT' : 'POST'
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(aliasForm.value),
    })
    if (res.ok) {
      const data: EmailAddressRecord = await res.json()
      if (isEdit) {
        const idx = emailAddresses.value.findIndex((a) => a.id === data.id)
        if (idx !== -1) emailAddresses.value[idx] = data
      } else {
        emailAddresses.value.push(data)
      }
      isAliasModalOpen.value = false
      showSuccess(__('Email address saved.'))
    } else {
      showError(__('Failed to save email address.'))
    }
  } catch (e) {
    showError(__('An error occurred while saving email address.'))
    console.error(e)
  }
}

const deleteAlias = async (addr: EmailAddressRecord) => {
  if (!confirm(__('Are you sure you want to delete this email address?'))) return
  try {
    const res = await fetch(`/api/v1/email_addresses/${addr.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      emailAddresses.value = emailAddresses.value.filter((a) => a.id !== addr.id)
      showSuccess(__('Email address deleted.'))
    } else {
      showError(__('Failed to delete email address.'))
    }
  } catch (e) {
    showError(__('An error occurred deleting email address.'))
    console.error(e)
  }
}

// Wizard / Add & Edit Account
const openNewAccountModal = () => {
  editingAccountId.value = null
  accountWizardStep.value = 1
  probeResult.value = null
  inboundTestResult.value = null
  outboundTestResult.value = null
  accountForm.value = {
    realname: '',
    email: '',
    password: '',
    group_id: groups.value[0]?.id ?? 1,
    inbound_adapter: 'imap',
    inbound_host: '',
    inbound_user: '',
    inbound_password: '',
    inbound_port: '993',
    inbound_ssl: 'ssl',
    inbound_ssl_verify: true,
    inbound_folder: 'INBOX',
    inbound_keep_on_server: false,
    outbound_adapter: 'smtp',
    outbound_host: '',
    outbound_user: '',
    outbound_password: '',
    outbound_port: '587',
    outbound_ssl: 'starttls',
  }
  isAccountModalOpen.value = true
}

const openEditInboundModal = (channel: ChannelAccount) => {
  editingAccountId.value = channel.id
  accountWizardStep.value = 2
  inboundTestResult.value = null
  outboundTestResult.value = null

  const inOpts = channel.options?.inbound?.options || {}
  const outOpts = channel.options?.outbound?.options || {}
  const primaryAddr = getChannelAddresses(channel.id)[0]

  accountForm.value = {
    realname: primaryAddr?.name || '',
    email: primaryAddr?.email || inOpts.user || '',
    password: '',
    group_id: channel.group_id ?? 1,
    inbound_adapter: channel.options?.inbound?.adapter || 'imap',
    inbound_host: inOpts.host || '',
    inbound_user: inOpts.user || '',
    inbound_password: '',
    inbound_port: String(inOpts.port || '993'),
    inbound_ssl: inOpts.ssl ? String(inOpts.ssl) : 'ssl',
    inbound_ssl_verify: inOpts.ssl_verify !== false,
    inbound_folder: inOpts.folder || 'INBOX',
    inbound_keep_on_server: Boolean(inOpts.keep_on_server),
    outbound_adapter: channel.options?.outbound?.adapter || 'smtp',
    outbound_host: outOpts.host || '',
    outbound_user: outOpts.user || '',
    outbound_password: '',
    outbound_port: String(outOpts.port || '587'),
    outbound_ssl: outOpts.ssl ? String(outOpts.ssl) : 'starttls',
  }
  isAccountModalOpen.value = true
}

const probeAccountCredentials = async () => {
  if (!accountForm.value.email || !accountForm.value.password) {
    showError(__('Please enter email and password to detect server settings.'))
    return
  }
  isProbing.value = true
  probeResult.value = null
  try {
    const res = await fetch('/api/v1/channels_email_probe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        email: accountForm.value.email,
        password: accountForm.value.password,
      }),
    })
    const data = await res.json()
    probeResult.value = data
    if (data.result === 'ok') {
      const inSet = data.setting?.inbound || {}
      const outSet = data.setting?.outbound || {}
      
      accountForm.value.inbound_adapter = inSet.adapter || 'imap'
      accountForm.value.inbound_host = inSet.options?.host || ''
      accountForm.value.inbound_user = inSet.options?.user || accountForm.value.email
      accountForm.value.inbound_port = String(inSet.options?.port || '993')
      accountForm.value.inbound_ssl = inSet.options?.ssl ? String(inSet.options.ssl) : 'ssl'
      accountForm.value.inbound_password = accountForm.value.password

      accountForm.value.outbound_adapter = outSet.adapter || 'smtp'
      accountForm.value.outbound_host = outSet.options?.host || ''
      accountForm.value.outbound_user = outSet.options?.user || accountForm.value.email
      accountForm.value.outbound_port = String(outSet.options?.port || '587')
      accountForm.value.outbound_ssl = outSet.options?.ssl ? String(outSet.options.ssl) : 'starttls'
      accountForm.value.outbound_password = accountForm.value.password

      accountWizardStep.value = 2
    } else {
      showError(data.message || __('Auto-detection could not determine settings. Proceeding to manual setup.'))
      accountWizardStep.value = 2
    }
  } catch (e) {
    console.error(e)
    accountWizardStep.value = 2
  } finally {
    isProbing.value = false
  }
}

const testInboundConnection = async () => {
  isTestingInbound.value = true
  inboundTestResult.value = null
  try {
    const payload = {
      channel_id: editingAccountId.value,
      adapter: accountForm.value.inbound_adapter,
      options: {
        host: accountForm.value.inbound_host,
        user: accountForm.value.inbound_user,
        password: accountForm.value.inbound_password,
        port: accountForm.value.inbound_port,
        ssl: accountForm.value.inbound_ssl,
        ssl_verify: accountForm.value.inbound_ssl_verify,
        folder: accountForm.value.inbound_folder,
        keep_on_server: accountForm.value.inbound_keep_on_server,
      }
    }
    const res = await fetch('/api/v1/channels_email_inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    inboundTestResult.value = data
  } catch (e) {
    inboundTestResult.value = { result: 'failed', message: String(e) }
  } finally {
    isTestingInbound.value = false
  }
}

const testOutboundConnection = async () => {
  isTestingOutbound.value = true
  outboundTestResult.value = null
  try {
    const payload = {
      channel_id: editingAccountId.value,
      email: accountForm.value.email,
      adapter: accountForm.value.outbound_adapter,
      options: {
        host: accountForm.value.outbound_host,
        user: accountForm.value.outbound_user,
        password: accountForm.value.outbound_password,
        port: accountForm.value.outbound_port,
        ssl: accountForm.value.outbound_ssl,
      }
    }
    const res = await fetch('/api/v1/channels_email_outbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    outboundTestResult.value = data
  } catch (e) {
    outboundTestResult.value = { result: 'failed', message: String(e) }
  } finally {
    isTestingOutbound.value = false
  }
}

const submitAccountForm = async () => {
  isSaving.value = true
  try {
    const payload = {
      channel_id: editingAccountId.value,
      email: accountForm.value.email,
      meta: {
        realname: accountForm.value.realname,
        email: accountForm.value.email,
      },
      group_id: accountForm.value.group_id,
      inbound: {
        adapter: accountForm.value.inbound_adapter,
        options: {
          host: accountForm.value.inbound_host,
          user: accountForm.value.inbound_user,
          password: accountForm.value.inbound_password,
          port: accountForm.value.inbound_port,
          ssl: accountForm.value.inbound_ssl,
          ssl_verify: accountForm.value.inbound_ssl_verify,
          folder: accountForm.value.inbound_folder,
          keep_on_server: accountForm.value.inbound_keep_on_server,
        },
      },
      outbound: {
        adapter: accountForm.value.outbound_adapter,
        options: {
          host: accountForm.value.outbound_host,
          user: accountForm.value.outbound_user,
          password: accountForm.value.outbound_password,
          port: accountForm.value.outbound_port,
          ssl: accountForm.value.outbound_ssl,
        },
      },
    }

    const res = await fetch('/api/v1/channels_email_verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.result === 'ok') {
      isAccountModalOpen.value = false
      showSuccess(__('Email account configured and verified successfully.'))
      await loadAllData()
    } else {
      showError(data.message || __('Verification failed. Please check server settings and credentials.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving email account.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Notification Channel Setup
const openNotificationModal = () => {
  const notifCh = notificationChannels.value[0]
  const opts = notifCh?.options?.outbound?.options || {}
  notificationForm.value = {
    adapter: notifCh?.options?.outbound?.adapter || 'smtp',
    host: opts.host || '',
    user: opts.user || '',
    password: '',
    port: String(opts.port || '587'),
    ssl: opts.ssl ? String(opts.ssl) : 'starttls',
  }
  isNotificationModalOpen.value = true
}

const saveNotificationChannel = async () => {
  isSaving.value = true
  try {
    const payload = {
      adapter: notificationForm.value.adapter,
      options: {
        host: notificationForm.value.host,
        user: notificationForm.value.user,
        password: notificationForm.value.password,
        port: notificationForm.value.port,
        ssl: notificationForm.value.ssl,
      }
    }
    const res = await fetch('/api/v1/channels_email_notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.result === 'ok') {
      isNotificationModalOpen.value = false
      showSuccess(__('Email notification service configured successfully.'))
      await loadAllData()
    } else {
      showError(data.message || __('Failed to configure notification service.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Postmaster Filter Actions
const openNewFilterModal = () => {
  editingFilterId.value = null
  filterForm.value = {
    name: '',
    active: true,
    note: '',
    conditions: [{ header: 'from', operator: 'contains', value: '' }],
    actions: [{ target: 'x-zammad-ticket-group_id', value: String(groups.value[0]?.id ?? 1) }],
  }
  isFilterModalOpen.value = true
}

const openEditFilterModal = (filter: PostmasterFilterRecord) => {
  editingFilterId.value = filter.id ?? null
  const conds: Array<{ header: string; operator: string; value: string }> = []
  if (filter.match) {
    for (const [key, val] of Object.entries(filter.match)) {
      if (typeof val === 'object' && val !== null) {
        conds.push({ header: key, operator: val.operator || 'contains', value: val.value || '' })
      } else {
        conds.push({ header: key, operator: 'contains', value: String(val) })
      }
    }
  }

  const acts: Array<{ target: string; value: string }> = []
  if (filter.perform) {
    for (const [key, val] of Object.entries(filter.perform)) {
      if (typeof val === 'object' && val !== null && 'value' in val) {
        acts.push({ target: key, value: String((val as { value: unknown }).value) })
      } else {
        acts.push({ target: key, value: String(val) })
      }
    }
  }

  filterForm.value = {
    name: filter.name,
    active: filter.active,
    note: filter.note || '',
    conditions: conds.length > 0 ? conds : [{ header: 'from', operator: 'contains', value: '' }],
    actions: acts.length > 0 ? acts : [{ target: 'x-zammad-ticket-group_id', value: String(groups.value[0]?.id ?? 1) }],
  }
  isFilterModalOpen.value = true
}

const saveFilter = async () => {
  if (!filterForm.value.name) {
    showError(__('Please enter a filter name.'))
    return
  }
  isSaving.value = true
  try {
    const matchObj: Record<string, { operator: string; value: string }> = {}
    for (const c of filterForm.value.conditions) {
      if (c.header && c.value) {
        matchObj[c.header] = { operator: c.operator, value: c.value }
      }
    }

    const performObj: Record<string, { value: string }> = {}
    for (const a of filterForm.value.actions) {
      if (a.target && a.value) {
        performObj[a.target] = { value: a.value }
      }
    }

    const payload = {
      name: filterForm.value.name,
      active: filterForm.value.active,
      note: filterForm.value.note,
      match: matchObj,
      perform: performObj,
    }

    const isEdit = Boolean(editingFilterId.value)
    const url = isEdit ? `/api/v1/postmaster_filters/${editingFilterId.value}` : '/api/v1/postmaster_filters'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      isFilterModalOpen.value = false
      showSuccess(__('Postmaster filter saved successfully.'))
      const refRes = await fetch('/api/v1/postmaster_filters', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
      if (refRes.ok) postmasterFilters.value = await refRes.json()
    } else {
      showError(__('Failed to save postmaster filter.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving postmaster filter.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteFilter = async (filter: PostmasterFilterRecord) => {
  if (!confirm(__('Are you sure you want to delete this filter?'))) return
  try {
    const res = await fetch(`/api/v1/postmaster_filters/${filter.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      postmasterFilters.value = postmasterFilters.value.filter((f) => f.id !== filter.id)
      showSuccess(__('Postmaster filter deleted.'))
    } else {
      showError(__('Failed to delete postmaster filter.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred deleting filter.'))
    console.error(e)
  }
}

// Signature Actions
const openNewSignatureModal = () => {
  editingSignatureId.value = null
  signatureForm.value = {
    name: '',
    body: `Best regards,\n#{user.firstname} #{user.lastname}\n#{config.product_name}`,
    active: true,
    note: '',
  }
  isSignatureModalOpen.value = true
}

const openEditSignatureModal = (sig: SignatureRecord) => {
  editingSignatureId.value = sig.id ?? null
  signatureForm.value = {
    name: sig.name,
    body: sig.body,
    active: sig.active,
    note: sig.note || '',
  }
  isSignatureModalOpen.value = true
}

const insertVariableIntoSignature = (varTag: string) => {
  signatureForm.value.body += ` ${varTag}`
}

const saveSignature = async () => {
  if (!signatureForm.value.name) {
    showError(__('Please enter a signature name.'))
    return
  }
  isSaving.value = true
  try {
    const payload = {
      name: signatureForm.value.name,
      body: signatureForm.value.body,
      active: signatureForm.value.active,
      note: signatureForm.value.note,
    }

    const isEdit = Boolean(editingSignatureId.value)
    const url = isEdit ? `/api/v1/signatures/${editingSignatureId.value}` : '/api/v1/signatures'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      isSignatureModalOpen.value = false
      showSuccess(__('Signature saved successfully.'))
      const refRes = await fetch('/api/v1/signatures', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
      if (refRes.ok) signatures.value = await refRes.json()
    } else {
      showError(__('Failed to save signature.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving signature.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteSignature = async (sig: SignatureRecord) => {
  if (!confirm(__('Are you sure you want to delete this signature?'))) return
  try {
    const res = await fetch(`/api/v1/signatures/${sig.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      signatures.value = signatures.value.filter((s) => s.id !== sig.id)
      showSuccess(__('Signature deleted.'))
    } else {
      showError(__('Failed to delete signature.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred deleting signature.'))
    console.error(e)
  }
}

// Settings Actions
const saveEmailSettings = async () => {
  isSaving.value = true
  try {
    const updates = Object.entries(formSettings.value)
    const promises = updates.map(([key, val]) => {
      const s = settingsMap.value[key]
      if (!s) return Promise.resolve(true)
      return fetch(`/api/v1/settings/${s.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ state_current: { value: val } }),
      }).then((r) => r.ok)
    })

    const results = await Promise.all(promises)
    if (results.every((r) => r)) {
      initialFormSettings.value = { ...formSettings.value }
      showSuccess(__('Email settings saved successfully.'))
    } else {
      showError(__('Failed to save some email settings.'))
    }
  } catch (e) {
    showError(__('An error occurred while saving email settings.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const resetEmailSettings = async () => {
  if (!confirm(__('Are you sure you want to reset all email settings to system defaults?'))) return
  isSaving.value = true
  try {
    const settingNames = Object.keys(settingsMap.value)
    const promises = settingNames.map((name) => {
      const s = settingsMap.value[name]
      if (!s) return Promise.resolve(null)
      return fetch(`/api/v1/settings/reset/${s.id}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': getCsrf(),
        },
      })
    })
    await Promise.all(promises)
    await loadAllData()
    showSuccess(__('Email settings reset to defaults.'))
  } catch (e) {
    showError(__('Failed to reset email settings.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-6xl mx-auto">
      
      <!-- Top Navigation & Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <button
              type="button"
              class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              :title="__('Back to Administration')"
              :aria-label="__('Back to Administration')"
              @click="router.push('/manage')"
            >
              <CommonIcon name="arrow-left" class="w-4 h-4" />
            </button>
            <div class="flex items-center gap-2">
              <span class="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                <CommonIcon name="envelope" class="w-5 h-5" />
              </span>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ __('Email Channel') }}</h1>
            </div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
              {{ __('Channels') }}
            </span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Set up inbound and outbound email accounts, notification gateways, postmaster filters, and email signatures.') }}
          </p>
        </div>

        <!-- Quick Top Actions -->
        <div class="flex items-center gap-3">
          <button
            v-if="activeTab === 'accounts'"
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2"
            @click="openNewAccountModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            <span>{{ __('Add Account') }}</span>
          </button>
          <button
            v-if="activeTab === 'filters'"
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2"
            @click="openNewFilterModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            <span>{{ __('New Filter') }}</span>
          </button>
          <button
            v-if="activeTab === 'signatures'"
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2"
            @click="openNewSignatureModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            <span>{{ __('New Signature') }}</span>
          </button>
          <button
            v-if="activeTab === 'settings'"
            type="button"
            class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            :disabled="!hasUnsavedSettings || isSaving"
            @click="saveEmailSettings"
          >
            <CommonIcon v-if="isSaving" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
            <CommonIcon v-else name="check2" class="w-3.5 h-3.5" />
            <span>{{ isSaving ? __('Saving...') : __('Save Settings') }}</span>
          </button>
        </div>
      </div>

      <!-- Alerts -->
      <div v-if="successMessage" class="mb-6 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm rounded-2xl flex items-center gap-2.5 shadow-sm">
        <CommonIcon name="check2-circle" class="w-5 h-5 shrink-0 text-green-600 dark:text-green-400" />
        <span class="font-medium">{{ successMessage }}</span>
      </div>
      <div v-if="errorMessage" class="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-2xl flex items-center gap-2.5 shadow-sm">
        <CommonIcon name="exclamation-triangle" class="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
        <span class="font-medium">{{ errorMessage }}</span>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'accounts' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'accounts'"
        >
          <CommonIcon name="envelope" class="w-4 h-4" />
          {{ __('Accounts') }}
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {{ accountChannels.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'filters' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'filters'"
        >
          <CommonIcon name="funnel" class="w-4 h-4" />
          {{ __('Filter') }}
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {{ postmasterFilters.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'signatures' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'signatures'"
        >
          <CommonIcon name="pencil" class="w-4 h-4" />
          {{ __('Signatures') }}
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {{ signatures.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = 'settings'"
        >
          <CommonIcon name="gear" class="w-4 h-4" />
          {{ __('Settings') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-20 text-center text-slate-400">
        <CommonIcon name="arrow-repeat" class="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        <p class="text-sm font-medium">{{ __('Loading email configuration...') }}</p>
      </div>

      <div v-else>

        <!-- ======================================================= -->
        <!-- TAB 1: ACCOUNTS                                         -->
        <!-- ======================================================= -->
        <div v-if="activeTab === 'accounts'" class="space-y-6">
          
          <!-- Notification Outbound Service Card -->
          <div class="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900/60 dark:to-slate-900/60 border border-blue-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5">
              <span class="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                <CommonIcon name="bell" class="w-5 h-5" />
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Notification Outbound Service') }}</h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {{ notificationChannels[0]?.options?.outbound?.adapter ? notificationChannels[0].options.outbound.adapter.toUpperCase() : 'SENDMAIL' }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {{ __('Used to send automated ticket notifications, password resets, and system alerts to agents and users.') }}
                </p>
                <div v-if="notificationSender" class="text-[11px] text-blue-700 dark:text-blue-400 font-mono mt-1">
                  {{ __('Sender:') }} {{ notificationSender }}
                </div>
              </div>
            </div>
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-blue-300 dark:border-slate-700 text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              @click="openNotificationModal"
            >
              {{ __('Configure Service') }}
            </button>
          </div>

          <!-- Configured Email Accounts Section -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Email Accounts') }}</h2>
              <span class="text-xs text-slate-500">{{ accountChannels.length }} {{ __('configured') }}</span>
            </div>

            <div v-if="accountChannels.length > 0" class="grid grid-cols-1 gap-4">
              <div
                v-for="channel in accountChannels"
                :key="channel.id"
                class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div class="flex items-start gap-3">
                    <span
                      class="w-3 h-3 rounded-full mt-1.5 shrink-0"
                      :class="channel.active ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-950/40' : 'bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800'"
                    ></span>
                    <div>
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {{ getChannelAddresses(channel.id)[0]?.name || channel.options?.inbound?.options?.user || __('Email Account') }}
                        </span>
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          :class="channel.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                        >
                          {{ channel.active ? __('Active') : __('Inactive') }}
                        </span>
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                          {{ channel.options?.inbound?.adapter?.toUpperCase() || 'IMAP' }} / {{ channel.options?.outbound?.adapter?.toUpperCase() || 'SMTP' }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 font-mono mt-0.5">
                        {{ getChannelAddresses(channel.id)[0]?.email || channel.options?.inbound?.options?.user }}
                      </p>
                    </div>
                  </div>

                  <!-- Quick Channel Controls -->
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      @click="openEditInboundModal(channel)"
                    >
                      {{ __('Edit Settings') }}
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      @click="openChangeGroupModal(channel)"
                    >
                      {{ __('Change Group') }}
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      @click="toggleChannelActive(channel)"
                    >
                      {{ channel.active ? __('Disable') : __('Enable') }}
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      :title="__('Delete Account')"
                      @click="deleteChannel(channel)"
                    >
                      <CommonIcon name="trash" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <!-- Account Status & Aliases Details -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs">
                  <div>
                    <span class="text-slate-400 block mb-0.5">{{ __('Destination Group') }}</span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <CommonIcon name="people" class="w-3.5 h-3.5 text-blue-500" />
                      {{ getGroupName(channel.group_id) }}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400 block mb-0.5">{{ __('Inbound Connection') }}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-300 font-mono">
                      {{ channel.options?.inbound?.options?.host || '-' }}
                    </span>
                    <span v-if="channel.status_in" class="ltr:ml-1.5 rtl:mr-1.5 text-[10px] px-1.5 py-0.2 rounded-sm bg-green-50 text-green-700 border border-green-200">
                      {{ channel.status_in }}
                    </span>
                  </div>
                  <div>
                    <span class="text-slate-400 block mb-0.5">{{ __('Outbound Connection') }}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-300 font-mono">
                      {{ channel.options?.outbound?.options?.host || channel.options?.outbound?.adapter || '-' }}
                    </span>
                    <span v-if="channel.status_out" class="ltr:ml-1.5 rtl:mr-1.5 text-[10px] px-1.5 py-0.2 rounded-sm bg-green-50 text-green-700 border border-green-200">
                      {{ channel.status_out }}
                    </span>
                  </div>
                </div>

                <!-- Extra Linked Email Addresses (Aliases) -->
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {{ __('Linked Email Addresses (Aliases)') }}
                    </span>
                    <button
                      type="button"
                      class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                      @click="openAddAliasModal(channel.id)"
                    >
                      <CommonIcon name="plus" class="w-3 h-3" />
                      {{ __('Add Alias') }}
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="addr in getChannelAddresses(channel.id)"
                      :key="addr.id"
                      class="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <span class="font-medium text-slate-800 dark:text-slate-200">{{ addr.email }}</span>
                      <span v-if="addr.name" class="text-slate-400 text-[11px]">({{ addr.name }})</span>
                      <button
                        v-if="getChannelAddresses(channel.id).length > 1"
                        type="button"
                        class="text-slate-400 hover:text-red-500 cursor-pointer"
                        :title="__('Delete alias')"
                        @click="deleteAlias(addr)"
                      >
                        <CommonIcon name="x" class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Zero State Accounts -->
            <div v-else class="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
              <CommonIcon name="envelope" class="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{{ __('No email accounts configured') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                {{ __('Connect an email account via IMAP/POP3 and SMTP to automatically create and reply to tickets.') }}
              </p>
              <button
                type="button"
                class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                @click="openNewAccountModal"
              >
                <CommonIcon name="plus" class="w-3.5 h-3.5" />
                <span>{{ __('Add Email Account') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 2: POSTMASTER FILTERS                               -->
        <!-- ======================================================= -->
        <div v-if="activeTab === 'filters'" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Postmaster Filters') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('With filters you can route new tickets into specific groups, set priorities, or apply tags based on email headers.') }}
              </p>
            </div>
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              @click="openNewFilterModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('New Filter') }}</span>
            </button>
          </div>

          <div v-if="postmasterFilters.length > 0" class="space-y-3">
            <div
              v-for="filter in postmasterFilters"
              :key="filter.id"
              class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="w-2.5 h-2.5 rounded-full shrink-0"
                    :class="filter.active ? 'bg-green-500' : 'bg-slate-400'"
                  ></span>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{{ filter.name }}</h3>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="filter.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                  >
                    {{ filter.active ? __('Active') : __('Inactive') }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span class="flex items-center gap-1 font-mono text-[11px] bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <CommonIcon name="search" class="w-3 h-3 text-blue-500" />
                    {{ Object.keys(filter.match || {}).length }} {{ __('condition(s)') }}
                  </span>
                  <span class="flex items-center gap-1 font-mono text-[11px] bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    <CommonIcon name="lightning" class="w-3 h-3 text-amber-500" />
                    {{ Object.keys(filter.perform || {}).length }} {{ __('action(s)') }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  @click="openEditFilterModal(filter)"
                >
                  {{ __('Edit') }}
                </button>
                <button
                  type="button"
                  class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                  :title="__('Delete Filter')"
                  @click="deleteFilter(filter)"
                >
                  <CommonIcon name="trash" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Zero State Filters -->
          <div v-else class="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
            <CommonIcon name="funnel" class="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{{ __('No postmaster filters defined') }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              {{ __('Create rules to classify and assign inbound emails automatically upon receipt.') }}
            </p>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-2"
              @click="openNewFilterModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('Create First Filter') }}</span>
            </button>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 3: SIGNATURES                                       -->
        <!-- ======================================================= -->
        <div v-if="activeTab === 'signatures'" class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Email Signatures') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Define distinct signatures for different departments. Signatures can be assigned directly to groups.') }}
              </p>
            </div>
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-1.5"
              @click="openNewSignatureModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('New Signature') }}</span>
            </button>
          </div>

          <div v-if="signatures.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="sig in signatures"
              :key="sig.id"
              class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div class="flex items-center justify-between gap-2 mb-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full shrink-0"
                      :class="sig.active ? 'bg-green-500' : 'bg-slate-400'"
                    ></span>
                    <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ sig.name }}</h3>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      @click="openEditSignatureModal(sig)"
                    >
                      {{ __('Edit') }}
                    </button>
                    <button
                      type="button"
                      class="p-1 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                      :title="__('Delete Signature')"
                      @click="deleteSignature(sig)"
                    >
                      <CommonIcon name="trash" class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Signature Body Preview -->
                <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-4">
                  {{ sig.body }}
                </div>
              </div>
            </div>
          </div>

          <!-- Zero State Signatures -->
          <div v-else class="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
            <CommonIcon name="pencil" class="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{{ __('No signatures configured') }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              {{ __('Create personalized email signatures for your support team with dynamic user attributes.') }}
            </p>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-2"
              @click="openNewSignatureModal"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              <span>{{ __('Create First Signature') }}</span>
            </button>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 4: SETTINGS (Email::Base)                           -->
        <!-- ======================================================= -->
        <div v-if="activeTab === 'settings'" class="max-w-4xl space-y-6">
          
          <!-- Floating Unsaved Changes -->
          <div v-if="hasUnsavedSettings" class="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-2">
              <CommonIcon name="info-circle" class="w-4 h-4 text-amber-600 shrink-0" />
              <span>{{ __('You have unsaved changes in email settings.') }}</span>
            </div>
            <button
              type="button"
              class="font-semibold underline hover:no-underline cursor-pointer"
              @click="saveEmailSettings"
            >
              {{ __('Save now') }}
            </button>
          </div>

          <!-- Subject Line Format Card -->
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Subject Line Conventions') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Configure how prefixes and character limits are applied to email subject lines.') }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="f-subject-size" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Maximum Subject Length') }}
                </label>
                <input
                  id="f-subject-size"
                  v-model.number="formSettings.ticket_subject_size"
                  type="number"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label for="f-subject-re" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Reply Prefix') }}
                </label>
                <input
                  id="f-subject-re"
                  v-model="formSettings.ticket_subject_re"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label for="f-subject-fwd" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Forward Prefix') }}
                </label>
                <input
                  id="f-subject-fwd"
                  v-model="formSettings.ticket_subject_fwd"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <!-- Sender Identity Card -->
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Sender Identification') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Control how agent and system names appear in outgoing email "From" headers.') }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="f-sender-format" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Sender Format') }}
                </label>
                <select
                  id="f-sender-format"
                  v-model="formSettings.ticket_define_email_from"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="AgentNameSystemAddressName">Agent Name + System Address Name (e.g. John Doe via Helpdesk)</option>
                  <option value="SystemAddressName">System Address Name only (e.g. Helpdesk)</option>
                  <option value="AgentName">Agent Name only (e.g. John Doe)</option>
                </select>
              </div>
              <div>
                <label for="f-sender-sep" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Separator Word') }}
                </label>
                <input
                  id="f-sender-sep"
                  v-model="formSettings.ticket_define_email_from_separator"
                  type="text"
                  placeholder="via"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <!-- Email Limits & Rejection Card -->
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Limits & Rejections') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Define inbound size boundaries and loop-prevention regular expressions.') }}
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="f-max-size" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Maximum Inbound Message Size (MB)') }}
                </label>
                <input
                  id="f-max-size"
                  v-model.number="formSettings.postmaster_max_size"
                  type="number"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    v-model="formSettings.postmaster_send_reject_if_mail_too_large"
                    type="checkbox"
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{{ __('Send rejection notice if message exceeds limit') }}</span>
                </label>
              </div>
            </div>

            <div>
              <label for="f-block-regexp" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {{ __('Block Automated Notifications (Regular Expression)') }}
              </label>
              <input
                id="f-block-regexp"
                v-model="formSettings.send_no_auto_response_reg_exp"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
              <span class="text-[11px] text-slate-400 mt-1 block">
                {{ __('Prevents auto-responder loops with systems like Mailer-Daemon, Postmaster, or root.') }}
              </span>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              @click="resetEmailSettings"
            >
              {{ __('Reset to Defaults') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              :disabled="!hasUnsavedSettings || isSaving"
              @click="saveEmailSettings"
            >
              <CommonIcon v-if="isSaving" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
              <CommonIcon v-else name="check2" class="w-3.5 h-3.5" />
              <span>{{ isSaving ? __('Saving...') : __('Save Settings') }}</span>
            </button>
          </div>
        </div>

      </div>

      <!-- ======================================================= -->
      <!-- MODAL: ACCOUNT WIZARD & INBOUND/OUTBOUND SETUP         -->
      <!-- ======================================================= -->
      <div
        v-if="isAccountModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Email Account Configuration')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
                {{ editingAccountId ? __('Edit Email Account') : __('Add Email Account') }}
              </h3>
              <p class="text-xs text-slate-500">{{ __('Step') }} {{ accountWizardStep }} {{ __('of') }} 3</p>
            </div>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isAccountModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <!-- Wizard Step 1: Credentials & Auto-Probe -->
          <div v-if="accountWizardStep === 1" class="space-y-4">
            <p class="text-xs text-slate-500">
              {{ __('Enter your organization name and email credentials. Zammad will attempt to detect the correct mail server settings automatically.') }}
            </p>

            <div class="grid grid-cols-1 gap-3">
              <div>
                <label for="acc-realname" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Organization & Department Name') }}
                </label>
                <input
                  id="acc-realname"
                  v-model="accountForm.realname"
                  type="text"
                  placeholder="e.g. Acme Support"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label for="acc-email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Email Address') }}
                </label>
                <input
                  id="acc-email"
                  v-model="accountForm.email"
                  type="email"
                  placeholder="support@example.com"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label for="acc-password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Password') }}
                </label>
                <input
                  id="acc-password"
                  v-model="accountForm.password"
                  type="password"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label for="acc-group" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {{ __('Destination Group') }}
                </label>
                <select
                  id="acc-group"
                  v-model="accountForm.group_id"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
                @click="accountWizardStep = 2"
              >
                {{ __('Configure Manually') }}
              </button>
              <button
                type="button"
                class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 disabled:opacity-50"
                :disabled="isProbing || !accountForm.email || !accountForm.password"
                @click="probeAccountCredentials"
              >
                <CommonIcon v-if="isProbing" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
                <span>{{ isProbing ? __('Detecting...') : __('Auto-Detect Settings') }}</span>
              </button>
            </div>
          </div>

          <!-- Wizard Step 2: Inbound Settings -->
          <div v-if="accountWizardStep === 2" class="space-y-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-blue-600">{{ __('Inbound Mail Settings (Receiving)') }}</h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="in-adapter" class="block text-xs font-semibold mb-1">{{ __('Type') }}</label>
                <select id="in-adapter" v-model="accountForm.inbound_adapter" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                  <option value="imap">IMAP</option>
                  <option value="pop3">POP3</option>
                </select>
              </div>
              <div>
                <label for="in-host" class="block text-xs font-semibold mb-1">{{ __('Host') }}</label>
                <input id="in-host" v-model="accountForm.inbound_host" type="text" placeholder="imap.example.com" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="in-user" class="block text-xs font-semibold mb-1">{{ __('User') }}</label>
                <input id="in-user" v-model="accountForm.inbound_user" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="in-password" class="block text-xs font-semibold mb-1">{{ __('Password') }}</label>
                <input id="in-password" v-model="accountForm.inbound_password" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div>
                <label for="in-port" class="block text-xs font-semibold mb-1">{{ __('Port') }}</label>
                <input id="in-port" v-model="accountForm.inbound_port" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div>
                <label for="in-ssl" class="block text-xs font-semibold mb-1">{{ __('SSL / STARTTLS') }}</label>
                <select id="in-ssl" v-model="accountForm.inbound_ssl" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                  <option value="ssl">SSL</option>
                  <option value="starttls">STARTTLS</option>
                  <option value="off">No SSL</option>
                </select>
              </div>
            </div>

            <!-- Inbound Test Result -->
            <div v-if="inboundTestResult" class="p-3 rounded-xl text-xs" :class="inboundTestResult.result === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
              {{ inboundTestResult.result === 'ok' ? __('Inbound connection test successful!') : (inboundTestResult.message || __('Connection failed.')) }}
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                class="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                @click="testInboundConnection"
              >
                {{ isTestingInbound ? __('Testing...') : __('Test Inbound') }}
              </button>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                  @click="accountWizardStep = 1"
                >
                  {{ __('Back') }}
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  @click="accountWizardStep = 3"
                >
                  {{ __('Next: Outbound') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Wizard Step 3: Outbound Settings & Finish -->
          <div v-if="accountWizardStep === 3" class="space-y-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-blue-600">{{ __('Outbound Mail Settings (Sending)') }}</h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="out-adapter" class="block text-xs font-semibold mb-1">{{ __('Mechanism') }}</label>
                <select id="out-adapter" v-model="accountForm.outbound_adapter" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                  <option value="smtp">SMTP</option>
                  <option value="sendmail">Sendmail</option>
                </select>
              </div>
              <div v-if="accountForm.outbound_adapter === 'smtp'">
                <label for="out-host" class="block text-xs font-semibold mb-1">{{ __('Host') }}</label>
                <input id="out-host" v-model="accountForm.outbound_host" type="text" placeholder="smtp.example.com" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div v-if="accountForm.outbound_adapter === 'smtp'">
                <label for="out-user" class="block text-xs font-semibold mb-1">{{ __('User') }}</label>
                <input id="out-user" v-model="accountForm.outbound_user" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div v-if="accountForm.outbound_adapter === 'smtp'">
                <label for="out-password" class="block text-xs font-semibold mb-1">{{ __('Password') }}</label>
                <input id="out-password" v-model="accountForm.outbound_password" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div v-if="accountForm.outbound_adapter === 'smtp'">
                <label for="out-port" class="block text-xs font-semibold mb-1">{{ __('Port') }}</label>
                <input id="out-port" v-model="accountForm.outbound_port" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div v-if="accountForm.outbound_adapter === 'smtp'">
                <label for="out-ssl" class="block text-xs font-semibold mb-1">{{ __('SSL / STARTTLS') }}</label>
                <select id="out-ssl" v-model="accountForm.outbound_ssl" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                  <option value="starttls">STARTTLS</option>
                  <option value="ssl">SSL</option>
                  <option value="off">No SSL</option>
                </select>
              </div>
            </div>

            <!-- Outbound Test Result -->
            <div v-if="outboundTestResult" class="p-3 rounded-xl text-xs" :class="outboundTestResult.result === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
              {{ outboundTestResult.result === 'ok' ? __('Outbound connection test successful!') : (outboundTestResult.message || __('Outbound test failed.')) }}
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                v-if="accountForm.outbound_adapter === 'smtp'"
                type="button"
                class="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                @click="testOutboundConnection"
              >
                {{ isTestingOutbound ? __('Testing...') : __('Test Outbound') }}
              </button>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                  @click="accountWizardStep = 2"
                >
                  {{ __('Back') }}
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  :disabled="isSaving"
                  @click="submitAccountForm"
                >
                  <CommonIcon v-if="isSaving" name="arrow-repeat" class="w-3.5 h-3.5 animate-spin" />
                  <span>{{ isSaving ? __('Verifying & Saving...') : __('Save Account') }}</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: NOTIFICATION OUTBOUND SERVICE                   -->
      <!-- ======================================================= -->
      <div
        v-if="isNotificationModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Configure Notification Service')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Notification Outbound Service') }}</h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isNotificationModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label for="notif-adapter" class="block text-xs font-semibold mb-1">{{ __('Delivery Method') }}</label>
              <select id="notif-adapter" v-model="notificationForm.adapter" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                <option value="smtp">SMTP</option>
                <option value="sendmail">Sendmail</option>
              </select>
            </div>
            <div v-if="notificationForm.adapter === 'smtp'" class="space-y-3">
              <div>
                <label for="notif-host" class="block text-xs font-semibold mb-1">{{ __('Host') }}</label>
                <input id="notif-host" v-model="notificationForm.host" type="text" placeholder="smtp.example.com" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="notif-user" class="block text-xs font-semibold mb-1">{{ __('User') }}</label>
                  <input id="notif-user" v-model="notificationForm.user" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
                </div>
                <div>
                  <label for="notif-password" class="block text-xs font-semibold mb-1">{{ __('Password') }}</label>
                  <input id="notif-password" v-model="notificationForm.password" type="password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="notif-port" class="block text-xs font-semibold mb-1">{{ __('Port') }}</label>
                  <input id="notif-port" v-model="notificationForm.port" type="text" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
                </div>
                <div>
                  <label for="notif-ssl" class="block text-xs font-semibold mb-1">{{ __('SSL / STARTTLS') }}</label>
                  <select id="notif-ssl" v-model="notificationForm.ssl" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
                    <option value="starttls">STARTTLS</option>
                    <option value="ssl">SSL</option>
                    <option value="off">No SSL</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isNotificationModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              :disabled="isSaving"
              @click="saveNotificationChannel"
            >
              {{ isSaving ? __('Saving...') : __('Save Notification Service') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: CHANGE DESTINATION GROUP                        -->
      <!-- ======================================================= -->
      <div
        v-if="isChangeGroupModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Change Destination Group')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">{{ __('Change Destination Group') }}</h3>
          <p class="text-xs text-slate-500 mb-4">
            {{ __('Select which group incoming emails to this account will be assigned to by default.') }}
          </p>

          <div>
            <label for="cg-target" class="block text-xs font-semibold mb-1">{{ __('Destination Group') }}</label>
            <select id="cg-target" v-model="changeGroupTargetId" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs">
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isChangeGroupModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              @click="saveChangeGroup"
            >
              {{ __('Save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: ADD / EDIT EMAIL ALIAS                          -->
      <!-- ======================================================= -->
      <div
        v-if="isAliasModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Linked Email Address')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">{{ __('Add Email Address / Alias') }}</h3>

          <div class="space-y-3">
            <div>
              <label for="alias-name" class="block text-xs font-semibold mb-1">{{ __('Display Name') }}</label>
              <input id="alias-name" v-model="aliasForm.name" type="text" placeholder="e.g. Sales Department" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
            </div>
            <div>
              <label for="alias-email" class="block text-xs font-semibold mb-1">{{ __('Email Address') }}</label>
              <input id="alias-email" v-model="aliasForm.email" type="email" placeholder="sales@example.com" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono" />
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isAliasModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              @click="saveAlias"
            >
              {{ __('Save Alias') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: POSTMASTER FILTER                                -->
      <!-- ======================================================= -->
      <div
        v-if="isFilterModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Postmaster Filter')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {{ editingFilterId ? __('Edit Postmaster Filter') : __('New Postmaster Filter') }}
            </h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isFilterModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label for="pf-name" class="block text-xs font-semibold mb-1">{{ __('Filter Name') }}</label>
                <input id="pf-name" v-model="filterForm.name" type="text" placeholder="e.g. VIP Customer Routing" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input v-model="filterForm.active" type="checkbox" class="rounded border-slate-300 text-blue-600" />
                  <span>{{ __('Active') }}</span>
                </label>
              </div>
            </div>

            <!-- Conditions Section -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-blue-600">{{ __('Match Conditions (Email Headers)') }}</span>
                <button
                  type="button"
                  class="text-xs font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  @click="filterForm.conditions.push({ header: 'from', operator: 'contains', value: '' })"
                >
                  <CommonIcon name="plus" class="w-3 h-3" />
                  {{ __('Add Condition') }}
                </button>
              </div>

              <div
                v-for="(c, idx) in filterForm.conditions"
                :key="idx"
                class="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700"
              >
                <div class="sm:col-span-4">
                  <select v-model="c.header" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs" :aria-label="__('Header')">
                    <option value="from">From</option>
                    <option value="to">To</option>
                    <option value="cc">CC</option>
                    <option value="subject">Subject</option>
                    <option value="body">Body</option>
                    <option value="x-spam-flag">X-Spam-Flag</option>
                    <option value="x-spam-status">X-Spam-Status</option>
                  </select>
                </div>
                <div class="sm:col-span-3">
                  <select v-model="c.operator" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs" :aria-label="__('Operator')">
                    <option value="contains">contains</option>
                    <option value="contains not">contains not</option>
                    <option value="is">is</option>
                    <option value="is not">is not</option>
                    <option value="regex">regex</option>
                  </select>
                </div>
                <div class="sm:col-span-4">
                  <input v-model="c.value" type="text" placeholder="Value..." class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs" :aria-label="__('Value')" />
                </div>
                <div class="sm:col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    class="text-slate-400 hover:text-red-500 cursor-pointer"
                    :title="__('Remove condition')"
                    :aria-label="__('Remove condition')"
                    @click="filterForm.conditions.splice(idx, 1)"
                  >
                    <CommonIcon name="x" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Actions Section -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-600">{{ __('Perform Actions') }}</span>
                <button
                  type="button"
                  class="text-xs font-semibold text-amber-600 hover:underline cursor-pointer flex items-center gap-1"
                  @click="filterForm.actions.push({ target: 'x-zammad-ticket-group_id', value: String(groups[0]?.id ?? 1) })"
                >
                  <CommonIcon name="plus" class="w-3 h-3" />
                  {{ __('Add Action') }}
                </button>
              </div>

              <div
                v-for="(a, idx) in filterForm.actions"
                :key="idx"
                class="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700"
              >
                <div class="sm:col-span-6">
                  <select v-model="a.target" class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs" :aria-label="__('Target')">
                    <option value="x-zammad-ticket-group_id">Set Group</option>
                    <option value="x-zammad-ticket-priority_id">Set Priority ID</option>
                    <option value="x-zammad-ticket-state_id">Set State ID</option>
                    <option value="x-zammad-ticket-tags">Add Tags</option>
                    <option value="x-zammad-ignore">Ignore (Do not create ticket)</option>
                  </select>
                </div>
                <div class="sm:col-span-5">
                  <select
                    v-if="a.target === 'x-zammad-ticket-group_id'"
                    v-model="a.value"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    :aria-label="__('Target Group')"
                  >
                    <option v-for="g in groups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
                  </select>
                  <input
                    v-else
                    v-model="a.value"
                    type="text"
                    placeholder="Value..."
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs"
                    :aria-label="__('Action Value')"
                  />
                </div>
                <div class="sm:col-span-1 flex items-center justify-center">
                  <button
                    type="button"
                    class="text-slate-400 hover:text-red-500 cursor-pointer"
                    :title="__('Remove action')"
                    :aria-label="__('Remove action')"
                    @click="filterForm.actions.splice(idx, 1)"
                  >
                    <CommonIcon name="x" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isFilterModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              :disabled="isSaving"
              @click="saveFilter"
            >
              {{ isSaving ? __('Saving...') : __('Save Filter') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MODAL: SIGNATURE                                       -->
      <!-- ======================================================= -->
      <div
        v-if="isSignatureModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        :aria-label="__('Signature Configuration')"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">
              {{ editingSignatureId ? __('Edit Signature') : __('New Signature') }}
            </h3>
            <button
              type="button"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              :aria-label="__('Close modal')"
              @click="isSignatureModalOpen = false"
            >
              <CommonIcon name="x" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label for="sig-name" class="block text-xs font-semibold mb-1">{{ __('Signature Name') }}</label>
                <input id="sig-name" v-model="signatureForm.name" type="text" placeholder="e.g. Standard Support" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs" />
              </div>
              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input v-model="signatureForm.active" type="checkbox" class="rounded border-slate-300 text-blue-600" />
                  <span>{{ __('Active') }}</span>
                </label>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="sig-body" class="block text-xs font-semibold">{{ __('Body') }}</label>
                <span class="text-[11px] text-slate-400">{{ __('Click variable to insert') }}:</span>
              </div>

              <!-- Variable Insert Chips -->
              <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-slate-700 dark:text-slate-300 hover:text-blue-800 transition-colors cursor-pointer"
                  @click="insertVariableIntoSignature('#{user.firstname}')"
                >
                  #{user.firstname}
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-slate-700 dark:text-slate-300 hover:text-blue-800 transition-colors cursor-pointer"
                  @click="insertVariableIntoSignature('#{user.lastname}')"
                >
                  #{user.lastname}
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-slate-700 dark:text-slate-300 hover:text-blue-800 transition-colors cursor-pointer"
                  @click="insertVariableIntoSignature('#{config.product_name}')"
                >
                  #{config.product_name}
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 text-slate-700 dark:text-slate-300 hover:text-blue-800 transition-colors cursor-pointer"
                  @click="insertVariableIntoSignature('#{config.fqdn}')"
                >
                  #{config.fqdn}
                </button>
              </div>

              <textarea
                id="sig-body"
                v-model="signatureForm.body"
                rows="6"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              ></textarea>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
              @click="isSignatureModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              :disabled="isSaving"
              @click="saveSignature"
            >
              {{ isSaving ? __('Saving...') : __('Save Signature') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
