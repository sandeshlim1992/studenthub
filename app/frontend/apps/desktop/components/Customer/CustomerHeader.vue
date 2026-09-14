<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonPopoverMenu from '#desktop/components/CommonPopoverMenu/CommonPopoverMenu.vue'
import { avatarMenuItems } from '#desktop/components/layout/LayoutSidebar/LeftSidebar/AvatarMenu/plugins/index.ts'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useSessionStore } from '#shared/stores/session.ts'

const router = useRouter()
const session = useSessionStore()
const user = computed(() => session.user)

const userDisplayName = computed(() => {
  if (user.value?.firstname && user.value?.lastname) {
    return `${user.value.firstname} ${user.value.lastname}`
  }
  return user.value?.firstname || user.value?.login || 'Student'
})

const userInitial = computed(() => {
  const name = userDisplayName.value
  return name.charAt(0).toUpperCase()
})

const userMenuPopover = useTemplateRef<InstanceType<typeof CommonPopover>>('userMenuPopover')
const userMenuPopoverTarget = useTemplateRef<HTMLElement>('userMenuPopoverTarget')
const { toggle: toggleUserMenu, isOpen: isUserMenuOpen } = usePopover(userMenuPopover)
</script>

<template>
  <header
    class="sticky top-0 z-40 flex h-20 w-full items-center justify-between bg-[#1e3a5f] px-5 shadow-md sm:px-8 shrink-0 border-b border-[#2d4f7c]/60 transition-colors"
  >
    <!-- Left: Original Brand Logo with Clean White Background Container & Bigger Typography -->
    <div
      class="flex items-center gap-4 cursor-pointer group transition-all duration-200"
      role="button"
      tabindex="0"
      :aria-label="$t('Student Hub Home')"
      @click="router.push('/')"
      @keydown.enter="router.push('/')"
    >
      <!-- Logo in Crisp White Container (Zero Shady Look, Vibrant & Crisp) -->
      <div
        class="h-12 w-12 sm:h-13 sm:w-13 rounded-2xl bg-white p-2 shadow-md ring-2 ring-white/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <img
          src="/assets/images/branding/student_hub_logo.png"
          alt="Student Hub"
          class="h-full w-full object-contain"
        />
      </div>

      <!-- Brand Typography & Institution Badge (Enlarged) -->
      <div class="flex flex-col">
        <div class="flex items-center gap-2.5">
          <span class="text-lg sm:text-xl font-black text-white tracking-tight leading-none group-hover:text-sky-200 transition-colors">
            Student Hub
          </span>
          <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-xs">
            Support
          </span>
        </div>
        <span class="text-xs font-semibold text-[#93b5d4] tracking-wider mt-1 uppercase">
          LSST · FSB · UKBC
        </span>
      </div>
    </div>

    <!-- Right: User Avatar Circle + Name with Interactive Profile Dropdown (Enlarged) -->
    <div class="relative flex items-center">
      <CommonPopover
        id="customer-user-menu-popover"
        ref="userMenuPopover"
        :owner="userMenuPopoverTarget"
        z-index="60"
        orientation="autoVertical"
        placement="arrowEnd"
      >
        <CommonPopoverMenu
          :popover="userMenuPopover"
          :header-label="user?.fullname || userDisplayName"
          :items="avatarMenuItems"
        />
      </CommonPopover>

      <button
        id="customer-user-menu"
        ref="userMenuPopoverTarget"
        type="button"
        class="flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-2 transition-all duration-200 hover:bg-[#162d4a] focus:outline-none focus:ring-2 focus:ring-[#93b5d4] border border-transparent hover:border-[#2d4f7c] shadow-xs active:scale-98"
        :class="{ 'bg-[#162d4a] border-[#2d4f7c]': isUserMenuOpen }"
        :aria-label="user?.fullname || user?.email || $t('User menu')"
        aria-controls="customer-user-menu-popover"
        :aria-expanded="isUserMenuOpen"
        @click="toggleUserMenu(true)"
      >
        <CommonUserAvatar
          v-if="user"
          aria-hidden="true"
          :entity="user"
          size="medium"
          personal
          class="ring-2 ring-white/30 rounded-full"
        />
        <div
          v-else
          class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2d4f7c] bg-[#162d4a] text-sm font-extrabold uppercase text-white shadow-xs"
        >
          <span>{{ userInitial }}</span>
        </div>
        <span class="hidden text-base font-bold text-white sm:inline-block tracking-tight">
          {{ userDisplayName }}
        </span>
        <svg
          class="h-5 w-5 text-[#93b5d4] transition-transform duration-200"
          :class="{ 'rotate-180 text-white': isUserMenuOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  </header>
</template>
