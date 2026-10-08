<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onKeyStroke, useLocalStorage, useScroll, whenever } from '@vueuse/core'
import { cloneDeep, isEqual } from 'lodash-es'
import {
  computed,
  toRef,
  provide,
  Teleport,
  markRaw,
  type Component,
  reactive,
  nextTick,
  watch,
  useTemplateRef,
  ref,
  effectScope,
  onUnmounted,
} from 'vue'

import {
  NotificationTypes,
  useNotifications,
} from '#shared/components/CommonNotifications/index.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData, FormValues } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { setErrors } from '#shared/components/Form/utils.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import {
  useTicketMacros,
  macroScreenBehaviourMapping,
} from '#shared/entities/macro/composables/useMacros.ts'
import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import { useTicketEdit } from '#shared/entities/ticket/composables/useTicketEdit.ts'
import { useTicketEditForm } from '#shared/entities/ticket/composables/useTicketEditForm.ts'
import { useTicketLiveUserList } from '#shared/entities/ticket/composables/useTicketLiveUserList.ts'
import { useTicketNumberAndTitle } from '#shared/entities/ticket/composables/useTicketNumberAndTitle.ts'
import { useTicketSignature } from '#shared/entities/ticket/composables/useTicketSignature.ts'
import type {
  TicketArticleTimeAccountingFormData,
  TicketUpdateFormData,
} from '#shared/entities/ticket/types.ts'
import type { AppSpecificTicketArticleType } from '#shared/entities/ticket-article/action/plugins/types.ts'
import {
  useArticleDataHandler,
  type AddArticleCallbackArgs,
} from '#shared/entities/ticket-article/composables/useArticleDataHandler.ts'
import UserError from '#shared/errors/UserError.ts'
import {
  EnumFormUpdaterId,
  EnumTaskbarApp,
  EnumTicketScreenBehavior,
  EnumUserErrorException,
} from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'
import { QueryHandler } from '#shared/server/apollo/handler/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { GraphQLErrorTypes, type GraphQLHandlerError } from '#shared/types/error.ts'

import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import CommonIndicator from '#desktop/components/CommonIndicator/CommonIndicator.vue'
import { useIndicator } from '#desktop/components/CommonIndicator/useIndicator.ts'
import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'
import { SidebarName, SidebarPosition } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import { usePage } from '#desktop/composables/usePage.ts'
import { useScrollPosition } from '#desktop/composables/useScrollPosition.ts'
import { useTaskbarTab } from '#desktop/entities/user/current/composables/useTaskbarTab.ts'
import { useTaskbarTabStateUpdates } from '#desktop/entities/user/current/composables/useTaskbarTabStateUpdates.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'
import type { TaskbarTabContext } from '#desktop/entities/user/current/types.ts'
import FloatingToolbar from '#desktop/pages/ticket/components/TicketDetailView/FloatingToolbar.vue'
import StudenthubTicketSaveBar from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailBottomBar/StudenthubTicketSaveBar.vue'
import TicketDetailBottomBar from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailBottomBar/TicketDetailBottomBar.vue'
import { items as highlightMenuItems } from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/composables/useHighlightMenuState.ts'
import { useTicketScreenBehavior } from '#desktop/pages/ticket/components/TicketDetailView/TicketScreenBehavior/useTicketScreenBehavior.ts'

import { ARTICLES_INFORMATION_KEY } from '../../composables/useArticleContext.ts'
import { useStudenthubQueueLayout } from '../../composables/useStudenthubQueueLayout.ts'
import { useStudenthubTicketQueue } from '../../composables/useStudenthubTicketQueue.ts'
import { useTicketArticleReply } from '../../composables/useTicketArticleReply.ts'
import {
  initializeTicketInformation,
  provideTicketInformation,
} from '../../composables/useTicketInformation.ts'
import { useTicketSidebar, useProvideTicketSidebar } from '../../composables/useTicketSidebar.ts'
import { type TicketSidebarContext, TicketSidebarScreenType } from '../../types/sidebar.ts'
import StudenthubTicketSideRail from '../TicketSidebar/StudenthubTicketSideRail.vue'
import TicketSidebar from '../TicketSidebar.vue'

