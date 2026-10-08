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

interface ExternalCredentialRecord {
  id?: number
  name: string
  credentials?: {
    client_id?: string
    client_secret?: string
    [key: string]: unknown
  }
}

interface ChannelAccount {
  id: number
  area: string
  active: boolean
  group_id?: number
  options?: {
    backup_imap_classic?: {
      attributes?: Record<string, unknown>
    }
    auth?: {
      client_id?: string
      [key: string]: unknown
    }
    inbound?: {
      adapter?: string
      options?: {
        folder?: string
        keep_on_server?: boolean
        shared_mailbox?: string
        user?: string
        [key: string]: unknown
      }
    }
    [key: string]: unknown
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

interface DecoratedChannel extends ChannelAccount {
  group?: GroupRecord
  email_addresses: EmailAddressRecord[]
  needs_reauthentication: boolean
}

const router = useRouter()

// State
const activeTab = ref<'accounts' | 'filters' | 'signatures' | 'settings'>('accounts')
const isLoading = ref(true)
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Accounts Data
const accountChannels = ref<DecoratedChannel[]>([])
const externalCredential = ref<ExternalCredentialRecord | null>(null)
const callbackUrl = ref('')
const notUsedEmailAddresses = ref<EmailAddressRecord[]>([])
const emailAddresses = ref<EmailAddressRecord[]>([])
const groups = ref<GroupRecord[]>([])

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
const isAppConfigModalOpen = ref(false)
const appConfigClientId = ref('')
const appConfigClientSecret = ref('')
const isClientSecretVisible = ref(false)
const appConfigError = ref('')

const isInboundModalOpen = ref(false)
const editingChannel = ref<DecoratedChannel | null>(null)
const inboundGroupId = ref<number>(1)
const inboundGroupEmailAddressId = ref<number | undefined>(undefined)
const inboundFolder = ref('INBOX')
const inboundKeepOnServer = ref(false)

const isChangeGroupModalOpen = ref(false)
const changeGroupChannel = ref<DecoratedChannel | null>(null)
const changeGroupTargetId = ref<number>(1)
const changeGroupEmailAddressId = ref<number | undefined>(undefined)

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
  { label: __('Microsoft 365') },
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

const isAppConfigured = computed(() => {
  return Boolean(externalCredential.value?.credentials?.client_id)
})

const hasUnsavedSettings = computed(() => {
  return JSON.stringify(formSettings.value) !== JSON.stringify(initialFormSettings.value)
})

const availableEmailAddressesForGroup = computed(() => {
  return emailAddresses.value.filter((e) => e.active)
})

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(__('Copied to clipboard.'))
  } catch (err) {
    showError(__('Failed to copy to clipboard.'))
    console.error(err)
  }
}

