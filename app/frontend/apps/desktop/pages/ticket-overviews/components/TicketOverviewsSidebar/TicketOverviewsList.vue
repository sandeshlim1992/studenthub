<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import NavigationMenuList from '#desktop/components/NavigationMenu/NavigationMenuList.vue'
import type { NavigationMenuEntry } from '#desktop/components/NavigationMenu/types.ts'
import {
  type StudenthubTicketViewSection,
  useStudenthubTicketViews,
} from '#desktop/entities/ticket/composables/useStudenthubTicketViews.ts'
import { useTicketOverviews } from '#desktop/pages/ticket-overviews/composables/useTicketOverviews.ts'

// Student Hub: the list can show one group of the views panel (see TicketOverviewsSidebar).
interface Props {
  section?: StudenthubTicketViewSection
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  section: 'mine',
  label: __('Overview navigation list'),
})

const { overviewsTicketCountById } = useTicketOverviews()
const { overviewsBySection } = useStudenthubTicketViews()

const overviewsItems = computed((): NavigationMenuEntry[] =>
  overviewsBySection.value[props.section].map((item) => ({
    label: item.name,
    id: item.id,
    route: item.link,
    count: overviewsTicketCountById.value[item.id],
  })),
)
</script>

<template>
  <NavigationMenuList
    v-if="overviewsItems.length"
    :aria-label="$t(label)"
    count-variant="info"
    count-size="xs"
    :items="overviewsItems"
  />
</template>