import ArticleList from './ArticleList.vue'
import ArticleListSkeleton from './ArticleListSkeleton.vue'
import ArticleReply from './ArticleReply.vue'
import StudenthubTicketQueue from './StudenthubTicketQueue.vue'
import TicketDetailTopBar from './TicketDetailTopBar/TicketDetailTopBar.vue'
import TicketDetailTopBarSkeleton from './TicketDetailTopBar/TicketDetailTopBarSkeleton.vue'
import { useUnreadArticle } from './useUnreadArticle.ts'
interface Props {
  internalId: string
}

const props = defineProps<Props>()

const internalId = toRef(props, 'internalId')
const isReplyPinned = useLocalStorage('article-reply-pinned', false)

// Student Hub: agents and admins work with the queue beside the ticket and the ticket panels in
// a column on the right (see useStudenthubQueueLayout).
const session = useSessionStore()
const { isLoaded: isViewerLoaded, isQueueLayout } = useStudenthubQueueLayout()
// Agents' save area (Update…) at the foot of the open panel column instead of the bar across the
// screen; with the column collapsed, Zammad's bar comes back.
const { isSidebarCollapsed: isPanelColumnCollapsed } = useSidebarDisplay(SidebarName.TicketContent)
const hasStudenthubSaveBar = computed(() => isQueueLayout.value && !isPanelColumnCollapsed.value)

const studenthubQueue = useStudenthubTicketQueue(
  internalId,
  computed(() => isViewerLoaded.value && isQueueLayout.value),
)
const contentContainerElement = useTemplateRef('content-container')

const { ticket, ticketId, ...ticketInformation } = initializeTicketInformation(internalId)

const { isIntersecting: isReachingBottom } = useIndicator()
const { isIntersecting: isReachingTop } = useIndicator()

const { articleCount, addUnreadArticle, unreadArticleIds, clearUnreadArticles } = useUnreadArticle({
  cleanupDependency: isReachingBottom,
})

const onAddArticleCallback = ({ articlesQuery, updates }: AddArticleCallbackArgs) => {
  // When we are at the end user is aware of the new article
  if (!isReachingBottom.value) addUnreadArticle(updates?.addArticle?.id as string)

  return (articlesQuery as QueryHandler).refetch()
}

const { articleResult, articlesQuery, isLoadingArticles } = useArticleDataHandler(ticketId, {
  pageSize: 20,
  onAddArticleCallback,
})

provide(ARTICLES_INFORMATION_KEY, {
  articles: computed(() => articleResult.value),
  articlesQuery,
})

const {
  form,
  values,
  flags,
  isDisabled,
  isDirty,
  isInitialSettled,
  formReset,
  formSubmit,
  triggerFormUpdater,
} = useForm()

const tabContext = computed<TaskbarTabContext>((currentContext) => {
  if (!isInitialSettled.value) return {}

  const newContext = {
    formIsDirty: isDirty.value,
  }

  if (currentContext && isEqual(newContext, currentContext)) return currentContext

  return newContext
})

const { currentTaskbarTabId, currentTaskbarTabFormId, currentTaskbarTabNewArticlePresent } =
  useTaskbarTab(tabContext)

const { ticketNumberWithTitle } = useTicketNumberAndTitle(ticket)

usePage({
  metaTitle: ticketNumberWithTitle,
})

const { scrollIntoView: scrollToArticle } = useScrollPosition(contentContainerElement)

const handleScrollToArticleEnds = async (
  block: 'start' | 'end' = 'end',
  behavior: ScrollOptions['behavior'] = 'auto',
) => scrollToArticle(block, { behavior })

const articleListInstance = useTemplateRef('article-list')

const handleScrollToArticle = (direction: 'next' | 'previous' | 'unread') => {
  const movedToArticle = articleListInstance.value?.goToAdjacentArticle(direction)

  if (movedToArticle) return

  // We are already on the first/last article, so there is no adjacent one to
  // jump to. Scroll all the way to the very top/bottom
  handleScrollToArticleEnds(direction === 'previous' ? 'start' : 'end')
}

