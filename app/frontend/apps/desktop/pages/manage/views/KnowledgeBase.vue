<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

interface KnowledgeBaseRecord {
  id: number
  active: boolean
  color_highlight: string
  color_header: string
  color_header_link: string
  iconset: string
  show_feed_icon: boolean
  custom_address?: string | null
  homepage_layout?: string
  category_layout?: string
  created_at?: string
  updated_at?: string
}

interface KbLocaleRecord {
  id: number
  knowledge_base_id: number
  system_locale_id: number
  primary: boolean
}

interface SystemLocale {
  id: number
  locale: string
  name: string
}

interface MenuItemRecord {
  id?: number
  kb_locale_id: number
  location: 'header' | 'footer'
  title: string
  url: string
  position?: number
  new_tab?: boolean
  _destroy?: boolean
}

interface VideoServer {
  name: string
  host: string
}

interface KnowledgeBaseTranslation {
  id: number
  knowledge_base_id: number
  kb_locale_id: number
  title?: string
  footer_note?: string
}

const router = useRouter()

// -------------------------------------------------------------
// State
// -------------------------------------------------------------

const activeTab = ref<'style' | 'languages' | 'menu' | 'video_servers' | 'custom_url' | 'danger'>('style')

const kb = ref<KnowledgeBaseRecord | null>(null)
const kbLocales = ref<KbLocaleRecord[]>([])
const systemLocales = ref<SystemLocale[]>([])
const menuItems = ref<MenuItemRecord[]>([])
const videoServers = ref<VideoServer[]>([])
const videoServerSettingId = ref<number | null>(null)
const kbTranslations = ref<KnowledgeBaseTranslation[]>([])

const isLoading = ref(true)
const isSaving = ref(false)
const isMasterSwitchLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Style / Theme form state
const formStyle = ref({
  color_highlight: '#38ae6a',
  color_header: '#f9fafb',
  color_header_link: 'hsl(206,8%,50%)',
  iconset: 'FontAwesome',
  show_feed_icon: false,
})

// Creation form state (when !kb)
const createFormState = ref({
  system_locale_id: null as number | null,
  color_highlight: '#38ae6a',
  color_header: '#f9fafb',
  color_header_link: 'hsl(206,8%,50%)',
  iconset: 'FontAwesome',
})
const isCreatingKb = ref(false)

// Custom Address state
const customAddress = ref('')
const serverSnippets = ref<{ nginx?: string; apache?: string; address?: string; address_type?: string; snippets?: { nginx?: string; apache?: string } } | null>(null)
const snippetsLoading = ref(false)
const showSnippetsModal = ref(false)
const activeSnippetTab = ref<'nginx' | 'apache'>('nginx')

// Languages modals / state
const showAddLanguageDrawer = ref(false)
const selectedLocaleToAdd = ref<number | null>(null)
const showDeleteLanguageModal = ref(false)
const localeToDelete = ref<KbLocaleRecord | null>(null)
const deleteLanguageConfirmInput = ref('')
const isDeletingLanguage = ref(false)

// Public Menu Drawer / state
const showMenuDrawer = ref(false)
const menuDrawerLocation = ref<'header' | 'footer'>('header')
const menuDrawerActiveLocaleId = ref<number | null>(null)
const drawerMenuItemsByLocale = ref<Record<number, MenuItemRecord[]>>({})
const isSavingMenu = ref(false)

// Video Server modal / state
const showVideoDrawer = ref(false)
const editingVideoIndex = ref<number | null>(null)
const videoForm = ref({ name: '', host: '' })
const isSavingVideoServer = ref(false)

// Danger Zone: Delete KB state
const deleteKbConfirmInput = ref('')
const isDeletingKb = ref(false)

const ICONSET_OPTIONS = [
  { value: 'FontAwesome', label: __('FontAwesome (Classic Icons)') },
  { value: 'material', label: __('Material Icons (Modern Google)') },
  { value: 'ionicons', label: __('Ionicons (Sleek Outline)') },
  { value: 'Simple-Line-Icons', label: __('Simple Line Icons (Minimalist)') },
  { value: 'anticon', label: __('Ant Design Icons') },
]

const breadcrumbItems = [
  { label: __('Administration'), route: '/manage' },
  { label: __('Knowledge Base') },
]

const getCsrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''

// -------------------------------------------------------------
// Computeds
// -------------------------------------------------------------

const guaranteedTitle = computed(() => {
  const primaryLoc = kbLocales.value.find((l) => l.primary)
  if (primaryLoc) {
    const t = kbTranslations.value.find((tr) => tr.kb_locale_id === primaryLoc.id)
    if (t?.title) return t.title
  }
  const first = kbTranslations.value[0]
  if (first?.title) return first.title
  return __('Knowledge Base')
})

const primaryKbLocale = computed(() => {
  return kbLocales.value.find((l) => l.primary) || kbLocales.value[0]
})

const getLocaleName = (systemLocaleId: number) => {
  const loc = systemLocales.value.find((l) => l.id === systemLocaleId)
  return loc ? `${loc.name} (${loc.locale})` : `#${systemLocaleId}`
}

const showNotification = (msg: string, isErr = false) => {
  if (isErr) {
    errorMessage.value = msg
    setTimeout(() => {
      errorMessage.value = ''
    }, 4000)
  } else {
    successMessage.value = msg
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  }
}

// -------------------------------------------------------------
// Fetch Data
// -------------------------------------------------------------

