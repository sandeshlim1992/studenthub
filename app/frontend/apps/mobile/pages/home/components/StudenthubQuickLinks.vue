<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useApplicationStore } from '#shared/stores/application.ts'
import {
  readStudenthubQuickLinks,
  studenthubQuickLinkSite,
} from '#shared/utils/studenthubQuickLinks.ts'

// Student Hub: links to other websites on Home, set by admins under Administration → Manage →
// Mobile app. Each opens in a new tab and shows the site it leads to.

const application = useApplicationStore()

const links = computed(() =>
  readStudenthubQuickLinks(application.config.studenthub_mobile_quick_links).map((link) => ({
    ...link,
    site: studenthubQuickLinkSite(link.url),
  })),
)
</script>

<template>
  <section v-if="links.length" aria-labelledby="studenthub-quick-links" class="flex flex-col gap-2">
    <h2 id="studenthub-quick-links" class="text-lg font-extrabold">{{ $t('Quick links') }}</h2>
    <ul class="grid grid-cols-2 gap-2.5">
      <li v-for="(link, index) in links" :key="index">
        <CommonLink
          :link="link.url"
          external
          open-in-new-tab
          rel="noopener noreferrer"
          class="flex h-full min-h-20 flex-col justify-between gap-2 rounded-2xl bg-gray-500 p-3.5"
        >
          <span class="text-base leading-snug font-semibold break-words">{{ link.label }}</span>
          <span class="flex items-center gap-1 text-xs text-gray">
            <CommonIcon name="external-link" size="xs" decorative />
            <span class="truncate">{{ link.site }}</span>
          </span>
        </CommonLink>
      </li>
    </ul>
  </section>
</template>