const handleScrollToUnreadArticle = () => {
  handleScrollToArticle('unread')
  clearUnreadArticles()
}

// Keyboard shortcuts
onKeyStroke('ArrowLeft', (event) => {
  // Prevent reacting when the target is on any other element e.g inputs
  const target = event.target as HTMLElement
  if (target !== document.body) return

  handleScrollToArticle('previous')
})

onKeyStroke('ArrowRight', (event) => {
  // Prevent reacting when the target is on any other element e.g inputs
  const target = event.target as HTMLElement
  if (target !== document.body) return

  handleScrollToArticle('next')
})

const isReplyActive = computed(() => !isLoadingArticles.value && isInitialSettled.value)

let scrollTimeout: NodeJS.Timeout | undefined
const scrollScope = effectScope()

const handleInitialScrollToEnd = (isPermalink = false) => {
  const stopWatch = watch(
    () => isReplyActive.value,
    (visible) => {
      if (!visible) return
      //  It is unreliable scrolling to the end
      // Async effects which need to run before
      // :TODO find a better solution then setTimeout
      scrollTimeout = setTimeout(() => {
        if (!isPermalink) handleScrollToArticleEnds('end', 'instant')

        scrollScope.run(() => {
          const { directions } = useScroll(contentContainerElement)

          whenever(
            () => (isPermalink ? directions.top || directions.bottom : directions.top),
            () => {
              scrollScope.stop()
            },
          )
        })

        stopWatch()
      }, 50)
    },
    { flush: 'post', immediate: true },
  )
}

onUnmounted(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollScope.stop()
})

const groupId = computed(() =>
  isInitialSettled.value && values.value.group_id
    ? convertToGraphQLId('Group', values.value.group_id as number)
    : undefined,
)

const {
  ticketSchema,
  articleSchema,
  currentArticleType,
  currentSchemaArticleType,
  ticketArticleTypes,
  ticketArticleDefaultValues,
  securityIntegration,
  isTicketAgent,
  isTicketCustomer,
  isTicketEditable,
  articleTypeHandler,
  articleTypeSelectHandler,
  additionalAddArticleNotes,
} = useTicketEditForm(ticket, form)

const { signatureHandling } = useTicketSignature('email')

const {
  isArticleFormGroupValid,
  newTicketArticlePresent,
  articleFormGroupNode,
  showTicketArticleReplyForm,
} = useTicketArticleReply(form, currentTaskbarTabNewArticlePresent)

useTaskbarTabStateUpdates(currentTaskbarTabId, form, triggerFormUpdater, async () => {
  newTicketArticlePresent.value = false

  await nextTick()

  currentArticleType.value = undefined

  nextTick(() => {
    formReset({
      values: {
        article: ticketArticleDefaultValues,
      },
    })
  })
})

const sidebarContext = computed<TicketSidebarContext>(() => ({
  ticket,
  isTicketEditable,
  screenType: TicketSidebarScreenType.TicketDetailView,
  view: isTicketAgent.value ? 'agent' : 'customer',
  form: form.value,
  formValues: {
    // TODO: Workaround, to make the sidebars working for now.
    customer_id: ticket.value?.customer.internalId,
    organization_id: ticket.value?.organization?.internalId,
  },
  currentTaskbarTabId,
}))

useProvideTicketSidebar(sidebarContext)
const { hasSidebar, activeSidebar, shownSidebars, switchSidebar } = useTicketSidebar()

const hasInternalArticle = computed(() => (values.value as TicketUpdateFormData).article?.internal)

// Student Hub: agents' reply bar at the bottom of the conversation (ArticleReply, while no reply
// is open): the messages take the free height and the scroll buttons sit above the bar.
const hasStudenthubReplyBar = computed(
  () =>
    isQueueLayout.value &&
    isTicketAgent.value &&
    isTicketEditable.value &&
    !newTicketArticlePresent.value,
)

