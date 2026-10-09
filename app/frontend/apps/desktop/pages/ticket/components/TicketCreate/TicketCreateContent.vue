<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { isEqual } from 'lodash-es'
import { computed, markRaw, nextTick, onActivated, provide, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
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
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { usePage } from '#desktop/composables/usePage.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import { useTicketCreateTitle } from '#desktop/entities/ticket/composables/useTicketCreateTitle.ts'
import { useUserCreate } from '#desktop/entities/user/composables/useUserCreate.ts'
import { useTaskbarTab } from '#desktop/entities/user/current/composables/useTaskbarTab.ts'
import { useTaskbarTabStateUpdates } from '#desktop/entities/user/current/composables/useTaskbarTabStateUpdates.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'
import type { TaskbarTabContext } from '#desktop/entities/user/current/types.ts'

import { useProvideTicketSidebar, useTicketSidebar } from '../../composables/useTicketSidebar.ts'
import { TicketSidebarScreenType, type TicketSidebarContext } from '../../types/sidebar.ts'
import StudenthubTicketSideRail from '../TicketSidebar/StudenthubTicketSideRail.vue'
import TicketSidebar from '../TicketSidebar.vue'

import ApplyTemplate from './ApplyTemplate.vue'
import CustomerTicketCreateCard from './CustomerTicketCreateCard.vue'
import CustomerTicketCreateWizard, {
  type CategoryKey,
  type WizardData,
} from './CustomerTicketCreateWizard.vue'
import StudenthubCreatePanel from './StudenthubCreatePanel.vue'
import StudenthubCustomerEmail from './StudenthubCustomerEmail.vue'
import StudenthubManagerCreateLanding, {
  type ManagerCreateCategory,
} from './StudenthubManagerCreateLanding.vue'
import StudenthubPriorityButtons from './StudenthubPriorityButtons.vue'
import StudenthubSlaPreview from './StudenthubSlaPreview.vue'
import StudenthubTemplatePicker from './StudenthubTemplatePicker.vue'
import TicketDuplicateDetectionAlert from './TicketDuplicateDetectionAlert.vue'
import {
  APPROVAL_MANAGER_FIELD,
  APPROVAL_REASON_FIELD,
  STUDENTHUB_DRAFT_FIELD,
  APPROVAL_SEND_FIELD,
  useStudenthubCreateApproval,
  type StudenthubCreateApprovalValues,
} from './useStudenthubCreateApproval.ts'

interface Props {
  tabId?: string
}

defineProps<Props>()

const router = useRouter()
const walker = useWalker()
const route = useRoute()

const {
  form,
  isDisabled,
  isDirty,
  isInitialSettled,
  formNodeId,
  values,
  triggerFormUpdater,
  updateFieldValues,
} = useForm()

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

// Student Hub: "Send for approval" for staff, when Ticket Approvals is on. Not for managers
// without another staff role: they approve, they don't send (hidden until that's known).
const {
  isLoaded: isApprovalViewerLoaded,
  isManagerOnly,
  isCustomerManager,
} = useStudenthubApprovalViewer()

// Student Hub: managers without another staff role who are also customers raise tickets for
// themselves on the student screens in the application colour: first the "How can we help?"
// card with the categories, then the form ("Raise a New Ticket") or the wizard (a category).
// The route guard waits until this is known (TicketCreate.vue).
const isManagerCreate = isCustomerManager.value
const isCustomerStyle = isTicketCustomer.value || isManagerCreate
const isManagerLanding = computed(() => isManagerCreate && !route.query.mode)

const isWizardMode = ref(
  isManagerCreate
    ? route.query.mode === 'wizard'
    : route.query.mode === 'form'
      ? false
      : isTicketCustomer.value,
)

const openManagerForm = () => {
  router.replace({ query: { ...route.query, mode: 'form' } })
}

const openManagerCategory = (category: ManagerCreateCategory) => {
  router.replace({
    query: {
      ...route.query,
      mode: 'wizard',
      category: category.key,
      categoryValue: category.categoryValue,
    },
  })
}
const isApprovalAvailable = computed(
  () =>
    !isTicketCustomer.value &&
    Boolean(application.config.ticket_approval) &&
    isApprovalViewerLoaded.value &&
    !isManagerOnly.value,
)
const { managerOptions, managerHint, sendForApproval } = useStudenthubCreateApproval(isApprovalAvailable)
// Set on submit, sent once the ticket exists (see redirectAfterCreate).
let pendingApproval: StudenthubCreateApprovalValues | null = null

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

// Student Hub: leaving the New ticket screen on purpose (Cancel, Discard, Save draft, Create)
// skips the leave guard below.
let isLeavingOnPurpose = false

const redirectAfterCreate = (
  internalId?: number,
  ticket?: TicketAttributesFragment | null,
) => {
  isLeavingOnPurpose = true
  if (isWizardMode.value && (ticket || internalId)) {
    createdTicketInfo.value = {
      id: internalId || ticket?.internalId || 0,
      number: ticket?.number || String(internalId || ''),
    }
    isSubmittingWizard.value = false
    return
  }

  if (internalId) {
    if (pendingApproval) void sendForApproval(internalId, pendingApproval)
    pendingApproval = null
    router.replace(`/tickets/${internalId}`)
    return
  }

  // Fallback redirect, in case the user has no access to the ticket they just created.
  router.replace('/')
}

const goBack = () => {
  walker.back('/')
}

const { createTicket } = useTicketCreate(form, redirectAfterCreate, {
  asCustomer: () => isManagerCreate,
})

const submitCreateTicket = async (event: FormSubmitData<TicketFormData>) => {
  const data = event as Record<string, unknown>
  pendingApproval =
    isApprovalAvailable.value && data[APPROVAL_SEND_FIELD] === true
      ? {
          send: true,
          approverId: Number(data[APPROVAL_MANAGER_FIELD]),
          reason: String(data[APPROVAL_REASON_FIELD] ?? ''),
        }
      : null

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
    if (!rawCat) rawCat = __('Service Request')
  } else if (catKey === 'general') {
    catKey = 'service_request'
    if (!rawCat) rawCat = __('Service Request')
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
    if (catKey === 'service_request') catName = __('Service Request')
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
        ? __('Service Request')
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
        ? __('Service Request')
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
      // Student Hub: the answers to the sub-category's request form.
      ...data.requestFields,
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
const createHint = __('Fill in the details on the left and the message on the right, then press Create.')

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
  // Student Hub: staff "New ticket" (Halo layout). Main column: who it is for, what the issue is,
  // more details (every other field of the create screen, including the ones admins add).
  // Side column: triage, the SLA for the chosen priority, approval. Fields placed by name are
  // left out when Zammad expands a screen (create_middle / create_bottom) later in the form.
  {
    isLayout: true,
    element: 'div',
    attrs: {
      class: 'sh-create',
    },
    children: [
      {
        isLayout: true,
        element: 'div',
        attrs: {
          class: 'sh-create__column',
        },
        children: [
      {
        isLayout: true,
        component: 'StudenthubTemplatePicker',
        props: {
          onSelect: '$applyTemplate',
        },
      },
      {
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('Who is it for?'),
          icon: 'user',
        },
        children: [
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class: 'sh-create__row',
            },
            children: [
              {
                name: 'customer_id',
                screen: 'create_top',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                name: 'campus',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
            ],
          },
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class: 'sh-create__row',
            },
            children: [
              {
                isLayout: true,
                component: 'StudenthubCustomerEmail',
                props: {
                  customerId: '$values.customer_id',
                },
              },
              {
                if: '$isTicketCustomer === false',
                ...ticketArticleSenderTypeField,
                type: 'select',
                label: __('Came in by'),
              },
            ],
          },
          {
            name: 'organization_id',
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
        ],
      },
      {
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('What is the issue?'),
          icon: 'chat-left-text',
        },
        children: [
          {
            name: 'title',
            screen: 'create_top',
            object: EnumObjectManagerObjects.Ticket,
            label: __('Summary'),
          },
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class: 'sh-create__row sh-create__row--even',
            },
            children: [
              {
                name: 'category2',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                name: 'subcategory',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
            ],
          },
          {
            name: 'body',
            screen: 'create_top',
            object: EnumObjectManagerObjects.TicketArticle,
            label: __('Details'),
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
        ],
      },
        ],
      },
      {
        isLayout: true,
        element: 'div',
        attrs: {
          class: 'sh-create__column sh-create__column--side',
        },
        children: [
      {
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('Triage'),
          icon: 'speedometer2',
        },
        children: [
          {
            isLayout: true,
            component: 'StudenthubPriorityButtons',
            props: {
              label: __('Priority'),
              options: '$fields.priority_id.props.options',
              value: '$values.priority_id',
              onSelect: '$selectPriority',
            },
          },
          {
            name: 'priority_id',
            screen: 'create_middle',
            object: EnumObjectManagerObjects.Ticket,
            // Zammad's field stays in the form (options, default, validation); the buttons above set it.
            outerClass: 'hidden',
          },
          {
            name: 'group_id',
            screen: 'create_middle',
            object: EnumObjectManagerObjects.Ticket,
            label: __('Team'),
          },
          {
            name: 'owner_id',
            screen: 'create_middle',
            object: EnumObjectManagerObjects.Ticket,
            label: __('Assign to'),
          },
          {
            name: 'state_id',
            screen: 'create_middle',
            object: EnumObjectManagerObjects.Ticket,
          },
          {
            name: 'pending_time',
            screen: 'create_middle',
            object: EnumObjectManagerObjects.Ticket,
          },
        ],
      },
      {
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('SLA for this priority'),
          icon: 'stopwatch',
        },
        children: [
          {
            isLayout: true,
            component: 'StudenthubSlaPreview',
            props: {
              priorityId: '$values.priority_id',
              groupId: '$values.group_id',
              stateId: '$values.state_id',
            },
          },
        ],
      },
      {
        if: '$approvalAvailable === true',
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('Approval'),
          icon: 'check2-circle',
        },
        children: [
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class: 'sh-create__fields',
            },
            children: [
              {
                name: APPROVAL_SEND_FIELD,
                type: 'toggle',
                label: __('Send for approval'),
                value: false,
                help: __('A manager approves or denies the ticket once it is created.'),
                props: {
                  variants: {
                    true: 'yes',
                    false: 'no',
                  },
                },
              },
              {
                if: `$values.${APPROVAL_SEND_FIELD} === true`,
                name: APPROVAL_MANAGER_FIELD,
                type: 'select',
                label: __('Manager'),
                required: true,
                // Clearable: Zammad would otherwise preselect the first manager.
                props: {
                  clearable: true,
                  noOptionsLabelTranslation: true,
                  options: [],
                },
              },
              {
                if: `$values.${APPROVAL_SEND_FIELD} === true`,
                name: APPROVAL_REASON_FIELD,
                type: 'textarea',
                label: __('Reason'),
                required: true,
                props: {
                  rows: 3,
                  maxlength: 5000,
                },
              },
            ],
          },
        ],
      },
        ],
      },
      // Optional fields last: after triage for the keyboard, under the main column on wide screens.
      {
        isLayout: true,
        element: 'div',
        attrs: {
          class: 'sh-create__column sh-create__column--more',
        },
        children: [
      {
        isLayout: true,
        component: 'StudenthubCreatePanel',
        props: {
          title: __('More details'),
          icon: 'list-ul',
        },
        children: [
          {
            isLayout: true,
            element: 'div',
            attrs: {
              class: 'sh-create__grid',
            },
            children: [
              // Every other field of the create screen, including the ones admins add.
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
  // Student Hub: set by "Save draft", kept with the tab's form values (see the leave guard).
  {
    name: STUDENTHUB_DRAFT_FIELD,
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

// Student Hub: the student form for managers who are also customers. Their staff permission
// would show the staff fields of the screens (customer, owner, state…), so the fields are named.
const managerSchema = [
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
            name: 'title',
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
                mentionKnowledgeBase: {
                  attachmentsNodeName: 'attachments',
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
                'grid @md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-neutral-700/80',
            },
            children: [
              {
                name: 'group_id',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                name: 'campus',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                name: 'category2',
                screen: 'create_middle',
                object: EnumObjectManagerObjects.Ticket,
              },
              {
                name: 'subcategory',
                screen: 'create_middle',
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
    ],
  },
]

const formSchema = defineFormSchema(
  isManagerCreate ? managerSchema : isTicketCustomer.value ? customerSchema : defaultSchema,
)

const securityIntegration = computed<boolean>(
  () => (application.config.smime_integration || application.config.pgp_integration) ?? false,
)

const additionalCreateNotes = computed(
  () => (application.config.ui_ticket_create_notes as Record<string, string>) || {},
)

const schemaData = reactive({
  defaultTitle,
  createHint,
  approvalAvailable: isApprovalAvailable,
  selectPriority: (value: string | number) => updateFieldValues({ priority_id: value }),
  applyTemplate: (templateId: string) => applyTemplate(templateId),
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

if (isCustomerStyle) {
  Object.assign(changedFields, {
    title: {
      placeholder: __('e.g. Unable to access student portal, timetable inquiry...'),
    },
  })
} else {
  Object.assign(changedFields, {
    title: {
      placeholder: __('One line, e.g. Cannot see timetable for this term'),
    },
  })
}

// Student Hub: the managers to choose from.
watch(
  [managerOptions, managerHint],
  ([options, hint]) => {
    changedFields[APPROVAL_MANAGER_FIELD] = { props: { options }, help: hint }
  },
  { immediate: true },
)

const { signatureHandling } = useTicketSignature()

// Student Hub: "Tickets / New ticket" in the top bar for staff.
useStudenthubTopBarCrumbsWhileShown(() =>
  isTicketCustomer.value
    ? []
    : [{ label: __('Tickets'), route: '/tickets/view' }, { label: __('New ticket') }],
)

const sidebarContext = computed<TicketSidebarContext>(() => ({
  screenType: TicketSidebarScreenType.TicketCreate,
  view: isTicketCustomer.value ? 'customer' : 'agent',
  form: form.value,
  formValues: values.value,
  currentTaskbarTabId,
}))

useProvideTicketSidebar(sidebarContext)

const { hasSidebar } = useTicketSidebar()

const { waitForConfirmation, waitForVariantConfirmation } = useConfirmation()

const discardChanges = async () => {
  const confirm = await waitForVariantConfirmation('unsaved')
  if (!confirm) return

  isLeavingOnPurpose = true
  goBack()
  currentTaskbarTabDelete()
}

// Student Hub: header actions of the staff screen. An unfinished new ticket stays in Recent
// (Zammad keeps the tab); Cancel removes it. Zammad marks a new form as changed as soon as it
// fills in its defaults, so "has the agent entered anything" is checked on the fields instead.
const { notify } = useNotifications()

const hasContent = computed(() => {
  const formValues = values.value as Record<string, unknown>
  const body = String(formValues.body ?? '').replace(/<[^>]*>|&nbsp;|\s/g, '')
  const attachments = formValues.attachments as unknown[] | undefined

  return Boolean(formValues.title || formValues.customer_id || body || attachments?.length)
})

const cancelCreate = async () => {
  if (hasContent.value) {
    await discardChanges()
    return
  }

  isLeavingOnPurpose = true
  goBack()
  currentTaskbarTabDelete()
}

// After a refused Create, take the agent to the first field that needs attention (FormKit marks
// the fields, it doesn't move focus).
const focusFirstInvalidField = () => {
  window.setTimeout(() => {
    const field = document
      .getElementById(formNodeId.value)
      ?.querySelector<HTMLElement>(
        "[data-invalid] :is(input:not([type='hidden']), textarea, [role='combobox'], [contenteditable='true'])",
      )
    if (!field) return

    field.scrollIntoView({ block: 'center' })
    field.focus({ preventScroll: true })
  }, 50)
}

const markAsDraft = () => updateFieldValues({ [STUDENTHUB_DRAFT_FIELD]: '1' })

const saveDraft = () => {
  markAsDraft()
  notify({
    id: 'ticket-create-draft',
    type: NotificationTypes.Success,
    message: __('Draft saved. Continue it from Recent.'),
  })
  isLeavingOnPurpose = true
  goBack()
}

// Student Hub: Recent keeps tickets and drafts only. Leaving an untouched New ticket closes its
// tab; with something typed the agent chooses to save it as a draft or discard it (closing the
// dialog stays here). The tab is closed once the next page is shown.
const closeTabAfterLeaving = () => {
  const removeHook = router.afterEach(() => {
    removeHook()
    currentTaskbarTabDelete()
  })
}

const taskbarTabsStore = useUserCurrentTaskbarTabsStore()

// The dialog runs outside the navigation (which is held back), then the agent is taken on.
const askBeforeLeaving = async (target: string) => {
  const keep = await waitForConfirmation(
    __('Save this new ticket as a draft? Drafts stay under Recent until you finish them.'),
    {
      headerTitle: __('Unfinished new ticket'),
      buttonLabel: __('Save draft'),
      cancelLabel: __('Discard'),
    },
  )
  if (keep === undefined) return

  if (keep) {
    markAsDraft()
  } else {
    closeTabAfterLeaving()
  }
  isLeavingOnPurpose = true
  router.push(target)
}

onBeforeRouteLeave((to) => {
  if (isCustomerStyle || isLeavingOnPurpose) return true
  // Closed from Recent: Zammad already asked about unsaved changes.
  if (!currentTaskbarTabId.value || taskbarTabsStore.taskbarTabIDsInDeletion.includes(currentTaskbarTabId.value))
    return true
  if ((values.value as Record<string, unknown>)[STUDENTHUB_DRAFT_FIELD] === '1') return true

  if (!hasContent.value) {
    closeTabAfterLeaving()
    return true
  }

  askBeforeLeaving(to.fullPath)
  return false
})

onActivated(() => {
  isLeavingOnPurpose = false
})

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
    :show-sidebar="hasSidebar && isTicketCustomer && !isWizardMode"
    no-padding
    :no-scrollable="!isCustomerStyle"
  >
    <!-- Student Hub: staff get the ticket screen's layout (two columns, panels on the right edge) -->
    <div :class="isCustomerStyle ? 'contents' : 'flex size-full min-h-0'">
    <div :class="isCustomerStyle ? 'contents' : 'flex min-w-0 flex-1 flex-col'">
    <header v-if="!isCustomerStyle" class="sh-create-bar">
      <h1 class="sh-create-bar__title" aria-current="page">{{ currentTitle || $t('New ticket') }}</h1>
      <!-- One group, so the buttons wrap together on narrow screens -->
      <div class="sh-create-bar__main">
        <CommonButton class="sh-create-bar__cancel" size="large" variant="tertiary" @click="cancelCreate">{{
          $t('Cancel')
        }}</CommonButton>
        <CommonButton
          class="sh-create-bar__draft"
          size="large"
          variant="secondary"
          :disabled="isDisabled || !hasContent"
          @click="saveDraft"
        >
          {{ $t('Save draft') }}
        </CommonButton>
        <CommonButton
          class="sh-create-bar__create"
          size="large"
          variant="submit"
          type="submit"
          :form="formNodeId"
          :disabled="isDisabled"
          @click="focusFirstInvalidField"
        >
          {{ $t('Create ticket') }}
        </CommonButton>
      </div>
    </header>
    <div
      :class="
        isCustomerStyle
          ? ['w-full max-w-5xl px-4 py-8', { 'sh-manager-create': isManagerCreate }]
          : 'sh-create-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5'
      "
    >
      <StudenthubManagerCreateLanding
        v-if="isManagerLanding"
        @raise="openManagerForm"
        @category="openManagerCategory"
      />
      <CustomerTicketCreateWizard
        v-else-if="isCustomerStyle && isWizardMode"
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
      <div v-show="!isCustomerStyle || (!isWizardMode && !isManagerLanding)" class="w-full">
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
            StudenthubCreatePanel: markRaw(StudenthubCreatePanel),
            StudenthubCustomerEmail: markRaw(StudenthubCustomerEmail),
            StudenthubPriorityButtons: markRaw(StudenthubPriorityButtons),
            StudenthubSlaPreview: markRaw(StudenthubSlaPreview),
            StudenthubTemplatePicker: markRaw(StudenthubTemplatePicker),
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
    </div>
    <StudenthubTicketSideRail v-if="!isCustomerStyle" :context="sidebarContext" />
    </div>
    <template #sideBar>
      <TicketSidebar :context="sidebarContext" />
    </template>
    <!-- Student Hub: staff have the actions in the header -->
    <template v-if="isCustomerStyle && !isWizardMode && !isManagerLanding" #bottomBar>
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

      <ApplyTemplate v-if="!isCustomerStyle" @select-template="applyTemplate" />

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
