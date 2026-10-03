<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { getNodeByName } from '#shared/components/Form/utils.ts'
import { useObjectAttributesStore } from '#shared/entities/object-attributes/stores/objectAttributes.ts'
import { EnumObjectManagerObjects } from '#shared/graphql/types.ts'

export type CategoryKey =
  | 'service_request'
  | 'software'
  | 'hardware'
  | 'it'
  | 'account'
  | 'general'
  | string
  | ''

export interface WizardData {
  categoryKey: CategoryKey
  category: string
  subCategory: string
  campus: string
  title: string
  body: string
  attachments: File[]
}

interface Props {
  formId?: string
  isSubmitting?: boolean
  createdTicketInfo?: { id: number; number: string } | null
  initialValues?: Partial<WizardData>
}

const props = withDefaults(defineProps<Props>(), {
  formId: undefined,
  isSubmitting: false,
  createdTicketInfo: null,
  initialValues: () => ({}),
})

const emit = defineEmits<{
  submit: [data: WizardData]
  'switch-to-full': []
  cancel: []
  'view-ticket': [id: number]
  'back-to-dashboard': []
}>()

const normalizeCategory = (
  key?: string,
  rawCat?: string,
): { key: CategoryKey; categoryValue: string } => {
  const k = (key || '').toLowerCase().trim()
  const c = rawCat || ''

  if (k === 'it' || k === 'software' || c.toLowerCase() === 'software') {
    return { key: 'software', categoryValue: 'Software' }
  }
  if (k === 'account' || k === 'service_request' || c.toLowerCase() === 'service request') {
    return { key: 'service_request', categoryValue: 'Service Request' }
  }
  if (k === 'general') {
    return { key: 'service_request', categoryValue: 'Service Request' }
  }
  if (k === 'hardware' || c.toLowerCase() === 'hardware') {
    return { key: 'hardware', categoryValue: 'Hardware' }
  }

  return { key: (key || '') as CategoryKey, categoryValue: c || key || '' }
}

const initialNorm = normalizeCategory(
  props.initialValues?.categoryKey,
  props.initialValues?.category,
)

// Step state: 1 = Category, 2 = Sub-category, 3 = Campus, 4 = Details
const currentStep = ref<number>(initialNorm.key ? 2 : 1)
const transitionDirection = ref<'forward' | 'backward'>('forward')
const showCancelConfirm = ref(false)
const stepHeadingRef = ref<HTMLHeadingElement | null>(null)

const wizardData = ref<WizardData>({
  categoryKey: initialNorm.key,
  category: initialNorm.categoryValue,
  subCategory: props.initialValues?.subCategory || '',
  campus: props.initialValues?.campus || '',
  title: props.initialValues?.title || '',
  body: props.initialValues?.body || '',
  attachments: props.initialValues?.attachments || [],
})

watch(
  () => props.initialValues,
  (newVals) => {
    // Prevent resetting step back to 2 during ticket submission or if user has already progressed
    if (props.isSubmitting || currentStep.value > 1) return

    if (newVals?.categoryKey || newVals?.category) {
      const norm = normalizeCategory(newVals.categoryKey, newVals.category)
      wizardData.value.categoryKey = norm.key
      wizardData.value.category = norm.categoryValue
      currentStep.value = 2

      if (props.formId && norm.categoryValue) {
        const catNode =
          getNodeByName(props.formId, 'category2') ||
          getNodeByName(props.formId, 'category')
        catNode?.input(norm.categoryValue)
      }
    }
  },
  { deep: true },
)

// Validation state for step 4
const titleTouched = ref(false)
const bodyTouched = ref(false)

const titleError = computed(() => {
  if (!titleTouched.value) return ''
  if (!wizardData.value.title.trim()) {
    return __('Please enter a subject for your request.')
  }
  if (wizardData.value.title.trim().length < 5) {
    return __('Subject should be at least 5 characters long.')
  }
  return ''
})

const bodyError = computed(() => {
  if (!bodyTouched.value) return ''
  if (!wizardData.value.body.trim()) {
    return __('Please describe what you need assistance with.')
  }
  if (wizardData.value.body.trim().length < 10) {
    return __('Description should provide at least 10 characters of detail.')
  }
  return ''
})

const isDetailsValid = computed(() => {
  return (
    wizardData.value.title.trim().length >= 5 &&
    wizardData.value.body.trim().length >= 10
  )
})

// ─── LOAD OBJECTMANAGER DATA ────────────────────────────────────────────────
// Same store/query used by the agent-side ticket form.
// Admin changes in Admin → Objects → Ticket are reflected here immediately.
const objectAttributesStore = useObjectAttributesStore()
objectAttributesStore.loadObjectAttributesForObject(EnumObjectManagerObjects.Ticket)

function normalizeRawOptions(raw: unknown): Array<{ name: string; value: string }> {
  if (!raw) return []
  if (Array.isArray(raw)) {
    const list: Array<{ name: string; value: string }> = []
    const traverse = (items: Array<Record<string, unknown>>) => {
      for (const item of items) {
        if (!item) continue
        const val = item.value ?? item.name ?? item.label
        const lbl = item.name ?? item.label ?? item.value
        if (val !== undefined && val !== null && String(val) !== '') {
          list.push({ name: String(lbl), value: String(val) })
        }
        if (Array.isArray(item.children)) {
          traverse(item.children as Array<Record<string, unknown>>)
        }
      }
    }
    traverse(raw as Array<Record<string, unknown>>)
    return list
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, string>).map(([key, val]) => ({
      name: String(val || key),
      value: String(key),
    }))
  }
  return []
}

/** Read normalised options for a given ObjectManager field. */
function getFieldOptions(
  fieldName: string,
): Array<{ name: string; value: string }> {
  const store = objectAttributesStore.getObjectAttributesForObject(
    EnumObjectManagerObjects.Ticket,
  )
  if (!store) return []
  const lookup = ('value' in store.attributesLookup ? store.attributesLookup.value : store.attributesLookup) as
    | Map<string, { dataOption?: { options?: unknown } }>
    | undefined
  const attr = lookup?.get(fieldName)
  if (!attr?.dataOption?.options) return []
  return normalizeRawOptions(attr.dataOption.options)
}

// ─── ICON / DESC HINT MAPS (cosmetic only) ───────────────────────────────────
// Known options get nice icons & descriptions.
// Admin-added unknown options fall back to safe defaults automatically.

const categoryIconMap: Record<
  string,
  { icon: string; badge: string; desc: string; key: CategoryKey }
> = {
  'Service Request': { icon: 'shield-user', badge: __('Accounts & Access'),    desc: __('Account help, password resets, onboarding, ID cards, drive & access permissions'), key: 'service_request' },
  Software:          { icon: 'laptop',      badge: __('Apps & Systems'),        desc: __('MS Office, Outlook, LSST Portal, SPSS, Windows, Wi-Fi, VPN & app licenses'),         key: 'software' },
  Hardware:          { icon: 'devices',     badge: __('Equipment & Devices'),   desc: __('Desktop PCs, laptops, monitors, printers, scanners, attendance & AV setup'),         key: 'hardware' },
}