const formEditAttributeLocation = computed(() => {
  // Student Hub: the Ticket panel stays mounted while others are open (beside it, or hidden in the
  // agents' panel column).
  if (activeSidebar.value === 'information' || shownSidebars.value.information)
    return '#ticketEditAttributeForm'
  return '#wrapper-form-ticket-edit'
})

const formArticleReplyLocation = computed(() => {
  if (newTicketArticlePresent.value) return '#ticketArticleReplyForm'
  return '#wrapper-form-ticket-edit'
})

const hiddenFormGroups = computed(() => {
  if (newTicketArticlePresent.value) return

  return ['article']
})

const { liveUserList } = useTicketLiveUserList(internalId, isTicketAgent, EnumTaskbarApp.Desktop)

provideTicketInformation({
  ticket,
  ticketId,
  isTicketEditable,
  form,
  newTicketArticlePresent,
  showTicketArticleReplyForm,
  highlightMenu: reactive({
    activeMenuItem: highlightMenuItems[0],
    isActive: false,
    isEraserActive: false,
  }),
  ...ticketInformation,
})

const ticketEditSchemaData = reactive({
  formEditAttributeLocation,
  formArticleReplyLocation,
  securityIntegration,
  isTicketCustomer,
  newTicketArticlePresent,
  isReplyPinned,
  currentArticleType: currentSchemaArticleType,
  existingAdditionalAddArticleNotes: () => {
    return Object.keys(additionalAddArticleNotes.value).length > 0
  },
  getAdditionalAddArticleNote: (articleType?: AppSpecificTicketArticleType) => {
    if (!articleType) return undefined

    const accessor = `${articleType.value}-${articleType.internal ? 'internal' : 'public'}`

    return additionalAddArticleNotes.value[accessor]
  },
})

const ticketEditSchema = [
  {
    isLayout: true,
    component: 'Teleport',
    props: {
      to: '$formEditAttributeLocation',
    },
    children: [
      {
        isLayout: true,
        component: 'FormGroup',
        props: {
          class: '@sm:*:col-span-1',
          showDirtyMark: true,
        },
        children: [ticketSchema],
      },
    ],
  },
  {
    isLayout: true,
    component: 'Teleport',
    attrs: {
      style: {
        if: '$newTicketArticlePresent',
        then: 'display: none;',
      },
    },
    props: {
      to: '$formArticleReplyLocation',
    },
    children: [
      {
        isLayout: true,
        component: 'FormGroup',
        children: [articleSchema],
      },
    ],
  },
]

const { waitForConfirmation, waitForVariantConfirmation } = useConfirmation()

const { handleScreenBehavior } = useTicketScreenBehavior(currentTaskbarTabId)

const { deleteTaskbarTab } = useUserCurrentTaskbarTabsStore()

const TAB_CLOSING_BEHAVIOURS = new Set<EnumTicketScreenBehavior | undefined>([
  EnumTicketScreenBehavior.CloseTab,
  EnumTicketScreenBehavior.CloseTabOnTicketClose,
  EnumTicketScreenBehavior.CloseNextInOverview,
])

// Student Hub: with the queue beside the ticket, a closed ticket (Close, or Update with a closed
// state) moves on to the next ticket of the queue, and so does "Next in overview" (macros, or the
// agent's setting from the classic UI). The closed ticket's tab closes if the agent's tab setting
// says so. Returns false when there is nothing to move on to.
const moveOnInQueue = (
  updatedTicket: { state: { stateType: { name: string } } },
  screenBehaviour?: EnumTicketScreenBehavior,
) => {
  if (!isQueueLayout.value) return false

  const behaviour =
    screenBehaviour ||
    (session.user?.preferences?.secondaryAction as EnumTicketScreenBehavior | undefined)

  if (
    updatedTicket.state.stateType.name !== 'closed' &&
    behaviour !== EnumTicketScreenBehavior.CloseNextInOverview
  )
    return false

  const next = studenthubQueue.nextTicket.value
  if (!next) return false

  const tabId = currentTaskbarTabId.value

  studenthubQueue.openTicket(next).then(() => {
    if (tabId && TAB_CLOSING_BEHAVIOURS.has(behaviour)) deleteTaskbarTab(tabId)
  })

  return true
}

