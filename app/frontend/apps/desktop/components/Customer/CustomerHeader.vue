<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useSessionStore } from '#shared/stores/session.ts'
import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'

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

const onProfileSettings = () => {
  userMenuPopover.value?.closePopover()
  router.push('/personal-setting')
}

const onSignOut = () => {
  userMenuPopover.value?.closePopover()
  router.push('/logout')
}
</script>

<template>
  <header
    class="sticky top-0 z-40 flex h-16 sm:h-20 w-full items-center justify-between bg-[#0c141d]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 shrink-0 border-b border-white/[0.08] transition-colors"
  >
    <!-- Left: Original Brand Logo with Refined Rounded Container & Vibrant Typography -->
    <div
      class="flex items-center gap-3 sm:gap-3.5 cursor-pointer group transition-all duration-200 select-none"
      role="button"
      tabindex="0"
      :aria-label="$t('Student Hub Home')"
      @click="router.push('/')"
      @keydown.enter="router.push('/')"
    >
      <!-- Logo Container with Smooth Geometry & Emerald Hover Ring -->
      <div
        class="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white p-1.5 sm:p-2 shadow-sm ring-1 ring-white/30 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:ring-emerald-400/50"
      >
        <img
          :src="studentHubLogo"
          alt="Student Hub"
          class="h-full w-full object-contain"
        />
      </div>

      <!-- Brand Typography & Institution Badge -->
      <div class="flex flex-col">
        <div class="flex items-center gap-2 sm:gap-2.5">
          <span class="text-base sm:text-xl font-extrabold text-white tracking-tight leading-none group-hover:text-emerald-300 transition-colors">
            Student Hub
          </span>
          <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs">
            Support
          </span>
        </div>
        <span class="text-[10px] sm:text-[11px] font-medium text-slate-400 tracking-wider mt-0.5 sm:mt-1 uppercase">
          LSST · FSB · UKBC
        </span>
      </div>
    </div>

    <!-- Right: User Avatar Circle + Name with Interactive Profile Dropdown -->
    <div class="relative flex items-center">
      <CommonPopover
        id="customer-user-menu-popover"
        ref="userMenuPopover"
        :owner="userMenuPopoverTarget"
        z-index="60"
        orientation="autoVertical"
        placement="end"
        :hide-arrow="true"
        no-full-width
      >
        <div class="customer-menu-card w-60 sm:w-64 bg-white rounded-2xl p-2 shadow-2xl border border-slate-100 flex flex-col gap-1 select-none">
          <!-- User Info Header -->
          <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/90 border border-slate-100">
            <CommonUserAvatar
              v-if="user"
              aria-hidden="true"
              :entity="user"
              size="small"
              personal
              class="rounded-full shrink-0 ring-2 ring-emerald-500/60"
            />
            <div
              v-else
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-950/70 text-xs font-bold text-emerald-300"
            >
              {{ userInitial }}
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {{ userDisplayName }}
              </span>
              <span class="text-[11px] font-medium text-slate-500 truncate">
                {{ user?.email || $t('Student Portal') }}
              </span>
            </div>
          </div>

          <div class="h-px bg-slate-100 my-1 mx-1" />

          <!-- Profile Settings Link -->
          <div
            class="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-700 hover:bg-emerald-50/80 transition-colors duration-150 cursor-pointer group"
            role="menuitem"
            tabindex="0"
            @click="onProfileSettings"
            @keydown.enter="onProfileSettings"
          >
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-100/60 group-hover:text-emerald-700 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span class="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">
                {{ $t('Profile settings') }}
              </span>
            </div>
            <svg class="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          <div class="h-px bg-slate-100 my-1 mx-1" />

          <!-- Sign Out Link -->
          <div
            class="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-700 hover:bg-rose-50/80 transition-colors duration-150 cursor-pointer group"
            role="menuitem"
            tabindex="0"
            @click="onSignOut"
            @keydown.enter="onSignOut"
          >
            <div class="flex items-center gap-2.5">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-rose-100/60 group-hover:text-rose-600 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span class="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-rose-600 transition-colors">
                {{ $t('Sign out') }}
              </span>
            </div>
            <svg class="h-3.5 w-3.5 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </CommonPopover>

      <button
        id="customer-user-menu"
        ref="userMenuPopoverTarget"
        type="button"
        class="flex cursor-pointer items-center gap-2 sm:gap-2.5 rounded-full p-1 sm:pl-1.5 sm:pr-3.5 sm:py-1.5 transition-all duration-200 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 border border-white/10 hover:border-white/20 shadow-xs active:scale-98"
        :class="{ 'bg-white/[0.12] border-white/25 shadow-sm': isUserMenuOpen }"
        :aria-label="user?.fullname || user?.email || $t('User menu')"
        aria-controls="customer-user-menu-popover"
        :aria-expanded="isUserMenuOpen"
        @click="toggleUserMenu(true)"
      >
        <CommonUserAvatar
          v-if="user"
          aria-hidden="true"
          :entity="user"
          size="small"
          personal
          class="rounded-full shadow-xs ring-2 ring-emerald-500/70"
        />
        <div
          v-else
          class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-950/70 text-xs font-extrabold uppercase text-emerald-300 shadow-xs"
        >
          <span>{{ userInitial }}</span>
        </div>
        <span class="hidden text-xs sm:text-sm font-semibold text-slate-100 sm:inline-block tracking-tight">
          {{ userDisplayName }}
        </span>
        <svg
          class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 transition-transform duration-200 shrink-0"
          :class="{ 'rotate-180 text-emerald-400': isUserMenuOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style>
#customer-user-menu-popover {
  border-radius: 1.25rem !important;
  box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08) !important;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  overflow: hidden !important;
}

#customer-user-menu-popover > div {
  overflow: hidden !important;
  max-width: 100% !important;
}
</style>
