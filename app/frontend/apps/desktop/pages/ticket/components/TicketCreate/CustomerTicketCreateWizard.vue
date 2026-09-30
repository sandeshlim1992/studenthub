<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export interface WizardData {
  categoryKey: 'it' | 'account' | 'general' | ''
  category: string
  subCategory: string
  campus: string
  title: string
  body: string
  attachments: File[]
}

interface Props {
  isSubmitting?: boolean
  createdTicketInfo?: { id: number; number: string } | null
  initialValues?: Partial<WizardData>
}

const props = withDefaults(defineProps<Props>(), {
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

// Step state: 1 = Category, 2 = Sub-category, 3 = Campus, 4 = Details
const currentStep = ref<number>(props.initialValues?.categoryKey ? 2 : 1)
const transitionDirection = ref<'forward' | 'backward'>('forward')
const showCancelConfirm = ref(false)
const stepHeadingRef = ref<HTMLHeadingElement | null>(null)

const wizardData = ref<WizardData>({
  categoryKey: props.initialValues?.categoryKey || '',
  category: props.initialValues?.category || '',
  subCategory: props.initialValues?.subCategory || '',
  campus: props.initialValues?.campus || '',
  title: props.initialValues?.title || '',
  body: props.initialValues?.body || '',
  attachments: props.initialValues?.attachments || [],
})

watch(
  () => props.initialValues,
  (newVals) => {
    if (newVals?.categoryKey && !wizardData.value.categoryKey) {
      wizardData.value.categoryKey = newVals.categoryKey
      wizardData.value.category = newVals.category || ''
      currentStep.value = 2
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

// Auto-advance timer reference
let advanceTimeout: ReturnType<typeof setTimeout> | null = null

const goToStep = (step: number) => {
  if (advanceTimeout) {
    clearTimeout(advanceTimeout)
    advanceTimeout = null
  }
  transitionDirection.value = step > currentStep.value ? 'forward' : 'backward'
  currentStep.value = step

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
  if (currentStep.value > 1) {
    goToStep(currentStep.value - 1)
  }
}

// Category definitions
const categoryCards = [
  {
    key: 'it' as const,
    label: __('IT Support'),
    categoryValue: 'Software',
    desc: __('Software, hardware, VPN access & university Wi-Fi'),
    badge: 'Popular',
    icon: 'laptop',
  },
  {
    key: 'account' as const,
    label: __('Account Help'),
    categoryValue: 'Service Request',
    desc: __('Password resets, email accounts & access permissions'),
    badge: __('Fast Track'),
    icon: 'shield-user',
  },
  {
    key: 'general' as const,
    label: __('General Enquiry'),
    categoryValue: 'Service Request',
    desc: __('Student ID cards, letters, course & campus queries'),
    badge: 'Support',
    icon: 'chat',
  },
]

// Sub-categories mapped by categoryKey
const subCategoryMap: Record<
  'it' | 'account' | 'general',
  Array<{ value: string; label: string; desc: string; icon: string; categoryValue: string }>
> = {
  it: [
    {
      value: 'VPN Access',
      label: __('VPN Access'),
      categoryValue: 'Software',
      desc: __('Cisco AnyConnect & secure off-campus connection'),
      icon: 'shield-lock',
    },
    {
      value: 'Wi-Fi Access',
      label: __('Wi-Fi Access'),
      categoryValue: 'Software',
      desc: __('Eduroam & campus student Wi-Fi network'),
      icon: 'wifi',
    },
    {
      value: 'Application License',
      label: __('Application License'),
      categoryValue: 'Software',
      desc: __('Software keys, Office 365, Teams & renewals'),
      icon: 'key',
    },
    {
      value: 'Desktop PC Request',
      label: __('Hardware & Desktop PC'),
      categoryValue: 'Hardware',
      desc: __('Campus lab PC, monitor or computer hardware help'),
      icon: 'devices',
    },
    {
      value: 'BT Work/Soft Phone Setup',
      label: __('Phone & Audio Setup'),
      categoryValue: 'Hardware',
      desc: __('Softphone, headset & university phone setup'),
      icon: 'phone',
    },
  ],
  account: [
    {
      value: 'Password Reset',
      label: __('Password Reset'),
      categoryValue: 'Service Request',
      desc: __('Student portal, university email & VLE password reset'),
      icon: 'key',
    },
    {
      value: 'Account Lockout',
      label: __('Account Lockout'),
      categoryValue: 'Service Request',
      desc: __('Unlock university account after failed attempts'),
      icon: 'lock',
    },
    {
      value: 'MFA Reset',
      label: __('MFA & Two-Factor Reset'),
      categoryValue: 'Service Request',
      desc: __('Authenticator app, phone change & MFA help'),
      icon: 'shield-lock',
    },
    {
      value: 'Email Account Activation',
      label: __('Email Activation'),
      categoryValue: 'Service Request',
      desc: __('New student email setup, verification & inbox issues'),
      icon: 'mail',
    },
    {
      value: 'File Share/ Drive Access',
      label: __('OneDrive / File Share'),
      categoryValue: 'Service Request',
      desc: __('OneDrive, Google Drive & shared cloud storage access'),
      icon: 'cloud',
    },
    {
      value: 'Shared Mailbox Access',
      label: __('Shared Mailbox Access'),
      categoryValue: 'Service Request',
      desc: __('Course, department or student society mailbox access'),
      icon: 'mail',
    },
  ],
  general: [
    {
      value: 'New ID Card',
      label: __('Student ID Card'),
      categoryValue: 'Service Request',
      desc: __('Replacement for lost, stolen, or damaged ID cards'),
      icon: 'id-card',
    },
    {
      value: 'Net2 Door Access/Removal',
      label: __('Campus Door & Turnstile Access'),
      categoryValue: 'Service Request',
      desc: __('Building access, electronic doors & swipe access'),
      icon: 'key',
    },
    {
      value: 'Onboarding (New Starter)',
      label: __('New Student Onboarding'),
      categoryValue: 'Service Request',
      desc: __('Enrollment assistance, induction & starter support'),
      icon: 'user',
    },
    {
      value: 'Group Membership Change',
      label: __('Group Membership'),
      categoryValue: 'Service Request',
      desc: __('Student group, cohort & distribution list changes'),
      icon: 'users',
    },
    {
      value: 'Role Change Access',
      label: __('Role & Course Changes'),
      categoryValue: 'Service Request',
      desc: __('Module switch, role upgrade or student status changes'),
      icon: 'id-card',
    },
  ],
}

// Campus tiles
const campusTiles = [
  {
    value: 'FSB Sheffield',
    label: __('FSB Sheffield'),
    location: __('South Yorkshire'),
    desc: __('Sheffield Campus & Study Centre'),
  },
  {
    value: 'FSB Leicester',
    label: __('FSB Leicester'),
    location: __('East Midlands'),
    desc: __('Leicester Main Campus'),
  },
  {
    value: 'FSB Croydon',
    label: __('FSB Croydon'),
    location: __('Greater London'),
    desc: __('Croydon London Centre'),
  },
  {
    value: 'FSB Digbeth',
    label: __('FSB Digbeth'),
    location: 'Birmingham',
    desc: __('Digbeth Campus & Creative Quarter'),
  },
  {
    value: 'UKBC Leicester',
    label: __('UKBC Leicester'),
    location: 'Leicester',
    desc: __('UKBC College Campus'),
  },
  {
    value: 'FSB MEMO House',
    label: __('FSB MEMO House'),
    location: 'London',
    desc: __('MEMO House London Centre'),
  },
]

// Handlers for step selections with micro-animation and auto-advance
const selectCategory = (card: (typeof categoryCards)[number]) => {
  wizardData.value.categoryKey = card.key
  wizardData.value.category = card.categoryValue
  // Reset downstream selections if category changed
  wizardData.value.subCategory = ''

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

  if (advanceTimeout) clearTimeout(advanceTimeout)
  advanceTimeout = setTimeout(() => {
    goToStep(3)
  }, 220)
}

const selectCampus = (campusValue: string) => {
  wizardData.value.campus = campusValue

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

// Category display name
const currentCategoryLabel = computed(() => {
  const card = categoryCards.find((c) => c.key === wizardData.value.categoryKey)
  return card ? card.label : wizardData.value.category || 'Category'
})
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

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
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
            <div class="text-center max-w-lg mx-auto">
              <!-- Active Category pill -->
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200/80 mb-2">
                <span>{{ currentCategoryLabel }}</span>
              </span>
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('What specific issue are you having?') }}
              </h2>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {{ $t('Tap the option that best describes your request to continue.') }}
              </p>
            </div>

            <!-- Sub-Category Grid -->
            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-2">
              <button
                v-for="sub in subCategoryMap[wizardData.categoryKey || 'it']"
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
          </div>

          <!-- STEP 3: CAMPUS SELECTION -->
          <div v-else-if="currentStep === 3" key="step-3" class="space-y-6">
            <div class="text-center max-w-lg mx-auto">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800 border border-emerald-200/80 mb-2">
                <span>{{ wizardData.subCategory || currentCategoryLabel }}</span>
              </span>
              <h2
                ref="stepHeadingRef"
                tabindex="-1"
                class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight outline-none"
              >
                {{ $t('Which campus do you study at?') }}
              </h2>
              <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">
                {{ $t('Select your campus so your ticket is routed directly to local on-site support.') }}
              </p>
            </div>

            <!-- Campus Tiles Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              <button
                v-for="campus in campusTiles"
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

                <!-- Campus Pin Icon -->
                <div
                  class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
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
          </div>

          <!-- STEP 4: DETAILS & SUBMIT -->
          <div v-else-if="currentStep === 4" key="step-4" class="space-y-6">
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
                <label for="wizard-ticket-title" class="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                  {{ $t('Subject / Short Title') }}
                  <span class="text-rose-500">*</span>
                </label>
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
                  :placeholder="$t('e.g. Cannot connect to Cisco AnyConnect VPN from home...')"
                  @blur="titleTouched = true"
                />
                <p v-if="titleError" class="mt-1 text-xs font-semibold text-rose-600">
                  {{ titleError }}
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
                  :placeholder="$t('Please provide as much detail as possible: what you were trying to do, exact error messages, device type (Windows/Mac/iOS/Android), and any troubleshooting steps already attempted...')"
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
                class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 transition-all select-none"
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
