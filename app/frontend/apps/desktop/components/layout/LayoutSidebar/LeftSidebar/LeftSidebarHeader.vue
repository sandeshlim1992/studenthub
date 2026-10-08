<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useRouter } from 'vue-router'

import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import { useStudenthubRoleLabel } from '#desktop/composables/useStudenthubRoleLabel.ts'

// Student Hub: brand area of the navigation panel, with the user's role under the name. Search,
// notifications and the avatar menu live in the top bar (StudenthubTopBar); collapsing uses
// Zammad's button in the footer.

interface Props {
  collapsed?: boolean
}

defineProps<Props>()

const router = useRouter()
const { toggleSidebar } = useSidebarDisplay(SidebarName.Primary)
const roleLabel = useStudenthubRoleLabel()
</script>

<template>
  <header class="flex select-none">
    <button
      v-if="!collapsed"
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      :aria-label="$t('Go to start page')"
      @click="router.push('/')"
    >
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
        <img :src="studentHubLogo" alt="" class="h-full w-full object-contain" />
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-base leading-tight font-bold tracking-tight text-white">Student Hub</span>
        <span
          v-if="roleLabel"
          class="mt-0.5 text-[10px] leading-none font-semibold tracking-widest text-white/70 uppercase"
          data-test-id="studenthub-role"
        >
          {{ $t(roleLabel) }}
        </span>
      </span>
    </button>

    <button
      v-else
      v-tooltip="$t('Expand sidebar')"
      type="button"
      class="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      :aria-label="$t('Expand sidebar')"
      @click="toggleSidebar()"
    >
      <img :src="studentHubLogo" alt="" class="h-full w-full object-contain" />
    </button>
  </header>
</template>