const fetchKnowledgeBase = async () => {
  isLoading.value = true
  try {
    const [initRes, localesRes, settingsRes] = await Promise.all([
      fetch('/api/v1/knowledge_bases/manage/init', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/locales', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
      fetch('/api/v1/settings', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    ])

    if (localesRes.ok) {
      systemLocales.value = await localesRes.json()
      if (systemLocales.value.length > 0 && !createFormState.value.system_locale_id) {
        createFormState.value.system_locale_id = systemLocales.value[0].id
      }
    }

    if (settingsRes.ok) {
      const settingsData: { id: number; name: string; state_current?: { value: unknown } }[] =
        await settingsRes.json()
      const videoSetting = settingsData.find((s) => s.name === 'kb_self_hosted_video_servers')
      if (videoSetting) {
        videoServerSettingId.value = videoSetting.id
        videoServers.value = Array.isArray(videoSetting.state_current?.value)
          ? (videoSetting.state_current.value as VideoServer[])
          : []
      }
    }

    if (initRes.ok) {
      const data = await initRes.json()
      const kbMap = data.KnowledgeBase || {}
      const kbList: KnowledgeBaseRecord[] = Object.values(kbMap)

      if (kbList.length > 0) {
        const currentKb = kbList[0]
        kb.value = currentKb
        formStyle.value = {
          color_highlight: currentKb.color_highlight || '#38ae6a',
          color_header: currentKb.color_header || '#f9fafb',
          color_header_link: currentKb.color_header_link || 'hsl(206,8%,50%)',
          iconset: currentKb.iconset || 'FontAwesome',
          show_feed_icon: Boolean(currentKb.show_feed_icon),
        }
        customAddress.value = currentKb.custom_address || ''
      } else {
        kb.value = null
      }

      const localeMap = data['KnowledgeBase::Locale'] || {}
      kbLocales.value = Object.values(localeMap)

      const menuMap = data['KnowledgeBase::MenuItem'] || {}
      menuItems.value = Object.values(menuMap)

      const transMap = data['KnowledgeBase::Translation'] || {}
      kbTranslations.value = Object.values(transMap)
    }
  } catch (e) {
    console.error('Failed to load Knowledge Base data:', e)
    showNotification(__('Error loading knowledge base data.'), true)
  } finally {
    isLoading.value = false
  }
}

// -------------------------------------------------------------
// Actions: Master Toggle
// -------------------------------------------------------------

const toggleActive = async () => {
  if (!kb.value || isMasterSwitchLoading.value) return
  isMasterSwitchLoading.value = true
  const action = kb.value.active ? 'deactivate' : 'activate'
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}/${action}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      kb.value.active = !kb.value.active
      showNotification(kb.value.active ? __('Knowledge base activated.') : __('Knowledge base deactivated.'))
    } else {
      showNotification(__('Failed to update status.'), true)
    }
  } catch (e) {
    console.error('Failed to toggle status:', e)
    showNotification(__('Network error updating status.'), true)
  } finally {
    isMasterSwitchLoading.value = false
  }
}

// -------------------------------------------------------------
// Actions: Initial KB Creation (when !kb)
// -------------------------------------------------------------

const createKnowledgeBase = async () => {
  if (!createFormState.value.system_locale_id) {
    showNotification(__('Please select a primary language.'), true)
    return
  }
  isCreatingKb.value = true
  try {
    const payload = {
      iconset: createFormState.value.iconset,
      color_highlight: createFormState.value.color_highlight,
      color_header: createFormState.value.color_header,
      color_header_link: createFormState.value.color_header_link,
      homepage_layout: 'grid',
      category_layout: 'grid',
      kb_locales_attributes: [
        {
          system_locale_id: createFormState.value.system_locale_id,
          primary: true,
        },
      ],
    }

    const res = await fetch('/api/v1/knowledge_bases/manage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      showNotification(__('Knowledge Base created successfully!'))
      await fetchKnowledgeBase()
    } else {
      const errData = await res.json().catch(() => ({}))
      showNotification(errData.error || errData.error_human || __('Failed to create Knowledge Base.'), true)
    }
  } catch (e) {
    console.error('Failed to create knowledge base:', e)
    showNotification(__('An unexpected error occurred.'), true)
  } finally {
    isCreatingKb.value = false
  }
}

// -------------------------------------------------------------
// Actions: Theme & Branding
// -------------------------------------------------------------

const saveStyle = async () => {
  if (!kb.value) return
  isSaving.value = true
  try {
    const payload = {
      color_highlight: formStyle.value.color_highlight,
      color_header: formStyle.value.color_header,
      color_header_link: formStyle.value.color_header_link,
      iconset: formStyle.value.iconset,
      show_feed_icon: formStyle.value.show_feed_icon,
    }

    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}?full=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      kb.value.color_highlight = formStyle.value.color_highlight
      kb.value.color_header = formStyle.value.color_header
      kb.value.color_header_link = formStyle.value.color_header_link
      kb.value.iconset = formStyle.value.iconset
      kb.value.show_feed_icon = formStyle.value.show_feed_icon
      showNotification(__('Theme settings saved successfully.'))
    } else {
      const err = await res.json().catch(() => ({}))
      showNotification(err.error || __('Failed to save theme settings.'), true)
    }
  } catch (e) {
    console.error('Failed to save style:', e)
    showNotification(__('An error occurred while saving.'), true)
  } finally {
    isSaving.value = false
  }
}

// -------------------------------------------------------------
// Actions: Languages
// -------------------------------------------------------------

const setPrimaryLanguage = async (targetLocale: KbLocaleRecord) => {
  if (!kb.value || targetLocale.primary || isSaving.value) return
  isSaving.value = true
  try {
    const attributes = kbLocales.value.map((loc) => ({
      id: loc.id,
      system_locale_id: loc.system_locale_id,
      primary: loc.id === targetLocale.id,
    }))

    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}?full=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ kb_locales_attributes: attributes }),
    })

    if (res.ok) {
      showNotification(__('Primary language updated.'))
      await fetchKnowledgeBase()
    } else {
      const err = await res.json().catch(() => ({}))
      showNotification(err.error || __('Failed to update primary language.'), true)
    }
  } catch (e) {
    console.error('Failed to update primary language:', e)
    showNotification(__('Network error updating primary language.'), true)
  } finally {
    isSaving.value = false
  }
}

const addLanguage = async () => {
  if (!kb.value || !selectedLocaleToAdd.value) return
  isSaving.value = true
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}?full=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        kb_locales_attributes: [
          {
            system_locale_id: selectedLocaleToAdd.value,
            primary: kbLocales.value.length === 0,
          },
        ],
      }),
    })

    if (res.ok) {
      showAddLanguageDrawer.value = false
      selectedLocaleToAdd.value = null
      showNotification(__('Language added successfully.'))
      await fetchKnowledgeBase()
    } else {
      const d = await res.json().catch(() => ({}))
      showNotification(d.error || __('Failed to add language.'), true)
    }
  } catch (e) {
    console.error('Failed to add language:', e)
    showNotification(__('An error occurred.'), true)
  } finally {
    isSaving.value = false
  }
}