const canUseDraft = computed(() => {
  return flags.value.hasSharedDraft
})

const hasAvailableDraft = computed(() => {
  const sharedDraftZoomId = ticket.value?.sharedDraftZoomId
  if (!sharedDraftZoomId) return false

  return canUseDraft.value
})

const discardChanges = async () => {
  const confirm = await waitForVariantConfirmation('unsaved')

  if (confirm) {
    newTicketArticlePresent.value = false

    await nextTick()

    currentArticleType.value = undefined

    await nextTick()

    formReset({
      values: {
        article: ticketArticleDefaultValues,
      },
    })
  }
}

// NB: Silence toast notifications for particular errors, these will be handled by the layout taskbar tab component.
const errorCallback = (errorHandler: GraphQLHandlerError) =>
  errorHandler.type !== GraphQLErrorTypes.Forbidden &&
  errorHandler.type !== GraphQLErrorTypes.RecordNotFound

const { isTicketFormGroupValid, initialTicketValue, editTicket, buildTicketResetValues } =
  useTicketEdit(ticket, form, errorCallback)

const { openReplyForm } = useTicketArticleReplyAction(form, showTicketArticleReplyForm)

const isFormValid = computed(() => {
  if (!newTicketArticlePresent.value) return isTicketFormGroupValid.value

  return isTicketFormGroupValid.value && isArticleFormGroupValid.value
})

const formAdditionalRouteQueryParams = computed(() => ({
  taskbarId: currentTaskbarTabId.value,
}))

const { notify } = useNotifications()

const checkSubmitEditTicket = () => {
  if (!isFormValid.value) {
    if (activeSidebar.value !== 'information') switchSidebar('information')

    if (newTicketArticlePresent.value && !isArticleFormGroupValid.value && !isReplyPinned.value)
      scrollToArticle('end')
  }

  formSubmit()
}

const skipValidators = ref<EnumUserErrorException[]>([])

const handleIncompleteChecklist = async (error: UserError) => {
  const confirmed = await waitForConfirmation(
    __(
      'You have unchecked items in the checklist. Do you want to handle them before closing this ticket?',
    ),
    {
      headerTitle: __('Incomplete ticket checklist'),
      headerIcon: 'checklist',
      buttonLabel: __('Yes, open the checklist'),
      cancelLabel: __('No, just close the ticket'),
    },
  )

  if (confirmed) {
    if (activeSidebar.value !== 'checklist') switchSidebar('checklist')
    return false
  }

  if (confirmed === false) {
    const exception = error.getFirstErrorException()
    if (exception) skipValidators.value?.push(exception)
    formSubmit()
    return true
  }

  return false
}

const timeAccountingData = ref<TicketArticleTimeAccountingFormData>()

const timeAccountingFlyout = useFlyout({
  name: 'ticket-time-accounting',
  component: () => import('./TimeAccountingFlyout.vue'),
})

const handleTimeAccounting = (error: UserError) => {
  timeAccountingFlyout.open({
    onAccountTime: (data: TicketArticleTimeAccountingFormData) => {
      timeAccountingData.value = data
      formSubmit()
    },
    onSkip: () => {
      const exception = error.getFirstErrorException()
      if (exception) skipValidators.value?.push(exception)
      formSubmit()
    },
  })

  return false
}

const handleUserErrorException = (error: UserError) => {
  if (
    error.getFirstErrorException() ===
    EnumUserErrorException.ServiceTicketUpdateValidatorChecklistCompletedError
  )
    return handleIncompleteChecklist(error)

  if (
    error.getFirstErrorException() ===
    EnumUserErrorException.ServiceTicketUpdateValidatorTimeAccountingError
  )
    return handleTimeAccounting(error)

  return true
}

const { activeMacro, executeMacro, disposeActiveMacro } = useTicketMacros(formSubmit)