const subCategoryHintMap: Record<string, { icon: string; label?: string; desc?: string }> = {
  'Password Reset':             { icon: 'key',        label: __('Password Reset'),          desc: __('Student portal, university email & VLE password reset') },
  'Account Lockout':            { icon: 'lock',       label: __('Account Lockout'),          desc: __('Unlock university account after failed attempts') },
  'MFA Reset':                  { icon: 'shield-lock',label: __('MFA & Two-Factor Reset'),   desc: __('Authenticator app, phone change & MFA help') },
  'Email Account Activation':   { icon: 'mail',       label: __('Email Activation'),          desc: __('New student/staff email setup & verification') },
  'Email Account Deactivation': { icon: 'mail',       label: __('Email Deactivation'),        desc: __('Account closure & leaver deactivation') },
  'Shared Mailbox Access':      { icon: 'mail',       desc: __('Departmental, course or student society mailbox access') },
  'File Share/ Drive Access':   { icon: 'cloud',      label: __('OneDrive / File Share'),     desc: __('OneDrive, SharePoint & shared network storage access') },
  'New ID Card':                { icon: 'id-card',    label: __('Student ID Card'),           desc: __('New ID card issue, lost, stolen or damaged replacement') },
  'Net2 Door Access/Removal':   { icon: 'key',        label: __('Door & Turnstile Access'),   desc: __('Building access, electronic doors & swipe access') },
  'Onboarding (New Starter)':   { icon: 'user',       label: __('New Starter Onboarding'),    desc: __('Enrollment assistance, induction & starter IT setup') },
  'Offboarding (Leaver)':       { icon: 'user',       label: __('Leaver Offboarding'),        desc: __('Account termination & university asset return') },
  'Group Membership Change':    { icon: 'users',      label: __('Group Membership'),          desc: __('Distribution lists, cohort & security groups') },
  'Role Change Access':         { icon: 'id-card',    label: __('Role & Course Changes'),     desc: __('Module switch, role upgrade or student status changes') },
  'Desktop PC Request':         { icon: 'devices',    label: __('Desktop PC Requisition'),    desc: __('New office or campus workstation request') },
  'Laptop Request':             { icon: 'laptop',     label: __('Laptop Requisition'),        desc: __('University laptop loan or staff requisition') },
  'SMS Access':                 { icon: 'mail',       label: __('SMS Portal Access'),         desc: __('Student notification & SMS access permission') },
  'MS Office Suite':            { icon: 'devices',    desc: __('Word, Excel, PowerPoint & Teams installation or activation') },
  Outlook:                      { icon: 'mail',       label: __('Outlook Email & Calendar'),  desc: __('Email sync, Outlook client setup & calendar issues') },
  'LSST Portal':                { icon: 'cloud',      label: __('LSST Student Portal'),       desc: __('Portal login, attendance tracking, grades & timetable') },
  'IBM SPSS':                   { icon: 'key',        label: __('IBM SPSS Statistics'),       desc: __('SPSS software licensing, installation & access codes') },
  'Windows OS':                 { icon: 'devices',    desc: __('Windows operating system updates, errors & performance') },
  'Web Browsers':               { icon: 'wifi',       desc: __('Chrome, Edge, Firefox, security certificates & clearing cache') },
  'Antivirus/ Endpoint Sec':    { icon: 'shield-lock',label: __('Antivirus & Security'),      desc: __('Endpoint security, threat alerts, Sophos & Defender') },
  'Printing Software':          { icon: 'devices',    label: __('Printing Software & PaperCut'), desc: __('PaperCut student printing, credit balance & print queues') },
  'Education Software':         { icon: 'cloud',      label: __('Education Software & VLE'),  desc: __('Moodle, Turnitin, virtual learning tools & library resources') },
  'Software Installation':      { icon: 'devices',    desc: __('New application setup, installers & admin permission') },
  'Software Licensing':         { icon: 'key',        desc: __('Software product keys, renewals & seat allocations') },
  'Application Access Request': { icon: 'lock',       desc: __('System permissions & departmental applications') },
  'Application License':        { icon: 'key',        desc: __('Specialized software license assignment') },
  'VPN Access':                 { icon: 'shield-lock',desc: __('Cisco AnyConnect & secure off-campus university connection') },
  'Wi-Fi Access':               { icon: 'wifi',       desc: __('Eduroam & campus student/staff wireless network') },
  'Remote Desktop Access':      { icon: 'devices',    desc: __('RDP access to campus lab computers or remote servers') },
  'Desktop PC':                 { icon: 'devices',    desc: __('Computer power, boot failure, blue screen & workstation faults') },
  Laptop:                       { icon: 'laptop',     label: __('Laptop Hardware'),           desc: __('Laptop screen, keyboard, battery & charger faults') },
  Monitor:                      { icon: 'devices',    label: __('Monitor & Displays'),        desc: __('External screen, HDMI/DisplayPort cable & display resolution') },
  Printer:                      { icon: 'devices',    label: __('Printer Hardware'),          desc: __('Paper jams, hardware errors, offline printers & hardware faults') },
  Scanner:                      { icon: 'devices',    desc: __('Document scanner connection, driver & feeder faults') },
  'Attendance Device':          { icon: 'id-card',    desc: __('Student biometric attendance scanner & RFID touch terminals') },
  Projector:                    { icon: 'devices',    label: __('Classroom Projector & AV'),  desc: __('Classroom projector, audio setup & screen casting') },
  Peripherals:                  { icon: 'devices',    label: __('Peripherals & Accessories'), desc: __('Keyboard, mouse, webcam, headset, adapters & docking stations') },
  IPad:                         { icon: 'devices',    label: __('iPad & Tablets'),            desc: __('Campus tablets, touchscreens & charging carts') },
  'Camera/CCTV':                { icon: 'devices',    label: __('Camera / CCTV'),             desc: __('Campus security cameras & recording equipment') },
  'Access Point':               { icon: 'wifi',       label: __('Wireless Access Point'),     desc: __('Campus Wi-Fi AP physical hardware & signal dropouts') },
  'Network Switches':           { icon: 'devices',    label: __('Network Switches & Ports'),  desc: __('Ethernet wall jacks, patch panels & network switches') },
  'Cable Management':           { icon: 'devices',    desc: __('Desk cabling, power leads, extension blocks & trunking') },
  'BT Work Phone':              { icon: 'phone',      desc: __('Desk phone handset, dial tone & telephony hardware') },
  'BT Work/Soft Phone Setup':   { icon: 'phone',      label: __('Phone & Audio Setup'),       desc: __('Softphone headset & phone configuration') },
  'Toner Replacement':          { icon: 'devices',    desc: __('Printer toner replacement & waste collection boxes') },
  Others:                       { icon: 'chat',       label: __('Other') },
}

const campusHintMap: Record<string, { institution: string; location: string; desc: string }> = {
  'LSST Wembley':          { institution: 'LSST', location: __('London (Wembley, HA9)'),              desc: __('Wembley Central Campus & Study Centre') },
  'LSST Elephant & Castle':{ institution: 'LSST', location: __('London (Elephant & Castle, SE1)'),    desc: __('South London Campus & Academic Hub') },
  'LSST Stratford':        { institution: 'LSST', location: __('London (Stratford, E15)'),            desc: __('East London Stratford Campus') },
  'LSST Aston':            { institution: 'LSST', location: __('Birmingham (Aston, B6)'),             desc: __('Birmingham Aston Campus & IT Labs') },
  'LSST Luton':            { institution: 'LSST', location: __('Bedfordshire (Luton, LU1)'),          desc: __('Luton Town Centre Campus') },
  'LSST MEMO House':       { institution: 'LSST', location: __('London (Park Royal, NW10)'),          desc: __('MEMO House London Support Centre') },
  'FSB Sheffield':         { institution: 'FSB',  location: __('South Yorkshire (Sheffield, S1)'),    desc: __('Sheffield Campus & Student Hub') },
  'FSB Leicester':         { institution: 'FSB',  location: __('East Midlands (Leicester, LE1)'),     desc: __('Leicester City Campus') },
  'FSB Croydon':           { institution: 'FSB',  location: __('Greater London (Croydon, CR0)'),      desc: __('Croydon London Study Centre') },
  'FSB Digbeth':           { institution: 'FSB',  location: __('Birmingham (Digbeth, B5)'),           desc: __('Digbeth Campus & Creative Quarter') },
  'FSB MEMO House':        { institution: 'FSB',  location: __('London (Park Royal, NW10)'),          desc: __('MEMO House London Centre') },
  'UKBC Leicester':        { institution: 'UKBC', location: __('Leicester (City Centre, LE1)'),       desc: __('UKBC College Campus') },
}