const openDeleteLanguageModal = (loc: KbLocaleRecord) => {
  if (loc.primary) return
  localeToDelete.value = loc
  deleteLanguageConfirmInput.value = ''
  showDeleteLanguageModal.value = true
}

const confirmDeleteLanguage = async () => {
  if (
    deleteLanguageConfirmInput.value.trim().toUpperCase() !== 'DELETE' ||
    !localeToDelete.value ||
    !kb.value
  )
    return
  isDeletingLanguage.value = true
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}?full=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        kb_locales_attributes: [{ id: localeToDelete.value.id, _destroy: '1' }],
      }),
    })

    if (res.ok) {
      showDeleteLanguageModal.value = false
      localeToDelete.value = null
      showNotification(__('Language removed successfully.'))
      await fetchKnowledgeBase()
    } else {
      const d = await res.json().catch(() => ({}))
      showNotification(d.error || __('Failed to remove language.'), true)
    }
  } catch (e) {
    console.error('Failed to delete language:', e)
    showNotification(__('Network error removing language.'), true)
  } finally {
    isDeletingLanguage.value = false
  }
}

// -------------------------------------------------------------
// Actions: Public Menu (Multi-Locale)
// -------------------------------------------------------------

const getLocaleMenuItems = (kbLocaleId: number, location: 'header' | 'footer') => {
  return menuItems.value.filter(
    (m) => m.kb_locale_id === kbLocaleId && m.location === location && !m._destroy,
  )
}

const openPublicMenuDrawer = (location: 'header' | 'footer') => {
  menuDrawerLocation.value = location
  menuDrawerActiveLocaleId.value = primaryKbLocale.value?.id || kbLocales.value[0]?.id || 1

  // Deep clone existing menu items by locale
  const grouped: Record<number, MenuItemRecord[]> = {}
  for (const loc of kbLocales.value) {
    const existing = menuItems.value
      .filter((m) => m.kb_locale_id === loc.id && m.location === location && !m._destroy)
      .map((m) => Object.assign({}, m))
    grouped[loc.id] = existing
  }
  drawerMenuItemsByLocale.value = grouped
  showMenuDrawer.value = true
}

const addDrawerLinkRow = () => {
  const currentLocId = menuDrawerActiveLocaleId.value
  if (!currentLocId) return
  if (!drawerMenuItemsByLocale.value[currentLocId]) {
    drawerMenuItemsByLocale.value[currentLocId] = []
  }
  drawerMenuItemsByLocale.value[currentLocId].push({
    kb_locale_id: currentLocId,
    location: menuDrawerLocation.value,
    title: '',
    url: '',
    new_tab: false,
  })
}

const removeDrawerLinkRow = (idx: number) => {
  const currentLocId = menuDrawerActiveLocaleId.value
  if (!currentLocId) return
  drawerMenuItemsByLocale.value[currentLocId].splice(idx, 1)
}

const moveDrawerLinkRow = (idx: number, direction: 'up' | 'down') => {
  const currentLocId = menuDrawerActiveLocaleId.value
  if (!currentLocId) return
  const list = drawerMenuItemsByLocale.value[currentLocId]
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= list.length) return
  const temp = list[idx]
  list[idx] = list[targetIdx]
  list[targetIdx] = temp
}

const savePublicMenu = async () => {
  if (!kb.value) return

  // Validate that any entered rows have title and url
  for (const loc of kbLocales.value) {
    const items = drawerMenuItemsByLocale.value[loc.id] || []
    for (const item of items) {
      if (!item.title.trim() || !item.url.trim()) {
        showNotification(__('Please fill in all Title and URL fields.'), true)
        return
      }
    }
  }

  isSavingMenu.value = true
  try {
    const menuItemsSets = kbLocales.value.map((loc) => {
      const items = (drawerMenuItemsByLocale.value[loc.id] || []).map((m, idx) => ({
        id: m.id,
        title: m.title.trim(),
        url: m.url.trim(),
        new_tab: Boolean(m.new_tab),
        position: idx,
        _destroy: false,
      }))
      return {
        kb_locale_id: loc.id,
        location: menuDrawerLocation.value,
        menu_items: items,
      }
    })

    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}/update_menu_items`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ menu_items_sets: menuItemsSets }),
    })

    if (res.ok) {
      showMenuDrawer.value = false
      showNotification(__('Public menu updated successfully.'))
      await fetchKnowledgeBase()
    } else {
      const d = await res.json().catch(() => ({}))
      showNotification(d.error || d.error_human || __('Failed to update public menu.'), true)
    }
  } catch (e) {
    console.error('Failed to save public menu:', e)
    showNotification(__('Network error updating menu.'), true)
  } finally {
    isSavingMenu.value = false
  }
}

// -------------------------------------------------------------
// Actions: Video Servers
// -------------------------------------------------------------

const openNewVideoDrawer = () => {
  editingVideoIndex.value = null
  videoForm.value = { name: '', host: '' }
  showVideoDrawer.value = true
}

const openEditVideoDrawer = (server: VideoServer, index: number) => {
  editingVideoIndex.value = index
  videoForm.value = { name: server.name, host: server.host }
  showVideoDrawer.value = true
}

const normalizeHost = (val: string) => {
  return val
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

const syncVideoServers = async (servers: VideoServer[]) => {
  if (!videoServerSettingId.value) return
  isSavingVideoServer.value = true
  try {
    const res = await fetch(`/api/v1/settings/${videoServerSettingId.value}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({ state_current: { value: servers } }),
    })
    if (res.ok) {
      videoServers.value = servers
      showNotification(__('Video servers updated.'))
    } else {
      showNotification(__('Failed to update video servers.'), true)
    }
  } catch (e) {
    console.error('Failed to sync video servers:', e)
  } finally {
    isSavingVideoServer.value = false
  }
}