const submitEditTicket = async (formData: FormSubmitData<TicketUpdateFormData>) => {
  let data = cloneDeep(formData)
  if (currentArticleType.value?.updateForm) data = currentArticleType.value.updateForm(data)

  if (data.article && timeAccountingData.value) {
    data.article = {
      ...data.article,
      timeUnit:
        timeAccountingData.value.time_unit !== undefined
          ? parseFloat(timeAccountingData.value.time_unit)
          : undefined,
      accountedTimeTypeId: timeAccountingData.value.accounted_time_type_id
        ? convertToGraphQLId(
            'Ticket::TimeAccounting::Type',
            timeAccountingData.value.accounted_time_type_id,
          )
        : undefined,
    }
  }

  return editTicket(data, {
    macroId: activeMacro.value?.id,
    skipValidators: skipValidators.value,
  })
    .then((result) => {
      if (result?.ticketUpdate?.ticket) {
        notify({
          id: 'ticket-update',
          type: NotificationTypes.Success,
          message: __('Ticket updated successfully.'),
        })

        const screenBehaviour = activeMacro.value
          ? macroScreenBehaviourMapping[activeMacro.value?.uxFlowNextUp]
          : undefined

        if (!moveOnInQueue(result.ticketUpdate.ticket, screenBehaviour))
          handleScreenBehavior({
            screenBehaviour,
            ticket: result.ticketUpdate.ticket,
          })

        skipValidators.value.length = 0
        timeAccountingData.value = undefined

        // Await subscription to update article list before we scroll to the bottom.
        watch(articleResult, () => scrollToArticle('end'), {
          once: true,
        })

        // Reset article form after ticket update and reset form.
        newTicketArticlePresent.value = false
        currentArticleType.value = undefined

        return {
          reset: (values: FormSubmitData<TicketUpdateFormData>, formNodeValues: FormValues) => {
            nextTick(() => {
              if (!formNodeValues || !ticket.value) return

              // Seed the ticket group from the persisted entity, so server-side
              // changes (e.g. the automatic new->open transition) are reflected
              // instead of the submitted values. Only the form-only fields and
              // the article reset come from values.
              formReset({
                object: ticket.value,
                values: {
                  ...buildTicketResetValues(ticket.value),
                  article: ticketArticleDefaultValues,
                },
              })
            })
          },
        }
      }

      return false
    })
    .catch((error) => {
      if (error instanceof UserError) {
        if (error.getFirstErrorException()) return handleUserErrorException(error)
        skipValidators.value.length = 0
        timeAccountingData.value = undefined
        if (form.value?.formNode) {
          setErrors(form.value.formNode, error)
          return
        }
      }

      skipValidators.value.length = 0
      timeAccountingData.value = undefined
    })
    .finally(() => {
      disposeActiveMacro()
    })
}

const isArticleReplyDirty = () => {
  const articleNode = articleFormGroupNode.value
  if (!articleNode) return false

  const isFormDirty = articleNode.context?.state?.dirty ?? false
  const articleValues = articleNode.value as Record<string, unknown> | undefined

  if (!articleValues) return isFormDirty

  const bodyText =
    typeof articleValues.body === 'string' ? articleValues.body.replace(/<[^>]*>/g, '').trim() : ''

  const hasAttachments =
    Array.isArray(articleValues.attachments) && articleValues.attachments.length > 0

  return (bodyText.length > 0 || hasAttachments) && isFormDirty
}

const discardReplyForm = async () => {
  if (isArticleReplyDirty()) {
    const confirm = await waitForVariantConfirmation('unsaved')
    if (!confirm) return
  }

  newTicketArticlePresent.value = false

  await nextTick()

  // Reset only the article group.
  currentArticleType.value = undefined

  await nextTick()

  articleFormGroupNode.value?.reset(ticketArticleDefaultValues)

  formReset({
    values: {
      article: ticketArticleDefaultValues,
    },
  })

  return triggerFormUpdater()
}