// ─── DERIVED COMPUTED DATA ───────────────────────────────────────────────────

interface WizardMetadataResponse {
  categories?: Array<{ name: string; value: string }>
  all_subcategories?: Array<{ name: string; value: string }>
  subcategories_by_category?: Record<string, Array<{ name: string; value: string }>>
  campuses?: Array<{ name: string; value: string }>
}

const serverMetadata = ref<WizardMetadataResponse | null>(null)

onMounted(async () => {
  // Sync category to underlying form node if already set
  if (props.formId && wizardData.value.category) {
    const catNode =
      getNodeByName(props.formId, 'category2') ||
      getNodeByName(props.formId, 'category')
    catNode?.input(wizardData.value.category)
  }

  try {
    const res = await fetch('/api/v1/ticket_wizard_metadata', {
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (res.ok) {
      serverMetadata.value = await res.json()
      // If we have categoryKey or category, re-normalize against loaded categories
      if (wizardData.value.categoryKey || wizardData.value.category) {
        const norm = normalizeCategory(wizardData.value.categoryKey, wizardData.value.category)
        wizardData.value.categoryKey = norm.key
        wizardData.value.category = norm.categoryValue
        if (props.formId && norm.categoryValue) {
          const catNode =
            getNodeByName(props.formId, 'category2') ||
            getNodeByName(props.formId, 'category')
          catNode?.input(norm.categoryValue)
        }
      }
    }
  } catch (err) {
    // Graceful fallback to ObjectManager store
  }
})

const defaultCategoryOptions = [
  { name: __('Service Request'), value: 'Service Request' },
  { name: __('Software Support'), value: 'Software' },
  { name: __('Hardware & Equipment'), value: 'Hardware' },
]

/** Top-level category cards dynamically loaded from server metadata / ObjectManager ('category2' / 'category') */
const categoryCards = computed(() => {
  const serverCats = serverMetadata.value?.categories
  const cat2 = getFieldOptions('category2')
  const cat1 = getFieldOptions('category')
  const opts =
    serverCats && serverCats.length > 0
      ? serverCats
      : cat2.length > 0
        ? cat2
        : cat1.length > 0
          ? cat1
          : defaultCategoryOptions

  return opts.map((opt) => {
    const hint = categoryIconMap[opt.value] ?? categoryIconMap[opt.name] ?? {
      icon: 'chat',
      badge: opt.name,
      desc: opt.name,
      key: '' as CategoryKey,
    }
    return {
      key: (hint.key || (opt.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') as CategoryKey)),
      label: opt.name,
      categoryValue: opt.value,
      desc: hint.desc || opt.name,
      badge: hint.badge || opt.name,
      icon: hint.icon || 'chat',
    }
  })
})

/** All subcategory options dynamically loaded from server metadata / ObjectManager ('subcategory') */
const allSubCategories = computed(() => {
  const serverSubs = serverMetadata.value?.all_subcategories
  const sub1 = getFieldOptions('subcategory')
  const sub2 = getFieldOptions('sub_category')
  const opts =
    serverSubs && serverSubs.length > 0
      ? serverSubs
      : sub1.length > 0
        ? sub1
        : sub2
  return opts.map((opt) => {
    const hint = subCategoryHintMap[opt.value] ?? subCategoryHintMap[opt.name] ?? {}
    return {
      value: opt.value,
      label: hint.label ?? opt.name,
      desc: hint.desc ?? opt.value,
      icon: hint.icon ?? 'chat',
    }
  })
})

// Known parent→subcategory mapping from Core Workflows.
// Subcategories not explicitly listed here (e.g. newly added by admin) appear under every category.
const subCategoryParentMap: Record<string, string[]> = {
  'Service Request': [
    'Password Reset','Account Lockout','MFA Reset','Email Account Activation',
    'Email Account Deactivation','Shared Mailbox Access','File Share/ Drive Access',
    'New ID Card','Net2 Door Access/Removal','Onboarding (New Starter)','Offboarding (Leaver)',
    'Group Membership Change','Role Change Access','Desktop PC Request','Laptop Request',
    'SMS Access','Others',
  ],
  Software: [
    'MS Office Suite','Outlook','LSST Portal','IBM SPSS','Windows OS','Web Browsers',
    'Antivirus/ Endpoint Sec','Printing Software','Education Software','Software Installation',
    'Software Licensing','Application Access Request','Application License','VPN Access',
    'Wi-Fi Access','Remote Desktop Access','Others',
  ],
  Hardware: [
    'Desktop PC','Laptop','Monitor','Printer','Scanner','Attendance Device','Projector',
    'Peripherals','IPad','Camera/CCTV','Access Point','Network Switches','Cable Management',
    'BT Work Phone','BT Work/Soft Phone Setup','Toner Replacement','Others',
  ],
}

/** Subcategory list grouped by category key */
const subCategoryMap = computed<
  Record<string, Array<{ value: string; label: string; desc: string; icon: string; categoryValue: string }>>
>(() => {
  const result: Record<string, Array<{ value: string; label: string; desc: string; icon: string; categoryValue: string }>> = {}
  const serverMap = serverMetadata.value?.subcategories_by_category

  for (const cat of categoryCards.value) {
    let items: Array<{ value: string; label: string; desc: string; icon: string; categoryValue: string }> = []
    if (serverMap && serverMap[cat.categoryValue]) {
      items = serverMap[cat.categoryValue].map((sub) => {
        const hint = subCategoryHintMap[sub.value] ?? subCategoryHintMap[sub.name] ?? {}
        return {
          value: sub.value,
          label: hint.label ?? sub.name,
          desc: hint.desc ?? sub.value,
          icon: hint.icon ?? 'chat',
          categoryValue: cat.categoryValue,
        }
      })
    } else {
      const knownForCat = new Set(subCategoryParentMap[cat.categoryValue] ?? [])
      const knownAnywhere = new Set(Object.values(subCategoryParentMap).flat())
      items = allSubCategories.value
        .filter((sub) => knownForCat.has(sub.value) || !knownAnywhere.has(sub.value))
        .map((sub) => Object.assign({}, sub, { categoryValue: cat.categoryValue }))
    }

    result[cat.key] = items
    result[cat.categoryValue] = items
    result[cat.categoryValue.toLowerCase()] = items
  }

  if (result.software) {
    result.it = result.software
  }
  if (result.service_request) {
    result.account = result.service_request
    result.general = result.service_request
  }

  return result
})

const defaultCampusOptions = [
  { name: 'LSST Wembley', value: 'LSST Wembley' },
  { name: 'LSST Elephant & Castle', value: 'LSST Elephant & Castle' },
  { name: 'LSST Stratford', value: 'LSST Stratford' },
  { name: 'LSST Aston', value: 'LSST Aston' },
  { name: 'LSST Luton', value: 'LSST Luton' },
  { name: 'LSST MEMO House', value: 'LSST MEMO House' },
  { name: 'FSB Sheffield', value: 'FSB Sheffield' },
  { name: 'FSB Leicester', value: 'FSB Leicester' },
  { name: 'FSB Croydon', value: 'FSB Croydon' },
  { name: 'FSB Digbeth', value: 'FSB Digbeth' },
  { name: 'FSB MEMO House', value: 'FSB MEMO House' },
  { name: 'UKBC Leicester', value: 'UKBC Leicester' },
]

/** Campus tiles dynamically loaded from server metadata / ObjectManager ('campus') */
const campusTiles = computed(() => {
  const serverCampuses = serverMetadata.value?.campuses
  const opts =
    serverCampuses && serverCampuses.length > 0
      ? serverCampuses
      : getFieldOptions('campus').length > 0
        ? getFieldOptions('campus')
        : defaultCampusOptions

  return opts.map((opt) => {
    const hint = campusHintMap[opt.value] ?? campusHintMap[opt.name]
    const firstWord = opt.value.trim().split(/\s+/)[0]?.toUpperCase() || ''
    const institution =
      hint?.institution ??
      (['LSST', 'FSB', 'UKBC'].includes(firstWord)
        ? firstWord
        : firstWord.length <= 5 && firstWord.length >= 2 && /^[A-Z0-9]+$/.test(firstWord)
          ? firstWord
          : 'Other')
    return {
      value: opt.value,
      label: opt.name,
      institution,
      location: hint?.location ?? institution,
      desc: hint?.desc ?? opt.name,
    }
  })
})

/** Unique institution names present in campus list (for dynamic filter tabs) */
const availableInstitutions = computed(() => {
  const seen = new Set<string>()
  campusTiles.value.forEach((c) => {
    if (c.institution && c.institution !== 'Other') seen.add(c.institution)
  })
  if (campusTiles.value.some((c) => c.institution === 'Other')) {
    seen.add('Other')
  }
  return Array.from(seen)
})

/** Read live sub-category options from underlying form node if available */
const liveSubCategories = computed(() => {
  if (!props.formId) return []
  const subNode =
    getNodeByName(props.formId, 'subcategory') ||
    getNodeByName(props.formId, 'sub_category')
  const rawOpts = subNode?.context?.options || subNode?.props?.options
  if (Array.isArray(rawOpts) && rawOpts.length > 0) {
    return normalizeRawOptions(rawOpts).map((opt) => {
      const hint = subCategoryHintMap[opt.value] || subCategoryHintMap[opt.name]
      return {
        value: opt.value,
        label: hint?.label ?? opt.name,
        desc: hint?.desc ?? opt.value,
        icon: hint?.icon ?? 'chat',
        categoryValue: wizardData.value.category,
      }
    })
  }
  return []
})

const subCategorySearch = ref('')
const filteredSubCategories = computed(() => {
  let list = liveSubCategories.value
  if (!list || list.length === 0) {
    const key = wizardData.value.categoryKey
    const catVal = wizardData.value.category
    list =
      (key && subCategoryMap.value[key]) ||
      (catVal && subCategoryMap.value[catVal]) ||
      (catVal && subCategoryMap.value[catVal.toLowerCase()]) ||
      (key === 'it' && subCategoryMap.value.software) ||
      (categoryCards.value[0]?.key && subCategoryMap.value[categoryCards.value[0].key]) ||
      []
  }
  if (!subCategorySearch.value.trim()) return list
  const q = subCategorySearch.value.toLowerCase().trim()
  return list.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q),
  )
})

const campusSearch = ref('')
const campusInstitution = ref<string>('all')

const filteredCampuses = computed(() => {
  return campusTiles.value.filter((c) => {
    const matchesInst =
      campusInstitution.value === 'all' || c.institution === campusInstitution.value
    if (!matchesInst) return false
    if (!campusSearch.value.trim()) return true
    const q = campusSearch.value.toLowerCase().trim()
    return (
      c.label.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q)
    )
  })
})

// Category display name
const currentCategoryLabel = computed(() => {
  const card = categoryCards.value.find(
    (c) => c.key === wizardData.value.categoryKey || c.categoryValue === wizardData.value.category,
  )
  return card ? card.label : wizardData.value.category || 'Category'
})

// Automated title tracking & generation based on selections
const isTitleManuallyEdited = ref(Boolean(props.initialValues?.title))

const computedAutomatedTitle = computed(() => {
  const sub = wizardData.value.subCategory?.trim()
  const campus = wizardData.value.campus?.trim()
  const cat = currentCategoryLabel.value?.trim() || wizardData.value.category?.trim()

  if (sub && campus) {
    if (sub.toLowerCase() === 'others' || sub.toLowerCase() === 'other') {
      return cat ? `${cat} - ${campus}` : `Support Request - ${campus}`
    }
    return `${sub} - ${campus}`
  }
  if (sub) {
    if (sub.toLowerCase() === 'others' || sub.toLowerCase() === 'other') {
      return cat ? `${cat} Request` : 'Support Request'
    }
    return sub
  }
  if (cat && campus) {
    return `${cat} - ${campus}`
  }
  if (cat) {
    return `${cat} Request`
  }
  return ''
})

const resetToAutomatedTitle = () => {
  if (computedAutomatedTitle.value) {
    wizardData.value.title = computedAutomatedTitle.value
    isTitleManuallyEdited.value = false
  }
}

watch(
  [
    () => wizardData.value.category,
    () => wizardData.value.subCategory,
    () => wizardData.value.campus,
    () => currentCategoryLabel.value,
  ],
  () => {
    if (!isTitleManuallyEdited.value || !wizardData.value.title.trim()) {
      const auto = computedAutomatedTitle.value
      if (auto) {
        wizardData.value.title = auto
      }
    }
  },
  { immediate: true },
)

watch(
  () => currentStep.value,
  (step) => {
    if (step === 4 && (!isTitleManuallyEdited.value || !wizardData.value.title.trim())) {
      if (computedAutomatedTitle.value) {
        wizardData.value.title = computedAutomatedTitle.value
      }
    }
  },
)

const titlePlaceholder = computed(() => {
  if (computedAutomatedTitle.value) {
    return computedAutomatedTitle.value
  }
  const sub = wizardData.value.subCategory?.trim()
  if (sub) return `e.g. ${sub} issue...`
  return __('e.g. Briefly describe your request...')
})

// Description placeholder
const descriptionPlaceholder = computed(() => {
  return __('Describe your issue in short and simple...')
})


// Auto-advance timer reference & step navigation
let advanceTimeout: ReturnType<typeof setTimeout> | null = null

const goToStep = (step: number) => {
  if (props.isSubmitting) return
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
  transitionDirection.value = step > currentStep.value ? 'forward' : 'backward'
  currentStep.value = step

  if (step === 4 && (!isTitleManuallyEdited.value || !wizardData.value.title.trim())) {
    if (computedAutomatedTitle.value) {
      wizardData.value.title = computedAutomatedTitle.value
    }
  }

  nextTick(() => {
    stepHeadingRef.value?.focus()
  })
}

const handleGridKeydown = (e: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
  const currentTarget = e.currentTarget as HTMLElement
  const container = currentTarget.parentElement
  if (!container) return
  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('button'),
  )
  const currentIndex = buttons.indexOf(currentTarget as HTMLButtonElement)
  if (currentIndex === -1) return

  e.preventDefault()
  let nextIndex = currentIndex
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % buttons.length
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
  }
  buttons[nextIndex]?.focus()
}