const saveVideoServer = async () => {
  if (!videoForm.value.name.trim() || !videoForm.value.host.trim()) {
    showNotification(__('Name and Host are required.'), true)
    return
  }

  const cleanHost = normalizeHost(videoForm.value.host)
  const updated = [...videoServers.value]
  if (editingVideoIndex.value !== null) {
    updated[editingVideoIndex.value] = {
      name: videoForm.value.name.trim(),
      host: cleanHost,
    }
  } else {
    updated.push({
      name: videoForm.value.name.trim(),
      host: cleanHost,
    })
  }

  await syncVideoServers(updated)
  showVideoDrawer.value = false
}

const removeVideoServer = async (index: number) => {
  if (!confirm(__('Are you sure? The embedded videos from this server will not be playable anymore.')))
    return
  const updated = [...videoServers.value]
  updated.splice(index, 1)
  await syncVideoServers(updated)
}

// -------------------------------------------------------------
// Actions: Custom URL & Snippets
// -------------------------------------------------------------

const saveCustomAddress = async () => {
  if (!kb.value) return
  isSaving.value = true
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}?full=true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
      body: JSON.stringify({
        custom_address: customAddress.value.trim() || null,
      }),
    })

    if (res.ok) {
      kb.value.custom_address = customAddress.value.trim()
      showNotification(__('Custom URL saved successfully.'))
    } else {
      const err = await res.json().catch(() => ({}))
      showNotification(err.error || __('Failed to save custom address.'), true)
    }
  } catch (e) {
    console.error('Failed to save custom address:', e)
    showNotification(__('Network error.'), true)
  } finally {
    isSaving.value = false
  }
}

const openServerSnippetsModal = async () => {
  if (!kb.value || !customAddress.value.trim()) return
  snippetsLoading.value = true
  showSnippetsModal.value = true
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}/server_snippets`, {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      const data = await res.json()
      serverSnippets.value = data
    } else {
      const err = await res.json().catch(() => ({}))
      showNotification(err.error || __('Could not load server snippets.'), true)
    }
  } catch (e) {
    console.error('Failed to load server snippets:', e)
  } finally {
    snippetsLoading.value = false
  }
}

const copyToClipboard = (text?: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  showNotification(__('Copied to clipboard.'))
}

// -------------------------------------------------------------
// Actions: Danger Zone (Delete KB)
// -------------------------------------------------------------

const isDeleteButtonEnabled = computed(() => {
  const input = deleteKbConfirmInput.value.trim()
  const title = guaranteedTitle.value.trim()
  return (
    (input === title || input.toUpperCase() === 'DELETE') &&
    input.length > 0 &&
    !isDeletingKb.value
  )
})

const deleteKnowledgeBase = async () => {
  if (!isDeleteButtonEnabled.value || !kb.value) return

  isDeletingKb.value = true
  try {
    const res = await fetch(`/api/v1/knowledge_bases/manage/${kb.value.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': getCsrf(),
      },
    })
    if (res.ok) {
      showNotification(__('Knowledge Base deleted successfully.'))
      kb.value = null
      kbLocales.value = []
      menuItems.value = []
      kbTranslations.value = []
      activeTab.value = 'style'
    } else {
      const err = await res.json().catch(() => ({}))
      showNotification(err.error || __('Failed to delete knowledge base.'), true)
    }
  } catch (e) {
    console.error('Failed to delete knowledge base:', e)
    showNotification(__('Network error during deletion.'), true)
  } finally {
    isDeletingKb.value = false
  }
}

onMounted(() => {
  fetchKnowledgeBase()
})
</script>