const onEditFormSettled = () => {
  watch(
    () => flags.value.newArticlePresent,
    (newValue, oldValue) => {
      if (newTicketArticlePresent.value === newValue) return
      const oldNewTicketArticlePresent = newTicketArticlePresent.value

      newTicketArticlePresent.value = newValue ?? false

      if (oldNewTicketArticlePresent && oldValue !== undefined && oldValue && !newValue) {
        // Reset only the article group.
        currentArticleType.value = undefined

        nextTick(() => {
          articleFormGroupNode.value?.reset()
        })
      }
    },
    { immediate: true },
  )
}

const handleShowArticleForm = (
  articleType: string,
  performReply: AppSpecificTicketArticleType['performReply'],
) => openReplyForm({ articleType, ...performReply?.(ticket.value!) })
</script>

<template>
  <!-- Student Hub: the layout waits for the managers-only check (see isQueueLayout); the
       sidebar's side is fixed when LayoutContent is set up, hence the key. -->
  <LayoutContent
    v-if="isViewerLoaded"
    :key="isQueueLayout ? 'queue' : 'details-start'"
    name="ticket-detail"
    no-padding
    background-variant="primary"
    :show-sidebar="hasSidebar"
    :sidebar-position="isQueueLayout ? SidebarPosition.End : SidebarPosition.Start"
    :sidebar-width-name="isQueueLayout ? 'studenthub-ticket-panels' : undefined"
    content-alignment="center"
    no-scrollable
  >
    <!-- Student Hub: agents get the queue, then the conversation (panels in the sidebar column on
         the right); the others the conversation, then the sidebar icons and panels on the right -->
    <div class="sh-ticket-view flex size-full min-h-0">
      <StudenthubTicketQueue v-if="isQueueLayout" :queue="studenthubQueue" />
      <div
        ref="content-container"
        data-test-id="ticket-detail-content-container"
        class="@container isolate grid size-full min-w-0 overflow-y-auto overscroll-contain print:h-auto print:overflow-y-visible"
        :class="{
          'grid-rows-[0_max-content_max-content_max-content]':
            !hasStudenthubReplyBar && (!newTicketArticlePresent || !isReplyPinned),
          'grid-rows-[0_max-content_1fr_max-content]': newTicketArticlePresent && isReplyPinned,
          'grid-rows-[0_max-content_1fr_max-content_max-content]': hasStudenthubReplyBar,
        }"
      >
        <CommonIndicator v-model="isReachingTop" />

        <TicketDetailTopBarSkeleton v-if="!ticket" />
        <TicketDetailTopBar v-else :content-container-element="contentContainerElement" />

        <CommonLoader :loading="isLoadingArticles">
          <template #skeleton>
            <ArticleListSkeleton :article-count="ticket?.articleCount" />
          </template>

          <ArticleList
            ref="article-list"
            :is-loading-articles="isLoadingArticles"
            :scroll-container="contentContainerElement"
            :unread-article-ids="unreadArticleIds"
            @scroll-to-end="handleInitialScrollToEnd"
          />
        </CommonLoader>

        <CommonIndicator v-if="!newTicketArticlePresent" v-model="isReachingBottom" />

        <ArticleReply
          v-show="!isLoadingArticles && isInitialSettled"
          v-if="ticket?.id && isTicketEditable"
          v-model:pinned="isReplyPinned"
          class="print:hidden"
          :ticket="ticket"
          :ticket-article-types="ticketArticleTypes"
          :new-article-present="newTicketArticlePresent"
          :create-article-type="ticket.createArticleType?.name"
          :has-internal-article="hasInternalArticle"
          :parent-reached-bottom-scroll="isReachingBottom"
          @show-article-form="handleShowArticleForm"
          @discard-form="discardReplyForm"
        >
          <template #leading>
            <FloatingToolbar
              :ticket="ticket"
              :ticket-article-types="ticketArticleTypes"
              :is-reaching-top="isReachingTop"
              :is-reaching-bottom="isReachingBottom"
              :unread-article-count="articleCount"
              :new-article-present="newTicketArticlePresent"
              class="absolute inset-e-3 -top-3 -translate-y-full"
              @show-article-form="handleShowArticleForm"
              @scroll-to-end="handleScrollToArticleEnds('end', 'auto')"
              @scroll-to-start="handleScrollToArticleEnds('start', 'auto')"
              @scroll-to-unread-article="handleScrollToUnreadArticle"
            />
          </template>
        </ArticleReply>

        <CommonIndicator v-if="newTicketArticlePresent" v-model="isReachingBottom" />

        <div
          v-if="ticket && (!newTicketArticlePresent || !isReplyPinned)"
          class="sticky h-0 print:hidden"
          :class="hasStudenthubReplyBar ? 'bottom-20' : 'bottom-3'"
        >
          <FloatingToolbar
            :ticket="ticket"
            :ticket-article-types="ticketArticleTypes"
            :is-reaching-bottom="isReachingBottom"
            :is-reaching-top="isReachingTop"
            :unread-article-count="articleCount"
            :new-article-present="newTicketArticlePresent"
            class="absolute inset-e-3 bottom-0"
            @show-article-form="handleShowArticleForm"
            @scroll-to-end="handleScrollToArticleEnds('end', 'auto')"
            @scroll-to-start="handleScrollToArticleEnds('start', 'auto')"
            @scroll-to-unread-article="handleScrollToUnreadArticle"
          />
        </div>

        <div id="wrapper-form-ticket-edit" class="hidden" aria-hidden="true">
          <Form
            v-if="ticket?.id && initialTicketValue"
            :id="`form-ticket-edit-${internalId}`"
            ref="form"
            :form-id="currentTaskbarTabFormId"
            :schema="ticketEditSchema"
            :disabled="!isTicketEditable"
            :flatten-form-groups="['ticket']"
            :hidden-form-groups="hiddenFormGroups"
            :handlers="[articleTypeHandler(), signatureHandling('body')]"
            :form-kit-plugins="[articleTypeSelectHandler]"
            :schema-data="ticketEditSchemaData"
            :initial-values="initialTicketValue"
            :initial-entity-object="ticket"
            :form-updater-id="EnumFormUpdaterId.FormUpdaterUpdaterTicketEdit"
            :form-updater-additional-params="formAdditionalRouteQueryParams"
            use-object-attributes
            :schema-component-library="{
              Teleport: markRaw(Teleport) as unknown as Component,
            }"
            @submit="submitEditTicket($event as FormSubmitData<TicketUpdateFormData>)"
            @settled="onEditFormSettled"
          />
        </div>
      </div>
      <StudenthubTicketSideRail v-if="!!ticket && !isQueueLayout" :context="sidebarContext" />
    </div>
    <!-- Render underlying components only when the ticket is available to avoid providing undefined ticket context -->
    <template v-if="!!ticket" #sideBar>
      <TicketSidebar :context="sidebarContext" :studenthub-panel-column="isQueueLayout">
        <template #studenthubFooter>
          <StudenthubTicketSaveBar
            :can-use-draft="canUseDraft"
            :dirty="isDirty"
            :disabled="isDisabled"
            :form="form"
            :group-id="groupId"
            :is-ticket-agent="isTicketAgent"
            :is-ticket-editable="isTicketEditable"
            :has-available-draft="hasAvailableDraft"
            :live-user-list="liveUserList"
            :shared-draft-id="ticket?.sharedDraftZoomId"
            :ticket-id="ticketId"
            @submit="checkSubmitEditTicket"
            @discard="discardChanges"
            @execute-macro="executeMacro"
          />
        </template>
      </TicketSidebar>
    </template>

    <template v-if="!hasStudenthubSaveBar" #bottomBar>
      <TicketDetailBottomBar
        :can-use-draft="canUseDraft"
        :dirty="isDirty"
        :disabled="isDisabled"
        :form="form"
        :group-id="groupId"
        :is-ticket-agent="isTicketAgent"
        :is-ticket-editable="isTicketEditable"
        :has-available-draft="hasAvailableDraft"
        :live-user-list="liveUserList"
        :shared-draft-id="ticket?.sharedDraftZoomId"
        :ticket-id="ticketId"
        @submit="checkSubmitEditTicket"
        @discard="discardChanges"
        @execute-macro="executeMacro"
      />
    </template>
  </LayoutContent>
</template>