// Load All Data
const loadAllData = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const [msRes, filtersRes, signaturesRes, settingsRes, groupsRes] = await Promise.all([
      fetch('/api/v1/channels_microsoft365', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/postmaster_filters', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/signatures', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/settings', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
      fetch('/api/v1/groups', { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }),
    ])

    if (msRes.ok) {
      const data = await msRes.json()
      const assets = data.assets || {}
      callbackUrl.value = data.callback_url || `${window.location.origin}/api/v1/external_credentials/microsoft365/callback`

      const credMap = assets.ExternalCredential || {}
      const msCred = Object.values(credMap).find((c: unknown) => {
        const item = c as ExternalCredentialRecord
        return item.name === 'microsoft365'
      }) as ExternalCredentialRecord | undefined

      externalCredential.value = msCred || null
      if (msCred?.credentials?.client_id) {
        appConfigClientId.value = msCred.credentials.client_id
      }
      if (msCred?.credentials?.client_secret) {
        appConfigClientSecret.value = msCred.credentials.client_secret
      }

      const addrMap = assets.EmailAddress || {}
      emailAddresses.value = Object.values(addrMap) as EmailAddressRecord[]

      const notUsedIds: number[] = data.not_used_email_address_ids || []
      notUsedEmailAddresses.value = notUsedIds.map((id) => addrMap[id] as EmailAddressRecord).filter(Boolean)

      if (assets.Group) {
        groups.value = Object.values(assets.Group) as GroupRecord[]
      }

      const channelMap = assets.Channel || {}
      const channelIds: number[] = data.channel_ids || []
      accountChannels.value = channelIds.map((id) => {
        const ch = channelMap[id] as ChannelAccount
        const group = ch?.group_id ? (assets.Group?.[ch.group_id] as GroupRecord) : undefined
        const chEmailAddresses = emailAddresses.value.filter((e) => e.channel_id === ch?.id)
        const currentClientId = externalCredential.value?.credentials?.client_id
        const channelClientId = ch?.options?.auth?.client_id
        const needsReauth = Boolean(currentClientId && channelClientId && currentClientId !== channelClientId)

        return Object.assign({}, ch, {
          group,
          email_addresses: chEmailAddresses,
          needs_reauthentication: needsReauth,
        })
      }).filter(Boolean)
    }

    if (groupsRes.ok && groups.value.length === 0) {
      groups.value = await groupsRes.json()
    }

    if (filtersRes.ok) {
      postmasterFilters.value = await filtersRes.json()
    }

    if (signaturesRes.ok) {
      signatures.value = await signaturesRes.json()
    }

    if (settingsRes.ok) {
      const allSettings: SettingRecord[] = await settingsRes.json()
      const map: Record<string, SettingRecord> = {}
      allSettings.forEach((s) => {
        map[s.name] = s
      })
      settingsMap.value = map

      const cur = (key: string, fallback: unknown) => {
        return map[key]?.state_current?.value ?? map[key]?.state_initial?.value ?? fallback
      }

      formSettings.value = {
        ticket_subject_size: Number(cur('ticket_subject_size', 110)),
        ticket_subject_re: String(cur('ticket_subject_re', 'RE')),
        ticket_subject_fwd: String(cur('ticket_subject_fwd', 'FWD')),
        ticket_define_email_from: String(cur('ticket_define_email_from', 'AgentNameSystemAddressName')),
        ticket_define_email_from_separator: String(cur('ticket_define_email_from_separator', 'via')),
        postmaster_max_size: Number(cur('postmaster_max_size', 10)),
        postmaster_send_reject_if_mail_too_large: Boolean(cur('postmaster_send_reject_if_mail_too_large', true)),
        postmaster_follow_up_search_in: (cur('postmaster_follow_up_search_in', ['subject_references']) as string[]) || ['subject_references'],
        postmaster_sender_is_agent_search_for_customer: Boolean(cur('postmaster_sender_is_agent_search_for_customer', true)),
        notification_sender: String(cur('notification_sender', '')),
        send_no_auto_response_reg_exp: String(cur('send_no_auto_response_reg_exp', '(mailer-daemon|postmaster|abuse|root|noreply|noreply.+?|no-reply|no-reply.+?)@.+?')),
      }
      initialFormSettings.value = { ...formSettings.value }
    }
  } catch (e) {
    showError(__('Failed to load Microsoft 365 Channel data.'))
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// App Config Actions
const openAppConfigModal = () => {
  appConfigError.value = ''
  if (externalCredential.value?.credentials) {
    appConfigClientId.value = externalCredential.value.credentials.client_id || ''
    appConfigClientSecret.value = externalCredential.value.credentials.client_secret || ''
  }
  isAppConfigModalOpen.value = true
}

const saveAppConfig = async () => {
  if (!appConfigClientId.value || !appConfigClientSecret.value) {
    appConfigError.value = __('Please provide both Application ID and Client Secret.')
    return
  }

  isSaving.value = true
  appConfigError.value = ''

  try {
    const verifyRes = await fetch('/api/v1/external_credentials/microsoft365/app_verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        client_id: appConfigClientId.value.trim(),
        client_secret: appConfigClientSecret.value.trim(),
      }),
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || !verifyData.attributes) {
      appConfigError.value = verifyData.error_human || verifyData.error || __('Microsoft 365 App could not be verified. Please check Application ID and Secret.')
      return
    }

    const isEdit = Boolean(externalCredential.value?.id)
    const credUrl = isEdit ? `/api/v1/external_credentials/${externalCredential.value?.id}` : '/api/v1/external_credentials'
    const credMethod = isEdit ? 'PUT' : 'POST'

    const saveRes = await fetch(credUrl, {
      method: credMethod,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        name: 'microsoft365',
        credentials: verifyData.attributes,
      }),
    })

    if (!saveRes.ok) {
      const errData = await saveRes.json()
      appConfigError.value = errData.error_human || errData.error || __('Failed to save Microsoft 365 App credentials.')
      return
    }

    isAppConfigModalOpen.value = false
    showSuccess(__('Microsoft 365 App credentials saved successfully.'))
    await loadAllData()
  } catch (e) {
    appConfigError.value = __('An unexpected error occurred.')
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Channel Actions
const linkAccount = () => {
  window.location.href = '/api/v1/external_credentials/microsoft365/link_account'
}

const requestAdminConsent = () => {
  window.location.href = '/api/v1/external_credentials/microsoft365/link_account?prompt=consent'
}

const reauthenticateChannel = (channel: DecoratedChannel) => {
  window.location.href = `/api/v1/external_credentials/microsoft365/link_account?channel_id=${channel.id}`
}

const toggleChannelActive = async (channel: DecoratedChannel) => {
  isSaving.value = true
  try {
    const url = channel.active ? '/api/v1/channels_microsoft365_disable' : '/api/v1/channels_microsoft365_enable'
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
      showSuccess(channel.active ? __('Channel disabled.') : __('Channel enabled.'))
      await loadAllData()
    } else {
      showError(__('Failed to change channel state.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const deleteChannel = async (channel: DecoratedChannel) => {
  if (!confirm(__('Are you sure you want to delete this Microsoft 365 account channel?'))) {
    return
  }
  isSaving.value = true
  try {
    const res = await fetch('/api/v1/channels_microsoft365', {
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
      showSuccess(__('Microsoft 365 account channel deleted.'))
      await loadAllData()
    } else {
      showError(__('Failed to delete channel.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const rollbackMigration = async (channel: DecoratedChannel) => {
  if (!confirm(__('Are you sure you want to rollback migration to classic IMAP?'))) {
    return
  }
  isSaving.value = true
  try {
    const res = await fetch('/api/v1/channels_microsoft365_rollback_migration', {
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
      showSuccess(__('Rollback of channel migration succeeded.'))
      await loadAllData()
    } else {
      showError(__('Failed to roll back channel migration.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Inbound Edit Modal
const openInboundModal = (channel: DecoratedChannel) => {
  editingChannel.value = channel
  inboundGroupId.value = channel.group_id || groups.value[0]?.id || 1
  inboundGroupEmailAddressId.value = channel.email_addresses[0]?.id
  inboundFolder.value = channel.options?.inbound?.options?.folder || 'INBOX'
  inboundKeepOnServer.value = channel.options?.inbound?.options?.keep_on_server || false
  isInboundModalOpen.value = true
}

const saveInbound = async () => {
  if (!editingChannel.value) return
  isSaving.value = true
  try {
    const probeRes = await fetch(`/api/v1/channels_microsoft365_inbound/${editingChannel.value.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        group_id: inboundGroupId.value,
        options: {
          folder: inboundFolder.value,
          keep_on_server: inboundKeepOnServer.value,
        },
      }),
    })

    if (!probeRes.ok) {
      const err = await probeRes.json()
      showError(err.message_human || err.message || err.error_human || err.error || __('Failed to probe Microsoft 365 inbound mailbox.'))
      return
    }

    const verifyRes = await fetch(`/api/v1/channels_microsoft365_verify/${editingChannel.value.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        group_id: inboundGroupId.value,
        group_email_address_id: inboundGroupEmailAddressId.value,
        group_email_address: Boolean(inboundGroupEmailAddressId.value),
        options: {
          folder: inboundFolder.value,
          keep_on_server: inboundKeepOnServer.value,
        },
      }),
    })

    if (verifyRes.ok) {
      isInboundModalOpen.value = false
      showSuccess(__('Inbound configuration updated.'))
      await loadAllData()
    } else {
      const err = await verifyRes.json()
      showError(err.error_human || err.error || __('Failed to verify and save inbound configuration.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Change Group Modal
const openChangeGroupModal = (channel: DecoratedChannel) => {
  changeGroupChannel.value = channel
  changeGroupTargetId.value = channel.group_id || groups.value[0]?.id || 1
  changeGroupEmailAddressId.value = channel.email_addresses[0]?.id
  isChangeGroupModalOpen.value = true
}

const saveChangeGroup = async () => {
  if (!changeGroupChannel.value) return
  isSaving.value = true
  try {
    const res = await fetch(`/api/v1/channels_microsoft365_group/${changeGroupChannel.value.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        group_id: changeGroupTargetId.value,
        group_email_address_id: changeGroupEmailAddressId.value,
        group_email_address: Boolean(changeGroupEmailAddressId.value),
      }),
    })

    if (res.ok) {
      isChangeGroupModalOpen.value = false
      showSuccess(__('Destination group updated.'))
      await loadAllData()
    } else {
      showError(__('Failed to update destination group.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// Alias / Email Address Actions
const openNewAliasModal = (channelId: number) => {
  aliasForm.value = {
    id: null,
    channel_id: channelId,
    name: '',
    email: '',
    active: true,
  }
  isAliasModalOpen.value = true
}

const openEditAliasModal = (addr: EmailAddressRecord) => {
  aliasForm.value = {
    id: addr.id,
    channel_id: addr.channel_id,
    name: addr.name || '',
    email: addr.email || '',
    active: addr.active !== false,
  }
  isAliasModalOpen.value = true
}

const saveAlias = async () => {
  if (!aliasForm.value.email) {
    showError(__('Please provide an email address.'))
    return
  }
  isSaving.value = true
  try {
    const isEdit = Boolean(aliasForm.value.id)
    const url = isEdit ? `/api/v1/email_addresses/${aliasForm.value.id}` : '/api/v1/email_addresses'
    const method = isEdit ? 'PUT' : 'POST'

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
      isAliasModalOpen.value = false
      showSuccess(__('Email address saved.'))
      await loadAllData()
    } else {
      showError(__('Failed to save email address.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  } finally {
    isSaving.value = false
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
      showSuccess(__('Email address deleted.'))
      await loadAllData()
    } else {
      showError(__('Failed to delete email address.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred.'))
    console.error(e)
  }
}

// Filter Actions
const openNewFilterModal = () => {
  editingFilterId.value = null
  filterForm.value = {
    name: '',
    active: true,
    note: '',
    conditions: [{ header: 'from', operator: 'contains', value: '' }],
    actions: [{ target: 'group_id', value: String(groups.value[0]?.id || 1) }],
  }
  isFilterModalOpen.value = true
}

const openEditFilterModal = (filter: PostmasterFilterRecord) => {
  editingFilterId.value = filter.id ?? null
  const conditions = Object.entries(filter.match || {}).map(([header, val]) => {
    if (typeof val === 'object' && val !== null) {
      return { header, operator: val.operator || 'contains', value: val.value || '' }
    }
    return { header, operator: 'contains', value: String(val) }
  })

  const actions = Object.entries(filter.perform || {}).map(([target, val]) => {
    if (typeof val === 'object' && val !== null && 'value' in val) {
      return { target, value: String((val as { value: unknown }).value) }
    }
    return { target, value: String(val) }
  })

  filterForm.value = {
    name: filter.name,
    active: filter.active,
    note: filter.note || '',
    conditions: conditions.length > 0 ? conditions : [{ header: 'from', operator: 'contains', value: '' }],
    actions: actions.length > 0 ? actions : [{ target: 'group_id', value: String(groups.value[0]?.id || 1) }],
  }
  isFilterModalOpen.value = true
}

const addFilterCondition = () => {
  filterForm.value.conditions.push({ header: 'subject', operator: 'contains', value: '' })
}

const removeFilterCondition = (idx: number) => {
  if (filterForm.value.conditions.length > 1) {
    filterForm.value.conditions.splice(idx, 1)
  }
}

const addFilterAction = () => {
  filterForm.value.actions.push({ target: 'tag', value: '' })
}

const removeFilterAction = (idx: number) => {
  if (filterForm.value.actions.length > 1) {
    filterForm.value.actions.splice(idx, 1)
  }
}

const saveFilter = async () => {
  if (!filterForm.value.name) {
    showError(__('Please enter a filter name.'))
    return
  }
  isSaving.value = true
  try {
    const matchObj: Record<string, { operator: string; value: string }> = {}
    filterForm.value.conditions.forEach((c) => {
      if (c.header && c.value) {
        matchObj[c.header] = { operator: c.operator, value: c.value }
      }
    })

    const performObj: Record<string, { value: string }> = {}
    filterForm.value.actions.forEach((a) => {
      if (a.target && a.value) {
        performObj[a.target] = { value: a.value }
      }
    })

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
    if (results.every(Boolean)) {
      initialFormSettings.value = { ...formSettings.value }
      showSuccess(__('Settings updated successfully.'))
    } else {
      showError(__('Some settings could not be updated.'))
    }
  } catch (e) {
    showError(__('An unexpected error occurred saving settings.'))
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

const resetEmailSettings = () => {
  formSettings.value = { ...initialFormSettings.value }
}

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100 max-w-5xl mx-auto">
      
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
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CommonIcon name="microsoft" class="w-4 h-4" />
              </div>
              <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                {{ __('Microsoft 365 IMAP Email Channel') }}
              </h1>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 ltr:ml-11 rtl:mr-11">
            {{ __('Manage connected Microsoft 365 accounts using OAuth and IMAP protocols.') }}
          </p>
        </div>

        <!-- Global Notifications/Actions -->
        <div class="flex items-center gap-2">
          <button
            v-if="isAppConfigured && activeTab === 'accounts'"
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="openAppConfigModal"
          >
            {{ __('Configure App') }}
          </button>
          <button
            v-if="isAppConfigured && activeTab === 'accounts'"
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            @click="requestAdminConsent"
          >
            {{ __('Request Admin Consent') }}
          </button>
          <button
            v-if="isAppConfigured && activeTab === 'accounts'"
            type="button"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            @click="linkAccount"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            {{ __('Add Account') }}
          </button>
          <button
            v-if="activeTab === 'filters'"
            type="button"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            @click="openNewFilterModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            {{ __('New Filter') }}
          </button>
          <button
            v-if="activeTab === 'signatures'"
            type="button"
            class="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            @click="openNewSignatureModal"
          >
            <CommonIcon name="plus" class="w-3.5 h-3.5" />
            {{ __('New Signature') }}
          </button>
        </div>
      </div>

      <!-- Advisory Alert Banner for Graph API Recommendation -->
      <div class="mb-5 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3 shadow-xs">
        <CommonIcon name="info" class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div class="space-y-1">
          <span class="font-bold block">{{ __('Graph API Recommendation:') }}</span>
          <p class="leading-relaxed">
            {{ __('Compared to the Microsoft 365 Graph API Email Channel, this is the traditional implementation using OAuth and IMAP. When setting up new channels, we suggest using the Graph API implementation instead.') }}
            <a
              href="https://admin-docs.zammad.org/en/latest/channels/microsoft365/index.html"
              target="_blank"
              rel="noopener noreferrer"
              class="underline font-semibold hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-0.5 ltr:ml-1 rtl:mr-1"
            >
              {{ __('More information') }}
              <CommonIcon name="external-link" class="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>

      <!-- Feedback Alerts -->
      <div v-if="successMessage" class="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="check-circle" class="w-4 h-4 shrink-0 text-emerald-500" />
        <span>{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 shadow-xs">
        <CommonIcon name="alert-triangle" class="w-4 h-4 shrink-0 text-rose-500" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ __('Loading Microsoft 365 Channel settings...') }}</p>
      </div>

      <div v-else>
        <!-- Nav Tabs -->
        <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2"
            :class="activeTab === 'accounts' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'accounts'"
          >
            <CommonIcon name="microsoft" class="w-3.5 h-3.5" />
            {{ __('Accounts') }}
            <span
              v-if="accountChannels.length > 0"
              class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold"
            >
              {{ accountChannels.length }}
            </span>
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2"
            :class="activeTab === 'filters' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'filters'"
          >
            <CommonIcon name="filter" class="w-3.5 h-3.5" />
            {{ __('Filters') }}
            <span
              v-if="postmasterFilters.length > 0"
              class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold"
            >
              {{ postmasterFilters.length }}
            </span>
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2"
            :class="activeTab === 'signatures' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'signatures'"
          >
            <CommonIcon name="edit" class="w-3.5 h-3.5" />
            {{ __('Signatures') }}
            <span
              v-if="signatures.length > 0"
              class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold"
            >
              {{ signatures.length }}
            </span>
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2"
            :class="activeTab === 'settings' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'settings'"
          >
            <CommonIcon name="settings" class="w-3.5 h-3.5" />
            {{ __('Settings') }}
            <span v-if="hasUnsavedSettings" class="w-2 h-2 rounded-full bg-amber-500"></span>
          </button>
        </div>

        <!-- ================= ACCOUNTS TAB ================= -->
        <div v-if="activeTab === 'accounts'" class="space-y-6">
          
          <!-- Zero-state Onboarding when App is NOT configured -->
          <div v-if="!isAppConfigured" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xs text-center max-w-3xl mx-auto">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-200 dark:border-blue-900/60 shadow-xs">
              <CommonIcon name="microsoft" class="w-8 h-8" />
            </div>
            
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {{ __('Connect Microsoft 365 with Student Hub') }}
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto mb-6 leading-relaxed">
              {{ __('You can connect Microsoft 365 Email Accounts with Student Hub. But first, you will have to connect your Student Hub instance with Microsoft Entra ID.') }}
            </p>

            <button
              type="button"
              class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2 mb-8"
              @click="openAppConfigModal"
            >
              <CommonIcon name="settings" class="w-4 h-4" />
              {{ __('Connect Microsoft 365 App') }}
            </button>

            <!-- Guide Box -->
            <div class="text-left bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 space-y-4">
              <div class="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <CommonIcon name="info" class="w-4 h-4 text-blue-500" />
                {{ __('Microsoft Entra ID Registration Guide') }}
              </div>
              <ol class="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
                <li>
                  {{ __('In the Azure / Microsoft Entra ID portal, navigate to App registrations and create a new registration.') }}
                </li>
                <li>
                  <div class="inline">{{ __('Under Authentication, add a Web platform with the Redirect URI:') }}</div>
                  <div class="mt-1.5 flex items-center gap-2">
                    <input
                      id="ms_guide_callback_url"
                      type="text"
                      readonly
                      :value="callbackUrl"
                      :aria-label="__('Redirect URI')"
                      class="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300"
                    />
                    <button
                      type="button"
                      class="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      @click="copyToClipboard(callbackUrl)"
                    >
                      {{ __('Copy') }}
                    </button>
                  </div>
                </li>
                <li>
                  {{ __('Under Certificates & secrets, generate a new Client Secret.') }}
                </li>
                <li>
                  {{ __('Under API permissions, add delegated permissions for IMAP.AccessAsUser.All, POP.AccessAsUser.All, and SMTP.Send.') }}
                </li>
                <li>
                  {{ __('Click "Connect Microsoft 365 App" above and provide your Application (client) ID and Client Secret.') }}
                </li>
              </ol>
            </div>
          </div>

          <!-- App is configured -->
          <div v-else class="space-y-6">

            <!-- Unassigned Email Addresses -->
            <div
              v-if="notUsedEmailAddresses.length > 0"
              class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-xs"
            >
              <div class="flex items-start gap-3">
                <CommonIcon name="alert-triangle" class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div class="flex-1">
                  <h3 class="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                    {{ __('Notice: Unassigned email addresses, assign them to a channel or delete them.') }}
                  </h3>
                  <div class="space-y-1.5 mt-2">
                    <div
                      v-for="addr in notUsedEmailAddresses"
                      :key="addr.id"
                      class="flex items-center justify-between text-xs py-1 px-2.5 bg-white/70 dark:bg-slate-900/70 rounded-lg border border-amber-200/60 dark:border-amber-900/60"
                    >
                      <span class="font-medium text-slate-800 dark:text-slate-200">
                        {{ addr.name }} &lt;{{ addr.email }}&gt;
                      </span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="text-blue-600 hover:text-blue-700 text-xs font-medium cursor-pointer"
                          @click="openEditAliasModal(addr)"
                        >
                          {{ __('Edit') }}
                        </button>
                        <button
                          type="button"
                          class="text-rose-600 hover:text-rose-700 text-xs font-medium cursor-pointer"
                          @click="deleteAlias(addr)"
                        >
                          {{ __('Delete') }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Accounts State -->
            <div
              v-if="accountChannels.length === 0"
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs"
            >
              <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <CommonIcon name="mail" class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                {{ __('No Microsoft 365 Accounts Connected') }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                {{ __('Click "Add Account" to authenticate your Microsoft 365 mailbox via OAuth and begin receiving and sending emails.') }}
              </p>
              <button
                type="button"
                class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                @click="linkAccount"
              >
                <CommonIcon name="plus" class="w-4 h-4" />
                {{ __('Add Account') }}
              </button>
            </div>

            <!-- Account Channels List -->
            <div
              v-for="channel in accountChannels"
              :key="channel.id"
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-all"
              :class="{ 'opacity-80 bg-slate-50/50 dark:bg-slate-900/50': !channel.active }"
            >
              <!-- Reauthentication warning -->
              <div
                v-if="channel.needs_reauthentication"
                class="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <CommonIcon name="alert-triangle" class="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{{ __('The app configuration has changed since this channel was authenticated. Please click "Reauthenticate" to keep it working.') }}</span>
                </div>
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shrink-0"
                  @click="reauthenticateChannel(channel)"
                >
                  {{ __('Reauthenticate') }}
                </button>
              </div>

              <!-- Two Column Layout: Inbound & Outbound -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                
                <!-- Inbound Column -->
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span
                        class="w-2.5 h-2.5 rounded-full"
                        :class="channel.status_in === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'"
                      ></span>
                      <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        {{ __('Inbound') }}
                      </h4>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                      @click="openInboundModal(channel)"
                    >
                      {{ __('Edit') }}
                    </button>
                  </div>

                  <div
                    v-if="channel.last_log_in"
                    class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
                  >
                    {{ channel.last_log_in }}
                  </div>

                  <div class="space-y-2 text-xs">
                    <div>
                      <span class="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{{ __('Destination Group') }}</span>
                      <button
                        type="button"
                        class="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer text-left"
                        @click="openChangeGroupModal(channel)"
                      >
                        {{ channel.group?.name || __('Unassigned Group') }}
                      </button>
                    </div>

                    <div v-if="channel.options?.inbound?.options?.folder">
                      <span class="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{{ __('Folder') }}</span>
                      <span class="font-mono text-slate-700 dark:text-slate-300">{{ channel.options.inbound.options.folder }}</span>
                    </div>

                    <div>
                      <span class="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{{ __('Keep messages on server') }}</span>
                      <span class="text-slate-700 dark:text-slate-300">
                        {{ channel.options?.inbound?.options?.keep_on_server ? __('Yes') : __('No') }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Outbound Column -->
                <div class="space-y-4">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full"
                      :class="channel.status_out === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'"
                    ></span>
                    <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      {{ __('Outbound') }}
                    </h4>
                  </div>

                  <div
                    v-if="channel.last_log_out"
                    class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
                  >
                    {{ channel.last_log_out }}
                  </div>

                  <div class="space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400 dark:text-slate-500 block text-[11px] font-medium">{{ __('Email Addresses') }}</span>
                      <button
                        type="button"
                        class="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs font-medium cursor-pointer"
                        @click="openNewAliasModal(channel.id)"
                      >
                        + {{ __('Add') }}
                      </button>
                    </div>

                    <div v-if="channel.email_addresses.length === 0" class="text-slate-400 italic">
                      {{ __('None') }}
                    </div>

                    <div class="space-y-1.5">
                      <div
                        v-for="addr in channel.email_addresses"
                        :key="addr.id"
                        class="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/60"
                      >
                        <span class="font-medium text-slate-800 dark:text-slate-200">
                          {{ addr.email }}
                        </span>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            class="text-blue-600 hover:text-blue-700 text-xs font-medium cursor-pointer"
                            @click="openEditAliasModal(addr)"
                          >
                            {{ __('Edit') }}
                          </button>
                          <button
                            v-if="channel.email_addresses.length > 1"
                            type="button"
                            class="text-rose-600 hover:text-rose-700 text-xs font-medium cursor-pointer"
                            @click="deleteAlias(addr)"
                          >
                            {{ __('Delete') }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Action Controls -->
              <div class="pt-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="channel.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'"
                  >
                    {{ channel.active ? __('Active') : __('Inactive') }}
                  </span>
                  <span class="text-xs text-slate-400 dark:text-slate-500">
                    Channel #{{ channel.id }}
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer"
                    :class="channel.active ? 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'"
                    @click="toggleChannelActive(channel)"
                  >
                    {{ channel.active ? __('Disable') : __('Enable') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    @click="reauthenticateChannel(channel)"
                  >
                    {{ __('Reauthenticate') }}
                  </button>
                  <button
                    v-if="channel.options?.backup_imap_classic"
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                    @click="rollbackMigration(channel)"
                  >
                    {{ __('Rollback Migration') }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    @click="deleteChannel(channel)"
                  >
                    {{ __('Delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= FILTERS TAB ================= -->
        <div v-if="activeTab === 'filters'" class="space-y-4">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ __('Postmaster Filters') }}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{ __('Rules applied to incoming emails across all mailboxes before ticket creation or processing.') }}
                </p>
              </div>
            </div>

            <div v-if="postmasterFilters.length === 0" class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {{ __('No postmaster filters defined yet. Click "New Filter" to add one.') }}
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
              <div
                v-for="filter in postmasterFilters"
                :key="filter.id"
                class="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      :class="filter.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                    >
                      {{ filter.active ? __('Active') : __('Inactive') }}
                    </span>
                    <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{{ filter.name }}</span>
                  </div>
                  <p v-if="filter.note" class="text-[11px] text-slate-500 dark:text-slate-400">{{ filter.note }}</p>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    @click="openEditFilterModal(filter)"
                  >
                    {{ __('Edit') }}
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                    @click="deleteFilter(filter)"
                  >
                    {{ __('Delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= SIGNATURES TAB ================= -->
        <div v-if="activeTab === 'signatures'" class="space-y-4">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div class="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ __('Email Signatures') }}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  {{ __('Signatures automatically appended to outbound emails by destination groups.') }}
                </p>
              </div>
            </div>

            <div v-if="signatures.length === 0" class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {{ __('No signatures defined yet. Click "New Signature" to add one.') }}
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
              <div
                v-for="sig in signatures"
                :key="sig.id"
                class="p-4 flex items-start justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
              >
                <div>
                  <div class="flex items-center gap-2 mb-1.5">
                    <span
                      class="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      :class="sig.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
                    >
                      {{ sig.active ? __('Active') : __('Inactive') }}
                    </span>
                    <span class="text-xs font-semibold text-slate-900 dark:text-slate-100">{{ sig.name }}</span>
                  </div>
                  <pre class="text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg max-w-xl">{{ sig.body }}</pre>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                    @click="openEditSignatureModal(sig)"
                  >
                    {{ __('Edit') }}
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                    @click="deleteSignature(sig)"
                  >
                    {{ __('Delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= SETTINGS TAB ================= -->
        <div v-if="activeTab === 'settings'" class="space-y-6">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{{ __('General Email Settings') }}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ __('Configuration values applied to all inbound and outbound email channels (Email::Base).') }}
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label for="ms-set-subject-size" class="block text-xs font-semibold mb-1">{{ __('Ticket Subject Size Limit') }}</label>
                <input
                  id="ms-set-subject-size"
                  v-model.number="formSettings.ticket_subject_size"
                  type="number"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <p class="text-[11px] text-slate-400 mt-1">{{ __('Maximum character length for ticket subjects.') }}</p>
              </div>

              <div>
                <label for="ms-set-max-size" class="block text-xs font-semibold mb-1">{{ __('Maximum Email Size (MB)') }}</label>
                <input
                  id="ms-set-max-size"
                  v-model.number="formSettings.postmaster_max_size"
                  type="number"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <p class="text-[11px] text-slate-400 mt-1">{{ __('Reject emails larger than this size.') }}</p>
              </div>

              <div>
                <label for="ms-set-subject-re" class="block text-xs font-semibold mb-1">{{ __('Reply Prefix') }}</label>
                <input
                  id="ms-set-subject-re"
                  v-model="formSettings.ticket_subject_re"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label for="ms-set-subject-fwd" class="block text-xs font-semibold mb-1">{{ __('Forward Prefix') }}</label>
                <input
                  id="ms-set-subject-fwd"
                  v-model="formSettings.ticket_subject_fwd"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div class="md:col-span-2">
                <label for="ms-set-auto-response-regex" class="block text-xs font-semibold mb-1">{{ __('No Auto-Response Sender Regex') }}</label>
                <input
                  id="ms-set-auto-response-regex"
                  v-model="formSettings.send_no_auto_response_reg_exp"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div class="md:col-span-2 flex items-center gap-3">
                <input
                  id="ms-set-reject-too-large"
                  v-model="formSettings.postmaster_send_reject_if_mail_too_large"
                  type="checkbox"
                  class="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label for="ms-set-reject-too-large" class="text-xs font-medium cursor-pointer">
                  {{ __('Send rejection note to sender if email exceeds maximum size limit') }}
                </label>
              </div>

              <div class="md:col-span-2 flex items-center gap-3">
                <input
                  id="ms-set-agent-as-customer"
                  v-model="formSettings.postmaster_sender_is_agent_search_for_customer"
                  type="checkbox"
                  class="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label for="ms-set-agent-as-customer" class="text-xs font-medium cursor-pointer">
                  {{ __('If sender is an agent, search for customer address in mail body/headers') }}
                </label>
              </div>
            </div>

            <!-- Settings Actions -->
            <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                :disabled="!hasUnsavedSettings"
                @click="resetEmailSettings"
              >
                {{ __('Discard Changes') }}
              </button>
              <button
                type="button"
                class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                :disabled="!hasUnsavedSettings || isSaving"
                @click="saveEmailSettings"
              >
                {{ isSaving ? __('Saving...') : __('Save Settings') }}
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- ================= MODAL: CONNECT MICROSOFT 365 APP ================= -->
      <div
        v-if="isAppConfigModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CommonIcon name="microsoft" class="w-5 h-5 text-blue-600" />
              <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Connect Microsoft 365 App') }}</h3>
            </div>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isAppConfigModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div
              v-if="appConfigError"
              class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs"
            >
              {{ appConfigError }}
            </div>

            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {{ __('Enter your Azure / Microsoft Entra ID Application ID and Client Secret.') }}
            </p>

            <div>
              <label for="ms-client-id" class="block text-xs font-semibold mb-1">
                {{ __('Application (client) ID') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="ms-client-id"
                v-model="appConfigClientId"
                type="text"
                placeholder="00000000-0000-0000-0000-000000000000"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label for="ms-client-secret" class="block text-xs font-semibold mb-1">
                {{ __('Client Secret') }} <span class="text-rose-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="ms-client-secret"
                  v-model="appConfigClientSecret"
                  :type="isClientSecretVisible ? 'text' : 'password'"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono ltr:pr-10 rtl:pl-10"
                />
                <button
                  type="button"
                  class="absolute ltr:right-2.5 rtl:left-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  :aria-label="__('Toggle visibility')"
                  @click="isClientSecretVisible = !isClientSecretVisible"
                >
                  <CommonIcon :name="isClientSecretVisible ? 'eye-off' : 'eye'" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label for="ms-callback-url" class="block text-xs font-semibold mb-1">{{ __('Authorized Redirect URI') }}</label>
              <div class="flex items-center gap-2">
                <input
                  id="ms-callback-url"
                  type="text"
                  readonly
                  :value="callbackUrl"
                  :aria-label="__('Authorized Redirect URI')"
                  class="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer shrink-0"
                  @click="copyToClipboard(callbackUrl)"
                >
                  {{ __('Copy') }}
                </button>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <a
              href="https://admin-docs.zammad.org/en/latest/channels/microsoft365/index.html"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              {{ __('Documentation') }}
              <CommonIcon name="external-link" class="w-3 h-3" />
            </a>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                @click="isAppConfigModalOpen = false"
              >
                {{ __('Cancel') }}
              </button>
              <button
                type="button"
                class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
                :disabled="isSaving"
                @click="saveAppConfig"
              >
                {{ isSaving ? __('Verifying...') : __('Connect') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: EDIT INBOUND ================= -->
      <div
        v-if="isInboundModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Edit Inbound Channel') }}</h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isInboundModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="ms-inbound-group" class="block text-xs font-semibold mb-1">
                {{ __('Destination Group') }} <span class="text-rose-500">*</span>
              </label>
              <select
                id="ms-inbound-group"
                v-model="inboundGroupId"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="g in groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="ms-inbound-send-addr" class="block text-xs font-semibold mb-1">
                {{ __('Destination group > Sending email address') }}
              </label>
              <select
                id="ms-inbound-send-addr"
                v-model="inboundGroupEmailAddressId"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option :value="undefined">{{ __('Default group address') }}</option>
                <option v-for="a in availableEmailAddressesForGroup" :key="a.id" :value="a.id">
                  {{ a.name }} &lt;{{ a.email }}&gt;
                </option>
              </select>
            </div>

            <div>
              <label for="ms-inbound-folder" class="block text-xs font-semibold mb-1">{{ __('Folder') }}</label>
              <input
                id="ms-inbound-folder"
                v-model="inboundFolder"
                type="text"
                placeholder="INBOX"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div class="flex items-center gap-3 pt-2">
              <input
                id="ms-inbound-keep"
                v-model="inboundKeepOnServer"
                type="checkbox"
                class="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label for="ms-inbound-keep" class="text-xs font-medium cursor-pointer">
                {{ __('Keep messages on server') }}
              </label>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isInboundModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveInbound"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: CHANGE GROUP ================= -->
      <div
        v-if="isChangeGroupModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ __('Change Destination Group') }}</h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isChangeGroupModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="ms-change-group" class="block text-xs font-semibold mb-1">
                {{ __('Destination Group') }} <span class="text-rose-500">*</span>
              </label>
              <select
                id="ms-change-group"
                v-model="changeGroupTargetId"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option v-for="g in groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </div>

            <div>
              <label for="ms-change-group-email" class="block text-xs font-semibold mb-1">
                {{ __('Destination group > Sending email address') }}
              </label>
              <select
                id="ms-change-group-email"
                v-model="changeGroupEmailAddressId"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              >
                <option :value="undefined">{{ __('Default group address') }}</option>
                <option v-for="a in availableEmailAddressesForGroup" :key="a.id" :value="a.id">
                  {{ a.name }} &lt;{{ a.email }}&gt;
                </option>
              </select>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isChangeGroupModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveChangeGroup"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: EMAIL ADDRESS / ALIAS ================= -->
      <div
        v-if="isAliasModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ aliasForm.id ? __('Edit Email Address') : __('Add Email Address') }}
            </h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isAliasModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="ms-alias-realname" class="block text-xs font-semibold mb-1">{{ __('Display Name') }}</label>
              <input
                id="ms-alias-realname"
                v-model="aliasForm.name"
                type="text"
                placeholder="Support Team"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label for="ms-alias-email" class="block text-xs font-semibold mb-1">
                {{ __('Email Address') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="ms-alias-email"
                v-model="aliasForm.email"
                type="email"
                placeholder="support@company.com"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div class="flex items-center gap-3 pt-1">
              <input
                id="ms-alias-active"
                v-model="aliasForm.active"
                type="checkbox"
                class="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label for="ms-alias-active" class="text-xs font-medium cursor-pointer">
                {{ __('Active') }}
              </label>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isAliasModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveAlias"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: POSTMASTER FILTER ================= -->
      <div
        v-if="isFilterModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ editingFilterId ? __('Edit Filter') : __('New Filter') }}
            </h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isFilterModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="ms-filter-name" class="block text-xs font-semibold mb-1">
                  {{ __('Filter Name') }} <span class="text-rose-500">*</span>
                </label>
                <input
                  id="ms-filter-name"
                  v-model="filterForm.name"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label for="ms-filter-note" class="block text-xs font-semibold mb-1">{{ __('Note') }}</label>
                <input
                  id="ms-filter-note"
                  v-model="filterForm.note"
                  type="text"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            <div class="flex items-center gap-3">
              <input
                id="ms-filter-active"
                v-model="filterForm.active"
                type="checkbox"
                class="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label for="ms-filter-active" class="text-xs font-medium cursor-pointer">
                {{ __('Active') }}
              </label>
            </div>

            <!-- Conditions Section -->
            <div class="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ __('Filter Conditions (Match)') }}</span>
                <button
                  type="button"
                  class="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  @click="addFilterCondition"
                >
                  + {{ __('Add Condition') }}
                </button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="(cond, idx) in filterForm.conditions"
                  :key="idx"
                  class="flex items-center gap-2"
                >
                  <select
                    v-model="cond.header"
                    :aria-label="__('Condition Header')"
                    class="w-1/3 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                  >
                    <option value="from">From</option>
                    <option value="to">To</option>
                    <option value="cc">Cc</option>
                    <option value="subject">Subject</option>
                    <option value="body">Body</option>
                    <option value="x-spam-flag">X-Spam-Flag</option>
                  </select>

                  <select
                    v-model="cond.operator"
                    :aria-label="__('Condition Operator')"
                    class="w-1/4 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="contains">{{ __('contains') }}</option>
                    <option value="contains not">{{ __('contains not') }}</option>
                    <option value="is">{{ __('is') }}</option>
                    <option value="is not">{{ __('is not') }}</option>
                    <option value="starts with">{{ __('starts with') }}</option>
                    <option value="ends with">{{ __('ends with') }}</option>
                    <option value="matches regex">{{ __('matches regex') }}</option>
                  </select>

                  <input
                    v-model="cond.value"
                    type="text"
                    :placeholder="__('Value')"
                    :aria-label="__('Condition Value')"
                    class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />

                  <button
                    type="button"
                    class="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                    :title="__('Remove condition')"
                    :aria-label="__('Remove condition')"
                    @click="removeFilterCondition(idx)"
                  >
                    <CommonIcon name="trash" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Actions Section -->
            <div class="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ __('Filter Actions (Perform)') }}</span>
                <button
                  type="button"
                  class="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                  @click="addFilterAction"
                >
                  + {{ __('Add Action') }}
                </button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="(act, idx) in filterForm.actions"
                  :key="idx"
                  class="flex items-center gap-2"
                >
                  <select
                    v-model="act.target"
                    :aria-label="__('Action Target')"
                    class="w-1/3 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="group_id">{{ __('Destination Group') }}</option>
                    <option value="tag">{{ __('Add Tag') }}</option>
                    <option value="priority_id">{{ __('Priority') }}</option>
                    <option value="state_id">{{ __('State') }}</option>
                    <option value="ignore">{{ __('Ignore / Drop') }}</option>
                  </select>

                  <select
                    v-if="act.target === 'group_id'"
                    v-model="act.value"
                    :aria-label="__('Target Group')"
                    class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option v-for="g in groups" :key="g.id" :value="String(g.id)">
                      {{ g.name }}
                    </option>
                  </select>

                  <input
                    v-else
                    v-model="act.value"
                    type="text"
                    :placeholder="__('Value')"
                    :aria-label="__('Action Value')"
                    class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  />

                  <button
                    type="button"
                    class="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                    :title="__('Remove action')"
                    :aria-label="__('Remove action')"
                    @click="removeFilterAction(idx)"
                  >
                    <CommonIcon name="trash" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isFilterModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveFilter"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ================= MODAL: SIGNATURE ================= -->
      <div
        v-if="isSignatureModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      >
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
              {{ editingSignatureId ? __('Edit Signature') : __('New Signature') }}
            </h3>
            <button
              type="button"
              class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              :aria-label="__('Close dialog')"
              @click="isSignatureModalOpen = false"
            >
              <CommonIcon name="x" class="w-4 h-4" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div>
              <label for="ms-sig-name" class="block text-xs font-semibold mb-1">
                {{ __('Signature Name') }} <span class="text-rose-500">*</span>
              </label>
              <input
                id="ms-sig-name"
                v-model="signatureForm.name"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="ms-sig-body" class="block text-xs font-semibold">{{ __('Body') }}</label>
                <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>{{ __('Insert:') }}</span>
                  <button
                    type="button"
                    class="text-blue-600 hover:underline cursor-pointer"
                    @click="insertVariableIntoSignature('#{user.firstname}')"
                  >
                    #{user.firstname}
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    class="text-blue-600 hover:underline cursor-pointer"
                    @click="insertVariableIntoSignature('#{user.lastname}')"
                  >
                    #{user.lastname}
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    class="text-blue-600 hover:underline cursor-pointer"
                    @click="insertVariableIntoSignature('#{config.product_name}')"
                  >
                    #{config.product_name}
                  </button>
                </div>
              </div>
              <textarea
                id="ms-sig-body"
                v-model="signatureForm.body"
                rows="6"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
              ></textarea>
            </div>

            <div class="flex items-center gap-3">
              <input
                id="ms-sig-active"
                v-model="signatureForm.active"
                type="checkbox"
                class="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
              <label for="ms-sig-active" class="text-xs font-medium cursor-pointer">
                {{ __('Active') }}
              </label>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              class="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              @click="isSignatureModalOpen = false"
            >
              {{ __('Cancel') }}
            </button>
            <button
              type="button"
              class="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
              :disabled="isSaving"
              @click="saveSignature"
            >
              {{ isSaving ? __('Saving...') : __('Save') }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </LayoutContent>
</template>