const handleBack = () => {
  if (props.isSubmitting) return
  if (currentStep.value > 1) {
    goToStep(currentStep.value - 1)
  }
}

// Handlers for step selections with micro-animation, form sync and auto-advance
const selectCategory = (card: { key: CategoryKey; categoryValue: string }) => {
  wizardData.value.categoryKey = card.key
  wizardData.value.category = card.categoryValue
  // Reset downstream selections if category changed
  wizardData.value.subCategory = ''

  // Sync to underlying form node to trigger Core Workflows and form-updater
  if (props.formId) {
    const catNode =
      getNodeByName(props.formId, 'category2') ||
      getNodeByName(props.formId, 'category')
    catNode?.input(card.categoryValue)
  }

  if (advanceTimeout) clearTimeout(advanceTimeout)
  advanceTimeout = setTimeout(() => {
    goToStep(2)
  }, 220)
}

const selectSubCategory = (sub: { value: string; categoryValue?: string }) => {
  wizardData.value.subCategory = sub.value
  if (sub.categoryValue) {
    wizardData.value.category = sub.categoryValue
  }

  if (props.formId) {
    const subNode =
      getNodeByName(props.formId, 'subcategory') ||
      getNodeByName(props.formId, 'sub_category')
    subNode?.input(sub.value)
  }

  if (advanceTimeout) clearTimeout(advanceTimeout)
  advanceTimeout = setTimeout(() => {
    goToStep(3)
  }, 220)
}