<template>
  <!-- eslint-disable vuejs-accessibility/label-has-for -->
  <LayoutContent :breadcrumb-items="breadcrumbItems" background-variant="tertiary" width="full">
    <div class="w-full px-8 py-6 text-slate-800 dark:text-slate-100">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center justify-center w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="__('Back to Administration')"
            @click="router.push('/manage')"
          >
            <CommonIcon name="arrow-left" class="w-4 h-4" />
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CommonIcon name="book" class="w-6 h-6 text-blue-500" />
              {{ __('Knowledge Base') }}
              <span class="text-sm font-normal text-slate-500 dark:text-slate-400 ltr:ml-1 rtl:mr-1">{{ __('Management') }}</span>
            </h1>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Public Help Center Link -->
          <a
            v-if="kb"
            href="/help"
            target="_blank"
            class="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <CommonIcon name="globe" class="w-4 h-4 text-blue-500" />
            {{ __('Open Help Center') }}
          </a>

          <!-- Master Switch (Activate / Deactivate) -->
          <div v-if="kb" class="flex items-center gap-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl shadow-sm">
            <div class="text-right">
              <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 block">{{ __('Public Status') }}</span>
              <span class="text-[11px]" :class="kb.active ? 'text-green-600 font-medium' : 'text-slate-400'">
                {{ kb.active ? __('Active') : __('Inactive') }}
              </span>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="kb.active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
              @click="toggleActive"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                :class="kb.active ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div v-if="successMessage" class="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-xs rounded-xl flex items-center gap-2">
        <CommonIcon name="check2" class="w-4 h-4 shrink-0" />
        {{ successMessage }}
      </div>
      <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
        <CommonIcon name="exclamation-triangle" class="w-4 h-4 shrink-0" />
        {{ errorMessage }}
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-24 flex items-center justify-center gap-3">
        <div class="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span class="text-sm text-slate-500">{{ __('Loading knowledge base settings...') }}</span>
      </div>

      <!-- ======================================================= -->
      <!-- ZERO-STATE: CREATE KNOWLEDGE BASE                      -->
      <!-- ======================================================= -->
      <div v-else-if="!kb" class="max-w-xl mx-auto py-12">
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-md">
          <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <CommonIcon name="book" class="w-8 h-8" />
          </div>
          <h2 class="text-xl font-bold text-center text-slate-900 dark:text-slate-100 mb-2">
            {{ __('Create Your Knowledge Base') }}
          </h2>
          <p class="text-xs text-center text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            {{ __('Empower customers with self-service solutions and provide internal documentation for your team. Choose your initial primary language to begin.') }}
          </p>

          <form class="space-y-4" @submit.prevent="createKnowledgeBase">
            <div>
              <label for="create-primary-language" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                {{ __('Primary Language') }} <span class="text-red-500">*</span>
              </label>
              <select
                id="create-primary-language"
                v-model="createFormState.system_locale_id"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option v-for="loc in systemLocales" :key="loc.id" :value="loc.id">
                  {{ loc.name }} ({{ loc.locale }})
                </option>
              </select>
            </div>

            <div>
              <label for="create-iconset" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">
                {{ __('Default Category Icon Set') }}
              </label>
              <select
                id="create-iconset"
                v-model="createFormState.iconset"
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option v-for="opt in ICONSET_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="pt-4">
              <button
                type="submit"
                :disabled="isCreatingKb || !createFormState.system_locale_id"
                class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span v-if="isCreatingKb">{{ __('Creating Knowledge Base...') }}</span>
                <span v-else>{{ __('Initialize Knowledge Base') }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ======================================================= -->
      <!-- MAIN VIEW (WHEN KB INITIALIZED)                         -->
      <!-- ======================================================= -->
      <div v-else>

        <!-- Navigation Tabs -->
        <div class="flex border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="activeTab === 'style' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'style'"
          >
            <CommonIcon name="palette" class="w-4 h-4" />
            {{ __('Theme & Branding') }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="activeTab === 'languages' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'languages'"
          >
            <CommonIcon name="globe" class="w-4 h-4" />
            {{ __('Languages') }}
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {{ kbLocales.length }}
            </span>
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="activeTab === 'menu' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'menu'"
          >
            <CommonIcon name="card-list" class="w-4 h-4" />
            {{ __('Public Menu') }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="activeTab === 'video_servers' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'video_servers'"
          >
            <CommonIcon name="play-circle" class="w-4 h-4" />
            {{ __('Video Servers') }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="activeTab === 'custom_url' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
            @click="activeTab = 'custom_url'"
          >
            <CommonIcon name="link" class="w-4 h-4" />
            {{ __('Custom URL') }}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ltr:ml-auto rtl:mr-auto"
            :class="activeTab === 'danger' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-red-500'"
            @click="activeTab = 'danger'"
          >
            <CommonIcon name="trash3" class="w-4 h-4" />
            {{ __('Delete') }}
          </button>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 1: THEME & BRANDING                                 -->
        <!-- ======================================================= -->
        <div v-if="activeTab === 'style'" class="max-w-3xl space-y-6">

          <!-- Live Theme Preview -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div class="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {{ __('Live Header Preview') }}
            </div>
            <div
              class="p-6 transition-colors flex items-center justify-between"
              :style="{ backgroundColor: formStyle.color_header, color: formStyle.color_header_link }"
            >
              <div class="flex items-center gap-2 font-bold text-lg">
                <CommonIcon name="book" class="w-5 h-5" :style="{ color: formStyle.color_highlight }" />
                <span>{{ guaranteedTitle }}</span>
              </div>
              <div class="flex items-center gap-4 text-xs font-medium">
                <span class="hover:underline cursor-pointer">{{ __('Home') }}</span>
                <span class="hover:underline cursor-pointer">{{ __('Categories') }}</span>
                <span
                  class="px-3 py-1 rounded-full text-white text-xs font-semibold shadow-sm"
                  :style="{ backgroundColor: formStyle.color_highlight }"
                >
                  {{ __('Search') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Color Customization Card -->
          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Colors & Branding') }}</h2>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- Highlight Color -->
              <div>
                <label for="color-highlight-input" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {{ __('Icon & Accent Color') }}
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="formStyle.color_highlight"
                    type="color"
                    aria-label="Accent Color Picker"
                    class="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                  />
                  <input
                    id="color-highlight-input"
                    v-model="formStyle.color_highlight"
                    type="text"
                    class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <!-- Header Background Color -->
              <div>
                <label for="color-header-input" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {{ __('Header Background') }}
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="formStyle.color_header"
                    type="color"
                    aria-label="Header Background Color Picker"
                    class="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                  />
                  <input
                    id="color-header-input"
                    v-model="formStyle.color_header"
                    type="text"
                    class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <!-- Header Link Color -->
              <div>
                <label for="color-header-link-input" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {{ __('Header Text / Links') }}
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="formStyle.color_header_link"
                    type="color"
                    aria-label="Header Link Color Picker"
                    class="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                  />
                  <input
                    id="color-header-link-input"
                    v-model="formStyle.color_header_link"
                    type="text"
                    class="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Icon Set & Feed Option -->
          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Icon Set & Feeds') }}</h2>

            <div>
              <label for="theme-iconset-select" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                {{ __('Category Icon Set') }}
              </label>
              <select
                id="theme-iconset-select"
                v-model="formStyle.iconset"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option v-for="opt in ICONSET_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {{ __("Every category in your knowledge base should be given a unique icon for maximum visual clarity. Each set provides a wide range of icons, but you can't mix and match different sets. Choose carefully!") }}
              </p>
            </div>

            <div class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ __('Show RSS / Atom Feed Icon') }}</h3>
                <p class="text-xs text-slate-500 mt-0.5">{{ __('Display an RSS feed icon for readers to subscribe to published articles.') }}</p>
              </div>
              <button
                type="button"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                :class="formStyle.show_feed_icon ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'"
                @click="formStyle.show_feed_icon = !formStyle.show_feed_icon"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200"
                  :class="formStyle.show_feed_icon ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'ltr:translate-x-0 rtl:translate-x-0'"
                ></span>
              </button>
            </div>
          </div>

          <!-- Save Button -->
          <div class="flex justify-end pt-2">
            <button
              type="button"
              :disabled="isSaving"
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
              @click="saveStyle"
            >
              <span v-if="isSaving">{{ __('Saving...') }}</span>
              <span v-else>{{ __('Save Theme Settings') }}</span>
            </button>
          </div>

        </div>

        <!-- ======================================================= -->
        <!-- TAB 2: LANGUAGES                                        -->
        <!-- ======================================================= -->
        <div v-else-if="activeTab === 'languages'" class="space-y-6 max-w-3xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Available Languages') }}</h2>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ __('You can provide different versions of your knowledge base for different locales. Add a language below, then select it in the Knowledge Base Editor to add your translations.') }}
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-colors"
              @click="showAddLanguageDrawer = true"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              {{ __('Add Language') }}
            </button>
          </div>

          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th class="py-3 px-6">{{ __('Language') }}</th>
                  <th class="py-3 px-6 text-center w-32">{{ __('Primary') }}</th>
                  <th class="py-3 px-6 text-right w-20"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                <tr v-for="locale in kbLocales" :key="locale.id" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td class="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                    {{ getLocaleName(locale.system_locale_id) }}
                  </td>
                  <td class="py-3.5 px-6 text-center">
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="primary_locale_radio"
                        :checked="locale.primary"
                        :disabled="locale.primary || isSaving"
                        class="text-blue-600 focus:ring-0 cursor-pointer"
                        @change="setPrimaryLanguage(locale)"
                      />
                      <span v-if="locale.primary" class="font-semibold text-blue-600 dark:text-blue-400">
                        {{ __('Primary') }}
                      </span>
                    </label>
                  </td>
                  <td class="py-3.5 px-6 text-right">
                    <button
                      v-if="!locale.primary"
                      type="button"
                      class="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      :title="__('Remove Language')"
                      @click="openDeleteLanguageModal(locale)"
                    >
                      <CommonIcon name="trash3" class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 3: PUBLIC MENU (MULTI-LOCALE)                       -->
        <!-- ======================================================= -->
        <div v-else-if="activeTab === 'menu'" class="space-y-6 max-w-3xl">
          <p class="text-xs text-slate-500 leading-relaxed">
            {{ __('Here you can add further links to your public FAQ page, which will be displayed either in the header or footer.') }}
          </p>

          <!-- Header Menu Card -->
          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Header Menu') }}</h3>
                <p class="text-xs text-slate-500">{{ __('Navigation links shown in the top header of the public help center.') }}</p>
              </div>
              <button
                type="button"
                class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                @click="openPublicMenuDrawer('header')"
              >
                {{ __('Edit Header Menu') }}
              </button>
            </div>

            <!-- Previews per locale -->
            <div class="space-y-3 pt-2">
              <div
                v-for="loc in kbLocales"
                :key="loc.id"
                class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
              >
                <div class="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>{{ getLocaleName(loc.system_locale_id) }}</span>
                  <span v-if="loc.primary" class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{{ __('Primary') }}</span>
                </div>
                <div
                  class="p-4 flex items-center gap-4 text-xs font-medium overflow-x-auto"
                  :style="{ backgroundColor: kb.color_header, color: kb.color_header_link }"
                >
                  <template v-if="getLocaleMenuItems(loc.id, 'header').length > 0">
                    <span
                      v-for="item in getLocaleMenuItems(loc.id, 'header')"
                      :key="item.id || item.title"
                      class="hover:underline flex items-center gap-1 cursor-default"
                    >
                      {{ item.title }}
                      <CommonIcon v-if="item.new_tab" name="box-arrow-up-right" class="w-2.5 h-2.5 opacity-70" />
                    </span>
                  </template>
                  <span v-else class="text-slate-400 italic text-[11px]">{{ __('(Empty)') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Menu Card -->
          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Footer Menu') }}</h3>
                <p class="text-xs text-slate-500">{{ __('Links displayed at the bottom of the help center (e.g. Terms of Service, Privacy).') }}</p>
              </div>
              <button
                type="button"
                class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                @click="openPublicMenuDrawer('footer')"
              >
                {{ __('Edit Footer Menu') }}
              </button>
            </div>

            <!-- Previews per locale -->
            <div class="space-y-3 pt-2">
              <div
                v-for="loc in kbLocales"
                :key="loc.id"
                class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
              >
                <div class="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>{{ getLocaleName(loc.system_locale_id) }}</span>
                  <span v-if="loc.primary" class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">{{ __('Primary') }}</span>
                </div>
                <div class="p-4 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 flex items-center gap-4 text-xs font-medium overflow-x-auto">
                  <template v-if="getLocaleMenuItems(loc.id, 'footer').length > 0">
                    <span
                      v-for="item in getLocaleMenuItems(loc.id, 'footer')"
                      :key="item.id || item.title"
                      class="hover:underline flex items-center gap-1 cursor-default"
                    >
                      {{ item.title }}
                      <CommonIcon v-if="item.new_tab" name="box-arrow-up-right" class="w-2.5 h-2.5 opacity-70" />
                    </span>
                  </template>
                  <span v-else class="text-slate-400 italic text-[11px]">{{ __('(Empty)') }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ======================================================= -->
        <!-- TAB 4: VIDEO SERVERS                                    -->
        <!-- ======================================================= -->
        <div v-else-if="activeTab === 'video_servers'" class="space-y-6 max-w-3xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Video Servers') }}</h2>
              <p class="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                {{ __('Add your video server address here so it can be included in the Content Security Policy exceptions. Currently supported solutions are MediaCMS and PeerTube.') }}
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-colors"
              @click="openNewVideoDrawer"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              {{ __('New Video Server') }}
            </button>
          </div>

          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th class="py-3 px-6 w-1/3">{{ __('Name') }}</th>
                  <th class="py-3 px-6">{{ __('Host') }}</th>
                  <th class="py-3 px-6 text-right w-24"></th>
                </tr>
              </thead>
              <tbody v-if="videoServers.length === 0">
                <tr>
                  <td colspan="3" class="py-10 text-center text-slate-400 text-xs">
                    {{ __('No self-hosted video servers configured yet.') }}
                  </td>
                </tr>
              </tbody>
              <tbody v-else class="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
                <tr v-for="(server, sIdx) in videoServers" :key="sIdx" class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td class="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">{{ server.name }}</td>
                  <td class="py-3.5 px-6 font-mono text-slate-500">{{ server.host }}</td>
                  <td class="py-3.5 px-6 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        :title="__('Edit')"
                        @click="openEditVideoDrawer(server, sIdx)"
                      >
                        <CommonIcon name="pencil" class="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        :title="__('Delete')"
                        @click="removeVideoServer(sIdx)"
                      >
                        <CommonIcon name="trash3" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 5: CUSTOM URL                                       -->
        <!-- ======================================================= -->
        <div v-else-if="activeTab === 'custom_url'" class="space-y-6 max-w-3xl">
          <div class="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Custom URL') }}</h2>
            <p class="text-xs text-slate-500 leading-relaxed">
              {{ __('The default URL for your knowledge base is e.g. example.com or example.com/help. To serve it from a custom URL instead, enter the destination below (e.g., "/support", "example.com", or "example.com/support"). Then, follow the directions under "Web Server Configuration" to complete the process.') }}
            </p>

            <div class="space-y-3">
              <label for="custom-address-input" class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                {{ __('Custom Address') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="custom-address-input"
                  v-model="customAddress"
                  type="text"
                  :placeholder="__('e.g. /support or help.example.com')"
                  class="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  :disabled="isSaving"
                  class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                  @click="saveCustomAddress"
                >
                  {{ isSaving ? __('Saving...') : __('Save URL') }}
                </button>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-xs text-slate-500">
                {{ __('Generate reverse proxy configuration files for Nginx or Apache.') }}
              </span>
              <button
                type="button"
                :disabled="!customAddress"
                class="px-4 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                @click="openServerSnippetsModal"
              >
                {{ __('Web Server Configuration') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ======================================================= -->
        <!-- TAB 6: DANGER ZONE                                      -->
        <!-- ======================================================= -->
        <div v-else-if="activeTab === 'danger'" class="space-y-6 max-w-3xl">
          <div class="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 class="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <CommonIcon name="exclamation-triangle" class="w-5 h-5 text-red-600" />
              {{ __('Permanently Delete Knowledge Base') }}
            </h2>
            <p class="text-xs text-red-600/90 leading-relaxed">
              {{ __('Deleting your knowledge base requires an additional verification step. To proceed, enter its name below ("') }}{{ guaranteedTitle }}{{ __('"). THIS ACTION CANNOT BE UNDONE.') }}
            </p>

            <div class="space-y-2 pt-2">
              <label for="delete-kb-input" class="block text-xs font-semibold text-red-700 dark:text-red-400">
                {{ __('Type the name or "DELETE" to confirm:') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="delete-kb-input"
                  v-model="deleteKbConfirmInput"
                  type="text"
                  :placeholder="guaranteedTitle"
                  class="w-64 px-3.5 py-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-xl text-sm font-mono text-red-700 dark:text-red-300 focus:outline-none"
                />
                <button
                  type="button"
                  :disabled="!isDeleteButtonEnabled"
                  class="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  @click="deleteKnowledgeBase"
                >
                  <span v-if="isDeletingKb">{{ __('Deleting...') }}</span>
                  <span v-else>{{ __('Delete Knowledge Base') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  </LayoutContent>

  <!-- ======================================================= -->
  <!-- MODAL: ADD LANGUAGE                                     -->
  <!-- ======================================================= -->
  <Teleport to="body">
    <div
      v-if="showAddLanguageDrawer"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close dialog')"
        @click="showAddLanguageDrawer = false"
      ></button>

      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 z-10">
        <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Add Knowledge Base Language') }}</h3>
        <div>
          <label for="add-language-select" class="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">{{ __('Select Language') }}</label>
          <select
            id="add-language-select"
            v-model="selectedLocaleToAdd"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option :value="null">{{ __('Choose a language...') }}</option>
            <option
              v-for="loc in systemLocales"
              :key="loc.id"
              :value="loc.id"
              :disabled="kbLocales.some((l) => l.system_locale_id === loc.id)"
            >
              {{ loc.name }} ({{ loc.locale }})
            </option>
          </select>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            @click="showAddLanguageDrawer = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            :disabled="!selectedLocaleToAdd || isSaving"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
            @click="addLanguage"
          >
            {{ __('Add Language') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ======================================================= -->
  <!-- MODAL: DELETE LANGUAGE CONFIRMATION                     -->
  <!-- ======================================================= -->
  <Teleport to="body">
    <div
      v-if="showDeleteLanguageModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close dialog')"
        @click="showDeleteLanguageModal = false"
      ></button>

      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/60 p-6 space-y-4 z-10">
        <h3 class="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <CommonIcon name="exclamation-triangle" class="w-5 h-5 text-red-600" />
          {{ __('Remove Language') }}
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {{ __('Removing this language will permanently delete all article and category translations related to it.') }}
        </p>
        <div>
          <label for="delete-lang-confirm-input" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {{ __('Enter "DELETE" to confirm:') }}
          </label>
          <input
            id="delete-lang-confirm-input"
            v-model="deleteLanguageConfirmInput"
            type="text"
            placeholder="DELETE"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-red-300 dark:border-red-700 rounded-lg text-sm font-mono text-red-600 focus:outline-none"
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            @click="showDeleteLanguageModal = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            :disabled="deleteLanguageConfirmInput.trim().toUpperCase() !== 'DELETE' || isDeletingLanguage"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            @click="confirmDeleteLanguage"
          >
            {{ isDeletingLanguage ? __('Removing...') : __('Remove Language') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ======================================================= -->
  <!-- DRAWER: PUBLIC MENU MULTI-LOCALE EDITOR                 -->
  <!-- ======================================================= -->
  <Teleport to="body">
    <div
      v-if="showMenuDrawer"
      class="fixed inset-0 z-50 flex justify-end"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close drawer')"
        @click="showMenuDrawer = false"
      ></button>

      <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10">
        <!-- Header -->
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="card-list" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              {{ menuDrawerLocation === 'header' ? __('Edit Header Menu') : __('Edit Footer Menu') }}
            </h2>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            :title="__('Close')"
            @click="showMenuDrawer = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <!-- Language Switcher Tabs in Drawer -->
        <div class="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          <button
            v-for="loc in kbLocales"
            :key="loc.id"
            type="button"
            class="px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap"
            :class="menuDrawerActiveLocaleId === loc.id ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="menuDrawerActiveLocaleId = loc.id"
          >
            {{ getLocaleName(loc.system_locale_id) }}
            <span v-if="loc.primary" class="ltr:ml-1 rtl:mr-1 text-[10px] text-blue-500 font-normal">({{ __('Primary') }})</span>
          </button>
        </div>

        <!-- Body: Link items for active locale -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {{ __('Menu Links') }}
            </span>
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              @click="addDrawerLinkRow"
            >
              <CommonIcon name="plus" class="w-3.5 h-3.5" />
              {{ __('Add Link') }}
            </button>
          </div>

          <div
            v-if="!menuDrawerActiveLocaleId || !(drawerMenuItemsByLocale[menuDrawerActiveLocaleId]?.length)"
            class="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {{ __('No links configured for this language. Click "+ Add Link" to create one.') }}
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="(row, rIdx) in drawerMenuItemsByLocale[menuDrawerActiveLocaleId]"
              :key="rIdx"
              class="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5"
            >
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold text-slate-400">#{{ rIdx + 1 }}</span>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    :disabled="rIdx === 0"
                    class="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                    :title="__('Move Up')"
                    @click="moveDrawerLinkRow(rIdx, 'up')"
                  >
                    <CommonIcon name="arrow-up" class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    :disabled="rIdx === drawerMenuItemsByLocale[menuDrawerActiveLocaleId].length - 1"
                    class="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                    :title="__('Move Down')"
                    @click="moveDrawerLinkRow(rIdx, 'down')"
                  >
                    <CommonIcon name="arrow-down" class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    :title="__('Remove')"
                    @click="removeDrawerLinkRow(rIdx)"
                  >
                    <CommonIcon name="trash3" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label :for="`menu-title-${rIdx}`" class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{{ __('Title') }} *</label>
                  <input
                    :id="`menu-title-${rIdx}`"
                    v-model="row.title"
                    type="text"
                    :placeholder="__('e.g. Website, FAQ')"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label :for="`menu-url-${rIdx}`" class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">{{ __('URL') }} *</label>
                  <input
                    :id="`menu-url-${rIdx}`"
                    v-model="row.url"
                    type="text"
                    :placeholder="__('https://example.com or /contact')"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2 pt-1">
                <input
                  :id="`menu-newtab-${rIdx}`"
                  v-model="row.new_tab"
                  type="checkbox"
                  class="rounded text-blue-600 focus:ring-0"
                />
                <label :for="`menu-newtab-${rIdx}`" class="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  {{ __('Open in a new tab') }}
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            @click="showMenuDrawer = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            :disabled="isSavingMenu"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
            @click="savePublicMenu"
          >
            <span v-if="isSavingMenu">{{ __('Saving Menu...') }}</span>
            <span v-else>{{ __('Save Changes') }}</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>

  <!-- ======================================================= -->
  <!-- DRAWER: ADD / EDIT VIDEO SERVER                         -->
  <!-- ======================================================= -->
  <Teleport to="body">
    <div
      v-if="showVideoDrawer"
      class="fixed inset-0 z-50 flex justify-end"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close drawer')"
        @click="showVideoDrawer = false"
      ></button>

      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10">
        <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <CommonIcon name="play-circle" class="w-5 h-5" />
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              {{ editingVideoIndex !== null ? __('Edit Video Server') : __('New Video Server') }}
            </h2>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            :title="__('Close')"
            @click="showVideoDrawer = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label for="video-server-name" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Name') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="video-server-name"
              v-model="videoForm.name"
              type="text"
              maxlength="100"
              :placeholder="__('e.g. MediaCMS, PeerTube')"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label for="video-server-host" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              {{ __('Host') }} <span class="text-red-500">*</span>
            </label>
            <input
              id="video-server-host"
              v-model="videoForm.host"
              type="text"
              maxlength="200"
              placeholder="video.example.com"
              class="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <p class="text-[11px] text-slate-400 mt-1">
              {{ __('Enter the domain name without protocols (e.g. video.example.com).') }}
            </p>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
            @click="showVideoDrawer = false"
          >
            {{ __('Cancel') }}
          </button>
          <button
            type="button"
            :disabled="isSavingVideoServer"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            @click="saveVideoServer"
          >
            <span v-if="isSavingVideoServer">{{ __('Saving...') }}</span>
            <span v-else>{{ editingVideoIndex !== null ? __('Save Changes') : __('Add Video Server') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- ======================================================= -->
  <!-- MODAL: SERVER CONFIGURATION SNIPPETS                    -->
  <!-- ======================================================= -->
  <Teleport to="body">
    <div
      v-if="showSnippetsModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm w-full h-full cursor-default"
        :aria-label="__('Close dialog')"
        @click="showSnippetsModal = false"
      ></button>

      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 z-10">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">{{ __('Web Server Configuration') }}</h3>
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            :title="__('Close')"
            @click="showSnippetsModal = false"
          >
            <CommonIcon name="x-lg" class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-500 leading-relaxed">
          {{ __('Configuration for') }} {{ serverSnippets?.address_type || 'address' }}: <strong class="font-mono text-slate-800 dark:text-slate-200">{{ customAddress }}</strong>
        </p>

        <!-- Nginx / Apache Tabs -->
        <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer"
            :class="activeSnippetTab === 'nginx' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-600'"
            @click="activeSnippetTab = 'nginx'"
          >
            Nginx
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer"
            :class="activeSnippetTab === 'apache' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-600'"
            @click="activeSnippetTab = 'apache'"
          >
            Apache
          </button>
        </div>

        <div class="relative">
          <div v-if="snippetsLoading" class="py-12 text-center text-xs text-slate-400">
            {{ __('Generating configuration snippet...') }}
          </div>
          <div v-else class="relative">
            <button
              type="button"
              class="absolute top-3 ltr:right-3 rtl:left-3 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
              @click="copyToClipboard(activeSnippetTab === 'nginx' ? serverSnippets?.snippets?.nginx : serverSnippets?.snippets?.apache)"
            >
              <CommonIcon name="copy" class="w-3 h-3" />
              {{ __('Copy') }}
            </button>
            <pre class="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-72">{{ activeSnippetTab === 'nginx' ? (serverSnippets?.snippets?.nginx || __('No snippet available.')) : (serverSnippets?.snippets?.apache || __('No snippet available.')) }}</pre>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
            @click="showSnippetsModal = false"
          >
            {{ __('Close') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
