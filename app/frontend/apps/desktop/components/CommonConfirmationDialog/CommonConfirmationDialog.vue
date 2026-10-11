<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { i18n } from '#shared/i18n.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonDialog from '#desktop/components/CommonDialog/CommonDialog.vue'
import { closeDialog } from '#desktop/components/CommonDialog/useDialog.ts'

import type { ConfirmationVariantOptions } from './types.ts'

const { confirmationOptions } = useConfirmation()

interface Props {
  uniqueId: string
}

const props = defineProps<Props>()

const dialogName = `confirmation:${props.uniqueId}`

const currentConfirmationOptions = computed(() => {
  return confirmationOptions.value?.get(props.uniqueId)
})

const handleConfirmation = (isCancel?: boolean) => {
  if (isCancel) {
    currentConfirmationOptions.value?.cancelCallback()
  } else if (isCancel === false) {
    currentConfirmationOptions.value?.confirmCallback()
  } else {
    currentConfirmationOptions.value?.closeCallback()
  }

  confirmationOptions.value.delete(props.uniqueId)
}

const confirmationVariant = computed<ConfirmationVariantOptions>(() => {
  switch (currentConfirmationOptions.value?.confirmationVariant) {
    case 'delete':
      return {
        headerTitle: __('Delete object'),
        headerIcon: 'trash3',
        content: __('Are you sure you want to delete this object?'),
        footerActionOptions: {
          actionLabel: currentConfirmationOptions.value?.buttonLabel || __('Delete object'),
          actionButton: {
            variant: 'danger',
          },
        },
      }
    case 'unsaved':
      return {
        headerTitle: __('Unsaved changes'),
        headerIcon: 'exclamation-triangle',
        content: __("You have changes that aren't saved. If you leave now, they'll be lost."),
        footerActionOptions: {
          actionLabel: __('Discard changes'),
          actionButton: {
            variant: 'danger',
          },
          cancelLabel: __('Keep editing'),
        },
      }
    default:
      return {
        headerTitle: __('Confirmation'),
        headerIcon: 'question-circle',
        content: __('Do you want to continue?'),
        footerActionOptions: {
          actionLabel: currentConfirmationOptions.value?.buttonLabel || __('Yes'),
          actionButton: {
            variant: currentConfirmationOptions.value?.buttonVariant || 'primary',
          },
          cancelLabel: currentConfirmationOptions.value?.cancelLabel,
          hideCancelButton: currentConfirmationOptions.value?.hideCancelButton,
        },
      }
  }
})

const headerTitle = computed(() => {
  if (currentConfirmationOptions.value?.headerTitle) {
    return i18n.t(
      currentConfirmationOptions.value?.headerTitle,
      ...(currentConfirmationOptions.value?.headerTitlePlaceholder || []),
    )
  }

  return confirmationVariant.value.headerTitle
})

// Student Hub: an icon badge beside the title, in a tone that says what the answer risks: amber
// for losing unsaved work, red for deleting or removing, the application colour otherwise.
const headerIcon = computed(
  () => currentConfirmationOptions.value?.headerIcon || confirmationVariant.value.headerIcon,
)

const footer = computed(() => confirmationVariant.value.footerActionOptions)

const actionVariant = computed(() => footer.value.actionButton?.variant || 'primary')

const cancelLabel = computed(() => footer.value.cancelLabel || __('Cancel & go back'))

const actionLabel = computed(() => footer.value.actionLabel || __('OK'))

const tone = computed(() => {
  if (currentConfirmationOptions.value?.confirmationVariant === 'unsaved') return 'warning'
  if (actionVariant.value === 'danger' || actionVariant.value === 'remove') return 'danger'

  return 'info'
})

// The footer is our own (for its band and button styles), so it closes the dialog like
// CommonDialog's own footer does.
const close = async (isCancel: boolean) => {
  handleConfirmation(isCancel)
  await closeDialog(dialogName, true)
}
</script>

<template>
  <CommonDialog
    :name="dialogName"
    :header-title="headerTitle"
    :fullscreen="currentConfirmationOptions?.fullscreen ?? false"
    class="sh-confirm__body"
    global
    @close="handleConfirmation"
  >
    <template #header>
      <div class="sh-confirm__head">
        <span class="sh-confirm__badge" :class="`sh-confirm__badge--${tone}`">
          <CommonIcon v-if="headerIcon" :name="headerIcon" size="small" decorative />
        </span>
        <h3 :id="`dialog-${dialogName}-title`" class="sh-confirm__title">
          {{ $t(headerTitle) }}
        </h3>
      </div>
    </template>

    <p class="sh-confirm__text">
      {{
        $t(
          currentConfirmationOptions?.text || confirmationVariant.content,
          ...(currentConfirmationOptions?.textPlaceholder || []),
        )
      }}
    </p>

    <template #footer>
      <div class="sh-confirm__footer">
        <CommonButton
          v-if="!footer.hideCancelButton"
          class="sh-confirm__cancel"
          size="large"
          variant="secondary"
          @click="close(true)"
        >
          {{ $t(cancelLabel) }}
        </CommonButton>
        <CommonButton
          class="sh-confirm__action"
          size="large"
          :variant="actionVariant"
          @click="close(false)"
        >
          {{ $t(actionLabel) }}
        </CommonButton>
      </div>
    </template>
  </CommonDialog>
</template>
