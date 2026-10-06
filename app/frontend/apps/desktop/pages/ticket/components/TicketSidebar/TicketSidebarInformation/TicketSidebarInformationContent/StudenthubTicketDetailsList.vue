<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toValue } from 'vue'

import { useForm } from '#shared/components/Form/useForm.ts'
import { i18n } from '#shared/i18n.ts'

import StudenthubCampusBadge from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubCampusBadge.vue'
import { useStudenthubNow } from '#desktop/components/Ticket/StudenthubTicketCells/useStudenthubNow.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import { articleTypeLabel, formatDayTime } from '#desktop/utils/studenthubTicketDetails.ts'

import type { FormKitNode } from '@formkit/core'

// Student Hub: the ticket's fields as a read-only list (Halo mockup). It reads Zammad's ticket
// form, which stays mounted but hidden: so it shows exactly the fields the form shows (core
// workflows included, plus every field admins add), unsaved changes included.

interface Option {
  value: unknown
  label?: string
  children?: Option[]
}

interface Row {
  key: string
  /** Already translated. */
  label: string
  value: string
  /** Mandatory but (partly) empty: Update is refused until it is filled in. */
  missing?: boolean
  unsaved?: boolean
}

const { ticket, form } = useTicketInformation()
const { values } = useForm(form)
const now = useStudenthubNow()

// Shown next to the title instead; title is edited in the header.
const SKIPPED_FIELDS = new Set(['state_id', 'priority_id', 'title'])
const FIELD_LABELS: Record<string, string> = { group_id: __('Team'), owner_id: __('Agent') }
// Student Hub's category pair, shown as one row: "Category › Sub-category".
const CATEGORY_FIELD = 'category2'
const SUB_CATEGORY_FIELD = 'subcategory'

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

const findOptionPath = (options: Option[], value: unknown, path: string[] = []): string[] | null => {
  for (const option of options) {
    const label = option.label ?? String(option.value)
    // Ids come back as numbers or strings.
    if (String(option.value) === String(value)) return [...path, label]
    const inChild = option.children?.length
      ? findOptionPath(option.children, value, [...path, label])
      : null
    if (inChild) return inChild
  }
  return null
}

const displayValue = (node: FormKitNode, value: unknown): string => {
  if (isEmpty(value)) return ''
  if (Array.isArray(value)) return value.map((item) => displayValue(node, item)).join(', ')

  // The context is reactive, the props are not.
  const options = (node.context?.options ?? node.props.options) as Option[] | undefined
  if (Array.isArray(options) && options.length) {
    const path = findOptionPath(options, value)
    if (path) {
      const translate = !node.props.noOptionsLabelTranslation
      return path.map((label) => (translate ? i18n.t(label) : label)).join(' › ')
    }
  }

  if (typeof value === 'boolean') return value ? i18n.t('yes') : i18n.t('no')
  if (typeof value === 'object' && value && 'label' in value) return String(value.label)

  const type = node.props.type as string | undefined
  if (type === 'date') return i18n.date(String(value))
  if (type === 'datetime') return i18n.dateTime(String(value))

  return String(value).replaceAll('::', ' › ')
}

const isRequired = (node: FormKitNode) =>
  ((node.props.parsedRules ?? []) as { name: string }[]).some((rule) => rule.name === 'required')

const fieldNodes = computed<FormKitNode[]>(() => {
  if (!form?.value?.formInitialSettled) return []
  // Recompute when values change (core workflows add and remove fields as values change).
  void values.value

  const group = form.value.findNodeByName('ticket')
  return (group?.children ?? []).filter(
    (child): child is FormKitNode =>
      'props' in child && child.props.type !== 'hidden' && !SKIPPED_FIELDS.has(child.name),
  )
})

const nodeRow = (node: FormKitNode): Row => {
  const value = displayValue(node, node.context?.value ?? node.value)

  return {
    key: node.name,
    // Zammad's translateWrapperProps turns the label into a ref with the translated text.
    label: FIELD_LABELS[node.name]
      ? i18n.t(FIELD_LABELS[node.name])
      : String(toValue(node.props.label) ?? node.name),
    value,
    missing: !value && isRequired(node),
    unsaved: !!node.context?.state.dirty,
  }
}

const fieldRows = computed<Row[]>(() => {
  const rows = fieldNodes.value.map(nodeRow)
  const byName = new Map(rows.map((row) => [row.key, row]))

  const category = byName.get(CATEGORY_FIELD)
  const subCategory = byName.get(SUB_CATEGORY_FIELD)
  if (category && subCategory) {
    category.value = [category.value, subCategory.value].filter(Boolean).join(' › ')
    category.missing = category.missing || subCategory.missing
    category.unsaved = category.unsaved || subCategory.unsaved
    return rows.filter((row) => row !== subCategory)
  }

  return rows
})

// Team, Agent and Category first, as in the mockup; the other fields in the form's order.
const LEADING_FIELDS = ['group_id', 'owner_id', CATEGORY_FIELD]

const rows = computed<Row[]>(() => {
  const leading = LEADING_FIELDS.flatMap((name) => fieldRows.value.filter((row) => row.key === name))
  const others = fieldRows.value.filter((row) => !LEADING_FIELDS.includes(row.key))

  const source = articleTypeLabel(ticket.value?.createArticleType?.name)

  return [
    { key: 'customer', label: i18n.t('User'), value: ticket.value?.customer.fullname ?? '' },
    ...(ticket.value?.customer.email
      ? [{ key: 'email', label: i18n.t('Email'), value: ticket.value.customer.email }]
      : []),
    ...leading,
    ...others,
    ...(source ? [{ key: 'source', label: i18n.t('Source'), value: i18n.t(source) }] : []),
    {
      key: 'opened',
      label: i18n.t('Opened'),
      value: formatDayTime(ticket.value?.createdAt, now.value),
    },
  ]
})

const campus = computed(
  () =>
    ticket.value?.objectAttributeValues?.find((entry) => entry.attribute.name === 'campus')
      ?.value,
)
</script>

<template>
  <dl v-if="ticket" class="sh-details-list" data-test-id="studenthub-ticket-details">
    <template v-for="row in rows" :key="row.key">
      <dt>{{ row.label }}</dt>
      <dd :data-field="row.key">
        <template v-if="row.key === 'customer'">
          <StudenthubCampusBadge v-if="campus" compact class="me-1.5 align-middle" :value="campus" />
          <span class="align-middle">{{ row.value }}</span>
        </template>
        <template v-else-if="row.value">{{ row.value }}</template>
        <span v-else-if="!row.missing" class="sh-details-list__empty">-</span>
        <span v-if="row.missing" class="sh-details-list__missing">{{ $t('Required') }}</span>
        <span
          v-if="row.unsaved"
          v-tooltip="$t('Not saved yet. Press Update to save.')"
          class="sh-details-list__unsaved"
          role="img"
          :aria-label="$t('Not saved yet')"
        />
      </dd>
    </template>
  </dl>
</template>
