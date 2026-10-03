<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { isEqual } from 'lodash-es'
import { computed, markRaw, nextTick, provide, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { EXTENSION_NAME as TEXT_TOOL_EXTENSION_NAME } from '#shared/components/Form/fields/FieldEditor/extensions/AiAssistantTextTools.ts'
import type { FieldFileContext } from '#shared/components/Form/fields/FieldFile/types.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaField, FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { getNodeByName } from '#shared/components/Form/utils.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { useTicketCreate } from '#shared/entities/ticket/composables/useTicketCreate.ts'
import { useTicketCreateArticleType } from '#shared/entities/ticket/composables/useTicketCreateArticleType.ts'
import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { useTicketFormOrganizationHandler } from '#shared/entities/ticket/composables/useTicketFormOrganizationHandler.ts'
import { useTicketSignature } from '#shared/entities/ticket/composables/useTicketSignature.ts'
import { TicketCreateArticleType, type TicketFormData } from '#shared/entities/ticket/types.ts'
import { defineFormSchema } from '#shared/form/defineFormSchema.ts'
import {
  EnumFormUpdaterId,
  EnumObjectManagerObjects,
  type TicketAttributesFragment,
  type User,
  type UserAddMutation,
} from '#shared/graphql/types.ts'
import { useWalker } from '#shared/router/walker.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonContentPanel from '#desktop/components/CommonContentPanel/CommonContentPanel.vue'
import { useFieldCustomerOption } from '#desktop/components/Form/fields/FieldCustomer/useFieldCustomerOption.ts'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { usePage } from '#desktop/composables/usePage.ts'
import { useTicketCreateTitle } from '#desktop/entities/ticket/composables/useTicketCreateTitle.ts'
import { useUserCreate } from '#desktop/entities/user/composables/useUserCreate.ts'
import { useTaskbarTab } from '#desktop/entities/user/current/composables/useTaskbarTab.ts'
import { useTaskbarTabStateUpdates } from '#desktop/entities/user/current/composables/useTaskbarTabStateUpdates.ts'
import type { TaskbarTabContext } from '#desktop/entities/user/current/types.ts'

import { useProvideTicketSidebar, useTicketSidebar } from '../../composables/useTicketSidebar.ts'
import { TicketSidebarScreenType, type TicketSidebarContext } from '../../types/sidebar.ts'
import TicketSidebar from '../TicketSidebar.vue'

import AgentTicketCreateCard from './AgentTicketCreateCard.vue'
import ApplyTemplate from './ApplyTemplate.vue'
import CustomerTicketCreateCard from './CustomerTicketCreateCard.vue'
import CustomerTicketCreateWizard, {
  type CategoryKey,
  type WizardData,
} from './CustomerTicketCreateWizard.vue'
import TicketDuplicateDetectionAlert from './TicketDuplicateDetectionAlert.vue'

interface Props {
  tabId?: string
}

defineProps<Props>()

const router = useRouter()
const walker = useWalker()
const route = useRoute()

const { form, isDisabled, isDirty, isInitialSettled, formNodeId, values, triggerFormUpdater } =
  useForm()

const tabContext = computed<TaskbarTabContext>((currentContext) => {
  if (!isInitialSettled.value) return {}

  const newContext = {
    formValues: values.value,
    formIsDirty: isDirty.value,
  }

  if (currentContext && isEqual(newContext, currentContext)) return currentContext

  return newContext
})

const { currentTaskbarTab, currentTaskbarTabId, currentTaskbarTabFormId, currentTaskbarTabDelete } =
  useTaskbarTab(tabContext)

useTaskbarTabStateUpdates(currentTaskbarTabId, form, triggerFormUpdater)

const currentTitle = computed(() => values.value.title as string)
const currentArticleType = computed(() => values.value.articleSenderType as string)

const { currentViewTitle } = useTicketCreateTitle(currentTitle, currentArticleType)

usePage({
  metaTitle: currentViewTitle,
})

const application = useApplicationStore()
const session = useSessionStore()

const { ticketArticleSenderTypeField, defaultTicketCreateArticleType } = useTicketCreateArticleType()
const { isTicketCustomer } = useTicketCreateView()

const isWizardMode = ref(route.query.mode === 'form' ? false : isTicketCustomer.value)
const createdTicketInfo = ref<{ id: number; number: string } | null>(null)
const isSubmittingWizard = ref(false)

watch(
  () => route.query.mode,
  (mode) => {
    if (mode === 'form') {
      isWizardMode.value = false
    } else if (mode === 'wizard') {
      isWizardMode.value = true
    }
  },
)

const redirectAfterCreate = (
  internalId?: number,
  ticket?: TicketAttributesFragment | null,
) => {
  if (isWizardMode.value && (ticket || internalId)) {
    createdTicketInfo.value = {
      id: internalId || ticket?.internalId || 0,
      number: ticket?.number || String(internalId || ''),
    }
    isSubmittingWizard.value = false
    return
  }

  if (internalId) {
    router.replace(`/tickets/${internalId}`)
    return
  }

  // Fallback redirect, in case the user has no access to the ticket they just created.
  router.replace('/')
}

const goBack = () => {
  walker.back('/')
}

const { createTicket } = useTicketCreate(form, redirectAfterCreate)

const submitCreateTicket = async (event: FormSubmitData<TicketFormData>) => {
  return createTicket(event)
    .then((result) => {
      isSubmittingWizard.value = false
      if (!result || result === null || result === undefined) return
      if (typeof result === 'function') result()

      if (!isWizardMode.value) {
        currentTaskbarTabDelete()
      }
    })
    .catch((err) => {
      console.error('Failed to create ticket:', err)
      isSubmittingWizard.value = false
    })
}

const wizardInitialValues = computed<Partial<WizardData>>(() => {
  const formValues = values.value as Record<string, unknown>
  let catKey: CategoryKey =
    (route.query.category as CategoryKey) || ''

  let rawCat =
    (route.query.categoryValue as string) ||
    (formValues?.category2 as string) ||
    (formValues?.category as string) ||
    ''

  // Map any legacy or shorthand keys to real categories
  if (catKey === 'it' || catKey === 'software') {
    catKey = 'software'
    if (!rawCat) rawCat = 'Software'
  } else if (catKey === 'account' || catKey === 'service_request') {
    catKey = 'service_request'
    if (!rawCat) rawCat = 'Service Request'
  } else if (catKey === 'general') {
    catKey = 'service_request'
    if (!rawCat) rawCat = 'Service Request'
  } else if (catKey === 'hardware') {
    catKey = 'hardware'
    if (!rawCat) rawCat = 'Hardware'
  }

  if (!catKey && rawCat) {
    if (rawCat === 'Software') {
      catKey = 'software'
    } else if (rawCat === 'Hardware') {
      catKey = 'hardware'
    } else if (rawCat === 'Service Request') {
      catKey = 'service_request'
    } else {
      catKey = rawCat.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    }
  }

  let catName = rawCat
  if (!catName && catKey) {
    if (catKey === 'service_request') catName = 'Service Request'
    else if (catKey === 'software') catName = 'Software'
    else if (catKey === 'hardware') catName = 'Hardware'
    else catName = catKey
  }

  return {
    categoryKey: catKey,
    category: catName,
    subCategory:
      (formValues?.subcategory as string) ||
      (formValues?.sub_category as string) ||
      '',
    campus: (formValues?.campus as string) || '',
    title: (formValues?.title as string) || '',
    body:
      typeof formValues?.body === 'string'
        ? formValues.body.replace(/<[^>]*>?/gm, '').trim()
        : '',
  }
})

const switchToFullForm = () => {
  isWizardMode.value = false
}

const switchToWizard = () => {
  isWizardMode.value = true
}

provide('switchToWizard', switchToWizard)

const handleWizardSubmit = async (data: WizardData) => {
  isSubmittingWizard.value = true
  try {
    const formId = form.value?.formId

    // 1. Format body with category, subcategory and campus context
    const categoryName =
      data.category ||
      (data.categoryKey === 'service_request'
        ? 'Service Request'
        : data.categoryKey === 'software'
          ? 'Software'
          : data.categoryKey === 'hardware'
            ? 'Hardware'
            : (data.categoryKey || ''))

    const campusText = data.campus || __('Not specified')
    const subCatText = data.subCategory || __('General')

    const bodyHeader = `<p><strong>${__('Category')}:</strong> ${categoryName} &gt; ${subCatText}</p><p><strong>${__('Campus')}:</strong> ${campusText}</p><hr/>`

    const formattedParagraphs = data.body
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('')

    const fullBodyHtml = `${bodyHeader}${formattedParagraphs}`

    // Map wizard selection to official DB attribute values
    const rawCategory =
      data.category ||
      (data.categoryKey === 'service_request'
        ? 'Service Request'
        : data.categoryKey === 'software'
          ? 'Software'
          : data.categoryKey === 'hardware'
            ? 'Hardware'
            : '')

    const categoryAttributeValue = rawCategory
    const campusAttributeValue = data.campus || ''
    const subCategoryAttributeValue = data.subCategory || ''

    // 2. Set nodes if form is available for visual sync
    if (formId) {
      const titleNode = getNodeByName(formId, 'title')
      titleNode?.input(data.title)

      const bodyNode = getNodeByName(formId, 'body')
      bodyNode?.input(fullBodyHtml)

      getNodeByName(formId, 'category')?.input(categoryAttributeValue)
      getNodeByName(formId, 'category2')?.input(categoryAttributeValue)
      getNodeByName(formId, 'sub_category')?.input(subCategoryAttributeValue)
      getNodeByName(formId, 'subcategory')?.input(subCategoryAttributeValue)
      getNodeByName(formId, 'campus')?.input(campusAttributeValue)
    }

    // 3. Ensure group_id is resolved
    let groupId: string | number | undefined = (values.value as Record<string, unknown>)?.group_id as string | number
    if (!groupId && formId) {
      const groupNode = getNodeByName(formId, 'group_id')
      if (groupNode) {
        groupId = groupNode.value as string | number
        if (!groupId) {
          const options = (groupNode.context?.options as Array<{ value: unknown }>) || []
          const firstValid = options.find((opt) => opt && opt.value)
          if (firstValid) {
            groupId = firstValid.value as string | number
            groupNode.input(groupId)
          }
        }
      }
    }
    if (!groupId) {
      groupId = 1
    }

    // 4. Handle attachments if any
    let uploadedFiles: File[] | undefined
    if (data.attachments && data.attachments.length > 0 && formId) {
      const attachmentsNode = getNodeByName(formId, 'attachments')
      if (attachmentsNode?.context && 'uploadFiles' in attachmentsNode.context) {
        try {
          await (attachmentsNode.context as unknown as FieldFileContext).uploadFiles(
            data.attachments,
          )
          uploadedFiles = (attachmentsNode.value as File[]) || data.attachments
        } catch (uploadErr) {
          console.warn('Could not upload files via form node', uploadErr)
        }
      }
    }

    await nextTick()

    // 5. Ensure articleSenderType and customer_id are defined
    const senderType =
      (values.value as Record<string, unknown>)?.articleSenderType ||
      defaultTicketCreateArticleType ||
      TicketCreateArticleType.EmailOut

    const customerId =
      (values.value as Record<string, unknown>)?.customer_id ||
      session.user?.id

    // 6. Build full form submission payload
    const formPayload: FormSubmitData<TicketFormData> = {
      ...(values.value as Record<string, unknown>),
      title: data.title,
      body: fullBodyHtml,
      articleSenderType: senderType as TicketCreateArticleType,
      group_id: groupId,
      category: categoryAttributeValue,
      category2: categoryAttributeValue,
      campus: campusAttributeValue,
      sub_category: subCategoryAttributeValue,
      subcategory: subCategoryAttributeValue,
    } as unknown as FormSubmitData<TicketFormData>

    if (customerId) {
      formPayload.customer_id = customerId as string | number
    }
    if (uploadedFiles) {
      formPayload.attachments = uploadedFiles
    } else if (data.attachments && data.attachments.length > 0) {
      formPayload.attachments = data.attachments
    }

    // 7. Directly invoke submitCreateTicket to execute creation
    await submitCreateTicket(formPayload)
  } catch (err) {
    console.error('Failed to submit wizard ticket', err)
  } finally {
    if (!createdTicketInfo.value) {
      isSubmittingWizard.value = false
    }
  }
}

const handleWizardCancel = () => {
  goBack()
}

const handleViewTicket = (ticketId: number) => {
  currentTaskbarTabDelete()
  router.push(`/tickets/${ticketId}`)
}

const handleBackToDashboard = () => {
  currentTaskbarTabDelete()
  router.push('/')
}

const defaultTitle = __('New ticket')

const { openUserCreateFlyout } = useUserCreate()

// FIXME: Try to sort out this mess!
//   Instead of directly manipulating the form node, we should instead rely on a new helper from
//   `useForm()`, as proposed in https://github.com/zammad/coordination-desktop-view/issues/597.
const applyNewlyCreatedCustomer = async (data: unknown) => {
  const user = (data as UserAddMutation).userAdd?.user as User
  if (!user || !form.value?.formId) return

  const customerNode = getNodeByName(form.value.formId, 'customer_id')
  if (!customerNode) return

  const { props } = customerNode

  props.options = [...(props.options || []), useFieldCustomerOption(user)]

  await nextTick()

  customerNode.input(user.internalId, false)
}

const defaultSchema = [
  {
    if: '$existingAdditionalCreateNotes() && $getAdditionalCreateNote($values.articleSenderType) !== undefined',
    isLayout: true,
    component: 'CommonAlert',
    props: {
      variant: 'warning',
    },
    children: [
      {
        isLayout: true,
        element: 'div',
        attrs: {
          // We convert light weight markup
          // The input is not sanitized and relies on the administrator to provide safe links
          innerHTML: '$markup($t($getAdditionalCreateNote($values.articleSenderType)))',
        },
        children: '',
      },
    ],
  },
  {
    if: '$values.ticket_duplicate_detection.count > 0',
    isLayout: true,
    component: 'TicketDuplicateDetectionAlert',
    props: {
      tickets: '$values.ticket_duplicate_detection.items',
    },
    children: '',
  },
  {
    isLayout: true,
    component: 'AgentTicketCreateCard',
    children: [
      {
        if: '$isTicketCustomer === false',
        ...ticketArticleSenderTypeField,
        outerClass: 'channel-tabs-outer flex justify-center w-full mb-1',
        blockClass: 'channel-tabs-block',
        innerClass: 'channel-tabs-inner',
        inputClass: 'channel-tabs-strip',
        classes: {
          input: 'channel-tabs-strip',
          inner: 'channel-tabs-inner',
          outer: 'channel-tabs-outer',
        },
      },
      {
        isLayout: true,
        element: 'div',
        attrs: {
          class: 'grid grid-cols-1 gap-5',
        },
        children: [
          {
            screen: 'create_top',
            object: EnumObjectManagerObjects.Ticket,
          },
          // Because of the current field screen settings in the backend
          // seed we need to add this manually.
          {
            if: '$values.articleSenderType === "email-out"',
            name: 'cc',
            label: __('CC'),
            type: 'recipient',
            props: {
              multiple: true,
              clearable: true,
            },
          },
          {
            if: '$securityIntegration === true && $values.articleSenderType === "email-out"',
            name: 'security',
            label: __('Security'),
            type: 'security',
          },
          {
            name: 'body',
            screen: 'create_top',
            object: EnumObjectManagerObjects.TicketArticle,
            required: true,
            props: {
              meta: {
                mentionText: {
                  customerNodeName: 'customer_id',
                  groupNodeName: 'group_id',
                },
                mentionUser: {
                  groupNodeName: 'group_id',
                },
                mentionKnowledgeBase: {
                  attachmentsNodeName: 'attachments',
                },
                [TEXT_TOOL_EXTENSION_NAME]: {
                  groupNodeName: 'group_id',
                  ticketNodeName: 'ticket_id',
                  customerNodeName: 'customer_id',
                  organizationNodeName: 'organization_id',
                },
              },
            },
          },
          {
            type: 'file',
            name: 'attachments',
            label: __('Attachment'),
            labelSrOnly: true,
            props: {
              multiple: true,
            },
          },
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class:
                'grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-neutral-700/80',
            },
            children: [
              {
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                screen: 'create_bottom',
                object: EnumObjectManagerObjects.Ticket,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'ticket_duplicate_detection',
    type: 'hidden',
    value: {
      count: 0,
      items: [],
    },
  },
  {
    name: 'link_ticket_id',
    type: 'hidden',
  },
  {
    name: 'shared_draft_id',
    type: 'hidden',
  },
  {
    name: 'externalReferences',
    type: 'hidden',
  },
]

const customerSchema = [
  {
    isLayout: true,
    component: 'CustomerTicketCreateCard',
    children: [
      {
        if: '$values.ticket_duplicate_detection.count > 0',
        isLayout: true,
        component: 'TicketDuplicateDetectionAlert',
        props: {
          tickets: '$values.ticket_duplicate_detection.items',
        },
        children: '',
      },
      {
        isLayout: true,
        element: 'div',
        attrs: {
          class: 'grid grid-cols-1 gap-5',
        },
        children: [
          {
            screen: 'create_top',
            object: EnumObjectManagerObjects.Ticket,
          },
          {
            name: 'body',
            screen: 'create_top',
            object: EnumObjectManagerObjects.TicketArticle,
            required: true,
            props: {
              meta: {
                mentionText: {
                  customerNodeName: 'customer_id',
                  groupNodeName: 'group_id',
                },
                mentionUser: {
                  groupNodeName: 'group_id',
                },
                mentionKnowledgeBase: {
                  attachmentsNodeName: 'attachments',
                },
                [TEXT_TOOL_EXTENSION_NAME]: {
                  groupNodeName: 'group_id',
                  ticketNodeName: 'ticket_id',
                  customerNodeName: 'customer_id',
                  organizationNodeName: 'organization_id',
                },
              },
            },
          },
          {
            type: 'file',
            name: 'attachments',
            label: __('Attachment'),
            labelSrOnly: true,
            props: {
              multiple: true,
            },
          },
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class:
                'grid @md:grid-cols-2-uneven gap-4 pt-3 border-t border-slate-100 dark:border-neutral-700/80',
            },
            children: [
              {
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                screen: 'create_bottom',
                object: EnumObjectManagerObjects.Ticket,
              },
            ],
          },
        ],
      },
      {
        name: 'ticket_duplicate_detection',
        type: 'hidden',
        value: {
          count: 0,
          items: [],
        },
      },
      {
        name: 'link_ticket_id',
        type: 'hidden',
      },
      {
        name: 'shared_draft_id',
        type: 'hidden',
      },
      {
        name: 'externalReferences',
        type: 'hidden',
      },
    ],
  },
]

const formSchema = defineFormSchema(isTicketCustomer.value ? customerSchema : defaultSchema)

const securityIntegration = computed<boolean>(
  () => (application.config.smime_integration || application.config.pgp_integration) ?? false,
)

const additionalCreateNotes = computed(
  () => (application.config.ui_ticket_create_notes as Record<string, string>) || {},
)

const schemaData = reactive({
  defaultTitle,
  isTicketCustomer,
  securityIntegration,
  getTabLabel: (value: string) => `tab-label-${value}`,
  getTabPanelId: (value: string) => `tab-panel-${value}`,
  existingAdditionalCreateNotes: () => {
    return Object.keys(additionalCreateNotes.value).length > 0
  },
  getAdditionalCreateNote: (value: string) => {
    return additionalCreateNotes.value[value]
  },
})

const changedFields = reactive<Record<string, Partial<FormSchemaField>>>({
  // Workaround until the object attribute for body is required so core worklow is returning it correctly.
  body: {
    required: true,
  },

  // The customer_id field needs some additional props for the creation of new customers (it can not be
  // directly in the schema definition, because it will lose the correct position in the form).
  customer_id: {
    props: {
      link: '#',
      linkLabel: __('Create new customer'),
      linkIcon: 'user-add',
      onLinkClick: (e: MouseEvent) => {
        e.preventDefault()

        openUserCreateFlyout({
          title: __('Create new customer'),
          onSuccess: applyNewlyCreatedCustomer,
        })
      },
      // Ticket create accepts unknown customers — the typed-in email
      // becomes a new customer user on submit.
      allowUnknownEmail: true,
    },
  },
})

if (isTicketCustomer.value) {
  Object.assign(changedFields, {
    title: {
      placeholder: __('e.g. Unable to access student portal, timetable inquiry...'),
    },
  })
}

const { signatureHandling } = useTicketSignature()

const sidebarContext = computed<TicketSidebarContext>(() => ({
  screenType: TicketSidebarScreenType.TicketCreate,
  view: isTicketCustomer.value ? 'customer' : 'agent',
  form: form.value,
  formValues: values.value,
  currentTaskbarTabId,
}))

useProvideTicketSidebar(sidebarContext)

const { hasSidebar } = useTicketSidebar()

const { waitForVariantConfirmation } = useConfirmation()

const discardChanges = async () => {
  const confirm = await waitForVariantConfirmation('unsaved')
  if (!confirm) return

  goBack()
  currentTaskbarTabDelete()
}

const applyTemplate = (templateId: string) => {
  triggerFormUpdater({
    includeDirtyFields: true,
    additionalParams: {
      templateId,
    },
  })
}

const formAdditionalRouteQueryParams = computed(() => ({
  taskbarId: currentTaskbarTab.value?.taskbarTabId,
  ...route.query,
}))
</script>

<template>
  <LayoutContent
    name="ticket-create"
    background-variant="primary"
    content-alignment="center"
    :show-sidebar="hasSidebar && (!isTicketCustomer || !isWizardMode)"
    :no-padding="isTicketCustomer"
  >
    <div class="w-full max-w-5xl px-4 py-8">
      <CustomerTicketCreateWizard
        v-if="isTicketCustomer && isWizardMode"
        :form-id="currentTaskbarTabFormId"
        :is-submitting="isSubmittingWizard"
        :created-ticket-info="createdTicketInfo"
        :initial-values="wizardInitialValues"
        @submit="handleWizardSubmit"
        @switch-to-full="switchToFullForm"
        @cancel="handleWizardCancel"
        @view-ticket="handleViewTicket"
        @back-to-dashboard="handleBackToDashboard"
      />
      <div v-show="!isTicketCustomer || !isWizardMode" class="w-full">
        <Form
          id="ticket-create"
          ref="form"
          :key="tabId"
          class="w-full"
          :form-id="currentTaskbarTabFormId"
          :schema="formSchema"
          :schema-component-library="{
            CommonContentPanel: markRaw(CommonContentPanel),
            CustomerTicketCreateCard: markRaw(CustomerTicketCreateCard),
            AgentTicketCreateCard: markRaw(AgentTicketCreateCard),
            TicketDuplicateDetectionAlert: markRaw(TicketDuplicateDetectionAlert),
          }"
          :schema-data="schemaData"
          :form-updater-id="EnumFormUpdaterId.FormUpdaterUpdaterTicketCreate"
          :handlers="[useTicketFormOrganizationHandler(), signatureHandling('body')]"
          :change-fields="changedFields"
          :form-updater-additional-params="formAdditionalRouteQueryParams"
          use-object-attributes
          form-class="flex w-full flex-col gap-5 min-w-xs"
          @submit="submitCreateTicket($event as FormSubmitData<TicketFormData>)"
        />
      </div>
    </div>
    <template #sideBar>
      <TicketSidebar :context="sidebarContext" />
    </template>
    <template v-if="!isTicketCustomer || !isWizardMode" #bottomBar>
      <template v-if="isInitialSettled">
        <CommonButton
          v-if="isDirty"
          size="large"
          variant="danger"
          :disabled="isDisabled"
          @click="discardChanges"
          >{{ $t('Discard changes') }}</CommonButton
        >
        <CommonButton v-else size="large" variant="secondary" @click="goBack">{{
          $t('Cancel & go back')
        }}</CommonButton>
      </template>

      <ApplyTemplate v-if="!isTicketCustomer" @select-template="applyTemplate" />

      <CommonButton
        size="large"
        variant="submit"
        type="submit"
        :form="formNodeId"
        :disabled="isDisabled"
        class="min-w-36"
        >{{ $t('Create') }}</CommonButton
      >
    </template>
  </LayoutContent>
</template>