const selectCampus = (campusValue: string) => {
  wizardData.value.campus = campusValue

  if (props.formId) {
    const campusNode = getNodeByName(props.formId, 'campus')
    campusNode?.input(campusValue)
  }

  if (!isTitleManuallyEdited.value || !wizardData.value.title.trim()) {
    const auto = computedAutomatedTitle.value
    if (auto) {
      wizardData.value.title = auto
    }
  }

  if (advanceTimeout) clearTimeout(advanceTimeout)
  advanceTimeout = setTimeout(() => {
    goToStep(4)
  }, 220)
}

// Drag & drop file uploads
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const handleFiles = (files: FileList | null) => {
  if (!files || !files.length) return
  const newFiles = Array.from(files)
  wizardData.value.attachments = [...wizardData.value.attachments, ...newFiles]
}

const removeFile = (index: number) => {
  wizardData.value.attachments.splice(index, 1)
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Submission
const handleSubmit = () => {
  titleTouched.value = true
  bodyTouched.value = true

  if (!isDetailsValid.value || props.isSubmitting) return

  emit('submit', { ...wizardData.value })
}

// Cancel prompt
const handleCancelClick = () => {
  if (
    wizardData.value.title.trim().length > 0 ||
    wizardData.value.body.trim().length > 0 ||
    wizardData.value.attachments.length > 0
  ) {
    showCancelConfirm.value = true
  } else {
    emit('cancel')
  }
}

const confirmCancel = () => {
  showCancelConfirm.value = false
  emit('cancel')
}

// Step labels for progress bar
const steps = [
  { id: 1, label: 'Category' },
  { id: 2, label: 'Sub-Category' },
  { id: 3, label: 'Campus' },
  { id: 4, label: 'Details' },
]

</script>

<template>
  <div class="customer-wizard-wrapper relative w-full">
    <!-- SUCCESS SCREEN -->
    <div
      v-if="createdTicketInfo"
      class="relative overflow-hidden rounded-3xl border border-emerald-200 bg-white p-8 sm:p-12 text-center shadow-xl shadow-emerald-950/[0.04]"
    >
      <!-- Ambient Glow at the Top -->
      <div
        class="pointer-events-none absolute -top-24 inset-x-0 mx-auto h-48 w-[600px] rounded-full bg-radial from-emerald-100/50 via-emerald-50/20 to-transparent blur-2xl"
        aria-hidden="true"
      />

      <!-- Animated SVG Checkmark Icon -->
      <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/70">
        <svg
          class="checkmark-svg h-10 w-10 text-[#16a34a]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path
            class="checkmark-check"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div class="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3.5 py-1 text-xs font-bold text-emerald-800">
        <span class="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse"></span>
        <span>{{ $t('Ticket Created Successfully') }}</span>
      </div>

      <h2 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
        {{ $t('Your support request is submitted!') }}
      </h2>

      <!-- Ticket Number Badge -->
      <div class="mt-4 mb-3 inline-block rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 px-6 py-2.5 shadow-2xs">
        <span class="text-xs uppercase tracking-wider font-extrabold text-emerald-800 block">
          {{ $t('Reference Number') }}
        </span>
        <span class="text-2xl sm:text-3xl font-black text-[#15803d] font-mono tracking-tight">
          {{ createdTicketInfo.number.startsWith('#') ? createdTicketInfo.number : `#${createdTicketInfo.number}` }}
        </span>
      </div>

      <p class="mx-auto max-w-lg text-sm sm:text-base text-slate-600 leading-relaxed">
        {{
          $t(
            'We have routed your ticket to the %s team under %s. Our student support staff will review and respond promptly.',
            wizardData.campus || 'Campus',
            wizardData.subCategory || currentCategoryLabel,
          )
        }}
      </p>

      <!-- Summary Card -->
      <div class="mx-auto mt-6 max-w-md rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-left text-xs sm:text-sm space-y-2">
        <div class="flex items-center justify-between text-slate-500">
          <span class="font-medium">{{ $t('Category') }}</span>
          <span class="font-bold text-slate-800">{{ currentCategoryLabel }}</span>
        </div>
        <div class="flex items-center justify-between text-slate-500">
          <span class="font-medium">{{ $t('Sub-Category') }}</span>
          <span class="font-bold text-slate-800">{{ wizardData.subCategory }}</span>
        </div>
        <div class="flex items-center justify-between text-slate-500">
          <span class="font-medium">{{ $t('Campus') }}</span>
          <span class="font-bold text-slate-800">{{ wizardData.campus }}</span>
        </div>
        <div class="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-200/60">
          <span class="font-medium">{{ $t('Subject') }}</span>
          <span class="font-bold text-slate-900 truncate max-w-[220px]">{{ wizardData.title }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
        <button
          type="button"
          class="w-full sm:w-auto flex-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-950/20 transition-all hover:-translate-y-0.5"
          @click="emit('view-ticket', createdTicketInfo.id)"
        >
          <span>{{ $t('View Ticket') }}</span>
          <span>→</span>
        </button>
        <button
          type="button"
          class="w-full sm:w-auto inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 transition-all"
          @click="emit('back-to-dashboard')"
        >
          {{ $t('Back to Dashboard') }}
        </button>
      </div>
    </div>

    <!-- MAIN INTAKE WIZARD CARD -->
    <div
      v-else
      class="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-900/[0.04] transition-all"
    >
      <!-- Slim Dynamic Top Progress Line (replaces static green bar) -->
      <div
        class="h-1 w-full bg-slate-100 overflow-hidden"
        role="progressbar"
        :aria-valuenow="currentStep"
        aria-valuemin="1"
        aria-valuemax="4"
      >
        <div
          class="h-full bg-gradient-to-r from-emerald-500 via-[#16a34a] to-teal-400 transition-all duration-500 ease-out shadow-xs"
          :style="{ width: `${(currentStep / 4) * 100}%` }"
        />
      </div>

      <!-- Ambient Glow at the Top -->
      <div
        class="pointer-events-none absolute -top-20 inset-x-0 mx-auto h-40 w-[550px] rounded-full bg-radial from-emerald-100/40 via-emerald-50/15 to-transparent blur-2xl"
        aria-hidden="true"
      />

      <!-- Top Utility Header (Controls & Advanced Toggle) -->
      <div class="relative z-10 flex items-center justify-between border-b border-slate-100 px-6 py-3.5 sm:px-8 bg-slate-50/50">
        <!-- Back button (visible after step 1) -->
        <div v-if="currentStep > 1" class="flex items-center gap-2.5">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 transition-colors cursor-pointer select-none group"
            @click="handleBack"
          >
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-2xs group-hover:bg-slate-100 group-hover:border-slate-300 transition-all">
              ←
            </span>
            <span>{{ $t('Back') }}</span>
          </button>
          <span class="text-slate-300 font-light">/</span>
          <span class="text-xs font-semibold text-slate-500">
            {{ $t('Step %s of 4: %s', currentStep, steps[currentStep - 1]?.label || '') }}
          </span>
        </div>

        <!-- Brand Crest & Portal Badge (Step 1) -->
        <div v-else class="flex items-center gap-2.5">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#16a34a] border border-emerald-200/80 shadow-2xs">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold tracking-tight text-slate-800">
              {{ $t('Student Support Hub') }}
            </span>
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
              <span class="h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-pulse"></span>
              {{ $t('Help Desk') }}
            </span>
          </div>
        </div>

        <!-- Right Utilities -->
        <div class="flex items-center gap-2.5">
          <!-- Switch to Full Form Link -->
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-[#16a34a] hover:border-emerald-300 hover:bg-emerald-50/40 shadow-2xs transition-all cursor-pointer select-none"
            @click="emit('switch-to-full')"
          >
            <svg class="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span class="hidden sm:inline">{{ $t('Switch to full form') }}</span>
            <span class="sm:hidden">{{ $t('Full Form') }}</span>
          </button>

          <!-- Cancel / Close -->
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 shadow-2xs transition-all cursor-pointer"
            :title="$t('Cancel')"
            @click="handleCancelClick"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- PROGRESS STEPPER -->
      <div class="px-6 pt-5 pb-3 sm:px-8 border-b border-slate-100/80">
        <!-- Desktop Stepper -->
        <div class="hidden sm:flex items-center justify-between">
          <div
            v-for="(st, idx) in steps"
            :key="st.id"
            class="flex items-center flex-1"
            :class="{ 'flex-none': idx === steps.length - 1 }"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 cursor-pointer text-left select-none group"
              :disabled="st.id > currentStep"
              @click="st.id < currentStep ? goToStep(st.id) : undefined"
            >
              <!-- Number circle -->
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
                :class="
                  st.id < currentStep
                    ? 'bg-[#16a34a] text-white shadow-2xs'
                    : st.id === currentStep
                      ? 'border-2 border-[#16a34a] bg-emerald-50 text-[#16a34a] ring-4 ring-emerald-500/15'
                      : 'border border-slate-200 bg-slate-50 text-slate-400'
                "
              >
                <span v-if="st.id < currentStep">✓</span>
                <span v-else>{{ st.id }}</span>
              </span>

              <!-- Label -->
              <span
                class="text-xs font-bold transition-colors"
                :class="
                  st.id === currentStep
                    ? 'text-slate-900'
                    : st.id < currentStep
                      ? 'text-slate-700 group-hover:text-[#16a34a]'
                      : 'text-slate-400'
                "
              >
                {{ $t(st.label) }}
              </span>
            </button>

            <!-- Connecting line between steps -->
            <div
              v-if="idx < steps.length - 1"
              class="mx-3 h-0.5 flex-1 transition-colors duration-300"
              :class="st.id < currentStep ? 'bg-[#16a34a]' : 'bg-slate-200'"
            />
          </div>
        </div>

        <!-- Mobile Stepper (Compact bar + Title) -->
        <div class="sm:hidden flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-[#16a34a]">
              {{ $t('Step %s of 4: %s', currentStep, steps[currentStep - 1]?.label || '') }}
            </span>
            <span class="text-slate-400 font-semibold">{{ Math.round((currentStep / 4) * 100) }}%</span>
          </div>
          <div class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              class="h-full bg-[#16a34a] transition-all duration-300"
              :style="{ width: `${(currentStep / 4) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <!-- STEP CONTENT CONTAINER WITH TRANSITION -->
      <div class="p-6 sm:p-8 md:p-10">
        <Transition
          :name="transitionDirection === 'forward' ? 'slide-forward' : 'slide-backward'"
          mode="out-in"
        >
          <!-- STEP 1: CATEGORY SELECTION -->
          <div v-if="currentStep === 1" key="step-1" class="space-y-6">
            <div class="text-center max-w-lg mx-auto">
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('What can we help you with today?') }}
              </h2>
              <p class="mt-2 text-sm text-slate-500 leading-relaxed">
                {{ $t('Choose a category below to get your request directed to the appropriate support team.') }}
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <button
                v-for="card in categoryCards"
                :key="card.key"
                type="button"
                :aria-pressed="wizardData.categoryKey === card.key"
                class="group relative flex flex-col items-center sm:items-start rounded-2xl p-6 text-center sm:text-left transition-all duration-200 cursor-pointer select-none border-2 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                :class="
                  wizardData.categoryKey === card.key
                    ? 'border-[#16a34a] bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-slate-50/60 shadow-xs'
                "
                @click="selectCategory(card)"
                @keydown="handleGridKeydown"
              >
                <!-- Selected Check Badge -->
                <div
                  v-if="wizardData.categoryKey === card.key"
                  class="absolute top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-xs rtl:left-3.5 ltr:right-3.5"
                >
                  ✓
                </div>

                <!-- Icon Badge -->
                <div
                  class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200"
                  :class="
                    wizardData.categoryKey === card.key
                      ? 'bg-[#16a34a] text-white shadow-sm scale-105'
                      : 'bg-slate-100 text-slate-800 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                  "
                >
                  <!-- Laptop / Hardware Icon -->
                  <svg v-if="card.icon === 'laptop'" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <!-- User Shield Icon -->
                  <svg v-else-if="card.icon === 'shield-user'" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <!-- Chat Icon -->
                  <svg v-else class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>

                <!-- Title & Badge -->
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-bold text-slate-900 group-hover:text-[#16a34a] transition-colors">
                    {{ $t(card.label) }}
                  </h3>
                </div>

                <!-- Description -->
                <p class="mt-1.5 text-xs sm:text-sm text-slate-500 leading-snug">
                  {{ $t(card.desc) }}
                </p>

                <!-- Tap indicator -->
                <span class="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#16a34a] group-hover:translate-x-0.5 transition-transform">
                  <span>{{ $t('Select') }}</span>
                  <span>→</span>
                </span>
              </button>
            </div>
          </div>

          <!-- STEP 2: SUB-CATEGORY SELECTION -->
          <div v-else-if="currentStep === 2" key="step-2" class="space-y-6">
            <div class="text-center max-w-xl mx-auto">
              <!-- Active Category pill -->
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200/80 mb-2 shadow-2xs">
                <span>{{ currentCategoryLabel }}</span>
                <span class="text-emerald-500 font-normal">•</span>
                <span class="text-emerald-700 font-semibold">{{ filteredSubCategories.length }} {{ $t('options') }}</span>
              </span>
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('What specific issue are you having?') }}
              </h2>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {{ $t('Choose an issue below or use quick search to immediately find your topic.') }}
              </p>

              <!-- Search Bar -->
              <div class="relative mt-4 max-w-md mx-auto">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  v-model="subCategorySearch"
                  type="text"
                  class="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-[#16a34a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                  :placeholder="$t('Search issues (e.g. Password Reset, Wi-Fi, Office, Attendance...)')"
                />
                <button
                  v-if="subCategorySearch"
                  type="button"
                  class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  :title="$t('Clear search')"
                  @click="subCategorySearch = ''"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Sub-Category Grid -->
            <div v-if="filteredSubCategories.length > 0" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-2">
              <button
                v-for="sub in filteredSubCategories"
                :key="sub.value"
                type="button"
                :aria-pressed="wizardData.subCategory === sub.value"
                class="group relative flex items-start gap-4 rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 cursor-pointer select-none border-2 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                :class="
                  wizardData.subCategory === sub.value
                    ? 'border-[#16a34a] bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-slate-50/60 shadow-2xs'
                "
                @click="selectSubCategory(sub)"
                @keydown="handleGridKeydown"
              >
                <!-- Selected Check Badge -->
                <div
                  v-if="wizardData.subCategory === sub.value"
                  class="absolute top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-xs text-xs font-bold rtl:left-3.5 ltr:right-3.5"
                >
                  ✓
                </div>

                <!-- Icon Box -->
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
                  :class="
                    wizardData.subCategory === sub.value
                      ? 'bg-[#16a34a] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                  "
                >
                  <!-- Lock -->
                  <svg v-if="sub.icon === 'shield-lock' || sub.icon === 'lock'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <!-- Wifi -->
                  <svg v-else-if="sub.icon === 'wifi'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="3" />
                  </svg>
                  <!-- Key -->
                  <svg v-else-if="sub.icon === 'key'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1-1-1.5 1.5L6 8 3 11a5 5 0 1 0 7 7l7-7 4-4-2-2z" />
                  </svg>
                  <!-- Devices / PC -->
                  <svg v-else-if="sub.icon === 'devices'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <!-- Laptop -->
                  <svg v-else-if="sub.icon === 'laptop'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <!-- Phone -->
                  <svg v-else-if="sub.icon === 'phone'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <!-- Mail -->
                  <svg v-else-if="sub.icon === 'mail'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <!-- Cloud -->
                  <svg v-else-if="sub.icon === 'cloud'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                  <!-- ID Card -->
                  <svg v-else-if="sub.icon === 'id-card'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <circle cx="8" cy="11" r="2.5" />
                    <path d="M14 9h4m-4 4h4m-4 4h2" />
                  </svg>
                  <!-- User -->
                  <svg v-else-if="sub.icon === 'user'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <!-- Users -->
                  <svg v-else-if="sub.icon === 'users'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <!-- Default Document/Generic -->
                  <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>

                <!-- Text -->
                <div class="flex-1 min-w-0 rtl:pl-4 ltr:pr-4">
                  <div class="text-sm font-bold text-slate-900 group-hover:text-[#16a34a] transition-colors truncate">
                    {{ $t(sub.label) }}
                  </div>
                  <div class="mt-0.5 text-xs text-slate-500 leading-snug line-clamp-2">
                    {{ $t(sub.desc) }}
                  </div>
                </div>
              </button>
            </div>

            <!-- Empty Search State -->
            <div v-else class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 class="mt-3 text-sm font-bold text-slate-800">{{ $t('No matching issues found') }}</h3>
              <p class="mt-1 text-xs text-slate-500">{{ $t('Try a different search keyword or browse all available options.') }}</p>
              <button
                type="button"
                class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-[#16a34a] shadow-2xs transition-colors cursor-pointer"
                @click="subCategorySearch = ''"
              >
                {{ $t('Show all options') }}
              </button>
            </div>
          </div>

          <!-- STEP 3: CAMPUS SELECTION -->
          <div v-else-if="currentStep === 3" key="step-3" class="space-y-6">
            <div class="text-center max-w-xl mx-auto">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200/80 mb-2 shadow-2xs">
                <span>{{ wizardData.subCategory || currentCategoryLabel }}</span>
              </span>
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('Which campus do you study or work at?') }}
              </h2>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {{ $t('Select your campus so your ticket is routed directly to local on-site technicians.') }}
              </p>

              <!-- Institution Filters + Search -->
              <div class="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <!-- Institution Filter Pills (Dynamic from ObjectManager) -->
                <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 text-xs font-bold overflow-x-auto max-w-full">
                  <button
                    type="button"
                    class="rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap"
                    :class="
                      campusInstitution === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    "
                    @click="campusInstitution = 'all'"
                  >
                    {{ $t('All') }} ({{ campusTiles.length }})
                  </button>
                  <button
                    v-for="inst in availableInstitutions"
                    :key="inst"
                    type="button"
                    class="rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap"
                    :class="
                      campusInstitution === inst
                        ? inst === 'LSST'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : inst === 'FSB'
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : inst === 'UKBC'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-slate-800 text-white shadow-2xs'
                        : inst === 'LSST'
                          ? 'text-slate-600 hover:text-emerald-700'
                          : inst === 'FSB'
                            ? 'text-slate-600 hover:text-sky-700'
                            : inst === 'UKBC'
                              ? 'text-slate-600 hover:text-purple-700'
                              : 'text-slate-600 hover:text-slate-900'
                    "
                    @click="campusInstitution = inst"
                  >
                    {{ inst }} ({{ campusTiles.filter((c) => c.institution === inst).length }})
                  </button>
                </div>

                <!-- Campus Search -->
                <div class="relative w-full sm:w-60">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    v-model="campusSearch"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-[#16a34a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                    :placeholder="$t('Search campus or city...')"
                  />
                  <button
                    v-if="campusSearch"
                    type="button"
                    class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    :title="$t('Clear search')"
                    @click="campusSearch = ''"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Campus Tiles Grid -->
            <div v-if="filteredCampuses.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              <button
                v-for="campus in filteredCampuses"
                :key="campus.value"
                type="button"
                :aria-pressed="wizardData.campus === campus.value"
                class="group relative flex flex-col items-start rounded-2xl p-5 text-left transition-all duration-200 cursor-pointer select-none border-2 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]"
                :class="
                  wizardData.campus === campus.value
                    ? 'border-[#16a34a] bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-slate-50/60 shadow-2xs'
                "
                @click="selectCampus(campus.value)"
                @keydown="handleGridKeydown"
              >
                <!-- Selected Badge -->
                <div
                  v-if="wizardData.campus === campus.value"
                  class="absolute top-3.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#16a34a] text-white shadow-xs text-xs font-bold rtl:left-3.5 ltr:right-3.5"
                >
                  ✓
                </div>

                <!-- Header Row: Icon & Institution Badge -->
                <div class="flex items-center justify-between w-full mb-3">
                  <!-- Campus Pin Icon -->
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                    :class="
                      wizardData.campus === campus.value
                        ? 'bg-[#16a34a] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800'
                    "
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>

                  <!-- Institution Badge Pill -->
                  <span
                    class="rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide"
                    :class="
                      campus.institution === 'LSST'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : campus.institution === 'FSB'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                    "
                  >
                    {{ campus.institution }}
                  </span>
                </div>

                <!-- Campus Name -->
                <div class="text-sm font-bold text-slate-900 group-hover:text-[#16a34a] transition-colors">
                  {{ campus.label }}
                </div>
                <div class="mt-0.5 text-xs font-semibold text-emerald-700">
                  {{ campus.location }}
                </div>
                <div class="mt-1 text-xs text-slate-500 leading-snug">
                  {{ campus.desc }}
                </div>
              </button>
            </div>

            <!-- Empty Campus State -->
            <div v-else class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 class="mt-3 text-sm font-bold text-slate-800">{{ $t('No matching campus found') }}</h3>
              <p class="mt-1 text-xs text-slate-500">{{ $t('No campus matches your filter or search criteria.') }}</p>
              <button
                type="button"
                class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-[#16a34a] shadow-2xs transition-colors cursor-pointer"
                @click="campusSearch = ''; campusInstitution = 'all'"
              >
                {{ $t('Show all') }} ({{ campusTiles.length }})
              </button>
            </div>
          </div>

          <!-- STEP 4: DETAILS & SUBMIT -->
          <div v-else-if="currentStep === 4" key="step-4" class="relative space-y-6">
            <!-- Loading Overlay during submission -->
            <div
              v-if="isSubmitting"
              class="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-white/80 backdrop-blur-2xs text-center"
            >
              <div class="flex items-center gap-3.5 rounded-2xl border border-emerald-200 bg-white px-6 py-4 shadow-xl shadow-emerald-950/5">
                <svg class="h-6 w-6 animate-spin text-[#16a34a]" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div class="text-left">
                  <div class="text-sm font-bold text-slate-900">{{ $t('Submitting your support request...') }}</div>
                  <div class="text-xs text-slate-500">{{ $t('Please wait while we route your ticket.') }}</div>
                </div>
              </div>
            </div>
            <div class="text-center max-w-lg mx-auto">
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('Provide ticket details') }}
              </h2>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {{ $t('Review your choices below, enter a subject, and describe what you need help with.') }}
              </p>
            </div>

            <!-- Summary Header with Edit Chips -->
            <div class="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {{ $t('Your Selections') }}
                </span>
                <span class="text-xs font-semibold text-slate-400">
                  {{ $t('Tap any chip to edit') }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <!-- Category Chip -->
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                  @click="goToStep(1)"
                >
                  <span>📁</span>
                  <span>{{ currentCategoryLabel }}</span>
                  <span class="text-slate-400">✎</span>
                </button>

                <!-- Sub-Category Chip -->
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                  @click="goToStep(2)"
                >
                  <span>🏷️</span>
                  <span>{{ wizardData.subCategory }}</span>
                  <span class="text-slate-400">✎</span>
                </button>

                <!-- Campus Chip -->
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                  @click="goToStep(3)"
                >
                  <span>📍</span>
                  <span>{{ wizardData.campus }}</span>
                  <span class="text-slate-400">✎</span>
                </button>
              </div>
            </div>

            <!-- Free Text Inputs -->
            <!-- eslint-disable vuejs-accessibility/label-has-for -->
            <div class="space-y-5">
              <!-- Title Field -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label for="wizard-ticket-title" class="block text-xs sm:text-sm font-bold text-slate-800">
                    {{ $t('Subject / Short Title') }}
                    <span class="text-rose-500">*</span>
                  </label>
                  <button
                    v-if="isTitleManuallyEdited && computedAutomatedTitle && wizardData.title !== computedAutomatedTitle"
                    type="button"
                    class="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                    @click="resetToAutomatedTitle"
                  >
                    {{ $t('Reset to suggested title') }}
                  </button>
                </div>
                <input
                  id="wizard-ticket-title"
                  v-model="wizardData.title"
                  type="text"
                  aria-required="true"
                  class="w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 transition-all outline-none placeholder:text-slate-400"
                  :class="
                    titleError
                      ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#16a34a] focus:ring-2 focus:ring-emerald-500/15'
                  "
                  :placeholder="titlePlaceholder"
                  @input="isTitleManuallyEdited = true"
                  @blur="titleTouched = true"
                />
                <p v-if="titleError" class="mt-1 text-xs font-semibold text-rose-600">
                  {{ titleError }}
                </p>
                <p v-else-if="!isTitleManuallyEdited && computedAutomatedTitle" class="mt-1 text-[11px] text-slate-400">
                  {{ $t('Automated title based on your selections. You can customize it as needed.') }}
                </p>
              </div>

              <!-- Description Field -->
              <div>
                <label for="wizard-ticket-body" class="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {{ $t('Description / Issue Details') }}
                  <span class="text-rose-500">*</span>
                </label>
                <textarea
                  id="wizard-ticket-body"
                  v-model="wizardData.body"
                  rows="6"
                  aria-required="true"
                  class="w-full rounded-xl border px-4 py-3 text-sm font-medium text-slate-900 transition-all outline-none placeholder:text-slate-400 resize-y"
                  :class="
                    bodyError
                      ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-200 bg-slate-50/60 focus:bg-white focus:border-[#16a34a] focus:ring-2 focus:ring-emerald-500/15'
                  "
                  :placeholder="descriptionPlaceholder"
                  @blur="bodyTouched = true"
                />
                <p v-if="bodyError" class="mt-1 text-xs font-semibold text-rose-600">
                  {{ bodyError }}
                </p>
              </div>

              <!-- Attachments Dropzone -->
              <div>
                <label for="wizard-ticket-files" class="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {{ $t('Attach Files or Screenshots (Optional)') }}
                </label>
                <button
                  type="button"
                  aria-label="Upload files or screenshots"
                  class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer w-full"
                  :class="
                    isDragging
                      ? 'border-[#16a34a] bg-emerald-50/80'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                  "
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="onDrop"
                  @click="fileInputRef?.click()"
                >
                  <input
                    id="wizard-ticket-files"
                    ref="fileInputRef"
                    type="file"
                    multiple
                    class="hidden"
                    aria-label="File upload"
                    @change="(e) => handleFiles((e.target as HTMLInputElement).files)"
                  />
                  <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-2xs border border-slate-200/80 mb-2">
                    <svg class="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div class="text-xs sm:text-sm font-bold text-slate-800">
                    {{ $t('Click to browse or drag and drop files here') }}
                  </div>
                  <div class="text-xs text-slate-400 mt-0.5">
                    {{ $t('Screenshots, PDFs, documents up to 50MB') }}
                  </div>
                </button>
              </div>

                <!-- Attached Files List -->
                <div v-if="wizardData.attachments.length > 0" class="mt-3 space-y-2">
                  <div
                    v-for="(f, fIdx) in wizardData.attachments"
                    :key="f.name + fIdx"
                    class="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-200 text-xs sm:text-sm"
                  >
                    <div class="flex items-center gap-2.5 truncate rtl:pl-2 ltr:pr-2">
                      <span class="text-emerald-700">📎</span>
                      <span class="font-bold text-slate-800 truncate">{{ f.name }}</span>
                      <span class="text-xs text-slate-400 shrink-0">({{ formatFileSize(f.size) }})</span>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer shrink-0"
                      :title="$t('Remove file')"
                      @click="removeFile(fIdx)"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

            <!-- Bottom Actions -->
            <div class="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                :disabled="isSubmitting"
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleBack"
              >
                <span>←</span>
                <span>{{ $t('Back') }}</span>
              </button>

              <button
                type="button"
                class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] px-8 py-3 text-sm sm:text-base font-bold text-white shadow-md shadow-emerald-950/20 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none select-none min-w-[170px]"
                :disabled="isSubmitting || !wizardData.title.trim() || !wizardData.body.trim()"
                @click="handleSubmit"
              >
                <svg
                  v-if="isSubmitting"
                  class="h-5 w-5 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span v-if="isSubmitting">{{ $t('Submitting Ticket...') }}</span>
                <span v-else>{{ $t('Submit Ticket') }} →</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- CANCEL CONFIRM MODAL -->
    <div
      v-if="showCancelConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
        <h3 class="text-base font-black text-slate-900">
          {{ $t('Discard your support request?') }}
        </h3>
        <p class="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
          {{ $t('You have entered details that will be lost if you leave now.') }}
        </p>
        <div class="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            @click="showCancelConfirm = false"
          >
            {{ $t('Keep Editing') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs cursor-pointer"
            @click="confirmCancel"
          >
            {{ $t('Discard') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Motion and Slide Transitions */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-backward-enter-active,
.slide-backward-leave-active {
  transition: all 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-forward-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.slide-forward-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.slide-backward-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
.slide-backward-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (prefers-reduced-motion: reduce) {
  .slide-forward-enter-active,
  .slide-forward-leave-active,
  .slide-backward-enter-active,
  .slide-backward-leave-active {
    transition: opacity 120ms ease !important;
    transform: none !important;
  }
}

/* Success Checkmark Animation */
.checkmark-check {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.15s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}
</style>
