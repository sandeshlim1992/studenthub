<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useTemplateRef, toRef } from 'vue'

import CommonAvatar from '#shared/components/CommonAvatar/CommonAvatar.vue'
import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { useTouchDevice } from '#shared/composables/useTouchDevice.ts'
import { useUserCurrentAvatarAddMutation } from '#shared/entities/user/current/graphql/mutations/userCurrentAvatarAdd.api.ts'
import { useUserCurrentAvatarDeleteMutation } from '#shared/entities/user/current/graphql/mutations/userCurrentAvatarDelete.api.ts'
import type {
  UserCurrentAvatarUpdatesSubscriptionVariables,
  UserCurrentAvatarUpdatesSubscription,
  Avatar,
  UserCurrentAvatarListQuery,
} from '#shared/graphql/types.ts'
import { getApolloClient } from '#shared/server/apollo/client.ts'
import MutationHandler from '#shared/server/apollo/handler/MutationHandler.ts'
import QueryHandler from '#shared/server/apollo/handler/QueryHandler.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import type { ImageFileData } from '#shared/utils/files.ts'
import { convertFileList, allowedImageTypesString } from '#shared/utils/files.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonDivider from '#desktop/components/CommonDivider/CommonDivider.vue'
import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

import PersonalSettingAvatarSkeleton from '../components/PersonalSettingAvatarSkeleton.vue'
import { useBreadcrumb } from '../composables/useBreadcrumb.ts'
import { usePersonalSettingTabs } from '../composables/usePersonalSettingTabs.ts'
import { useUserCurrentAvatarSelectMutation } from '../graphql/mutations/userCurrentAvatarSelect.api.ts'
import {
  useUserCurrentAvatarListQuery,
  UserCurrentAvatarListDocument,
} from '../graphql/queries/userCurrentAvatarList.api.ts'
import { UserCurrentAvatarUpdatesDocument } from '../graphql/subscriptions/userCurrentAvatarUpdates.api.ts'

import type { ApolloCache, NormalizedCacheObject } from '@apollo/client/core'

const user = toRef(useSessionStore(), 'user')
const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

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

const { breadcrumbItems } = useBreadcrumb(__('Avatar'))

const { notify } = useNotifications()

const application = useApplicationStore()
const apiUrl = String(application.config.api_path)

const { isTouchDevice } = useTouchDevice()

const avatarListQuery = new QueryHandler(useUserCurrentAvatarListQuery())
const avatarListQueryResult = avatarListQuery.result()
const avatarListQueryLoading = avatarListQuery.loadingWithoutCachedResult()

avatarListQuery.subscribeToMore<
  UserCurrentAvatarUpdatesSubscriptionVariables,
  UserCurrentAvatarUpdatesSubscription
>({
  document: UserCurrentAvatarUpdatesDocument,
  updateQuery: (_, { subscriptionData }) => {
    if (!subscriptionData.data?.userCurrentAvatarUpdates.avatars) {
      return null as unknown as UserCurrentAvatarListQuery
    }

    return {
      userCurrentAvatarList: subscriptionData.data.userCurrentAvatarUpdates.avatars,
    }
  },
})

const currentAvatars = computed(() => {
  return avatarListQueryResult.value?.userCurrentAvatarList || []
})

const currentDefaultAvatar = computed(() => {
  return currentAvatars.value.find((avatar) => avatar.default)
})

const fileUploadElement = useTemplateRef('file-upload')

const cameraFlyout = useFlyout({
  name: 'avatar-camera-capture',
  component: () => import('../components/PersonalSettingAvatarCameraFlyout.vue'),
})

const cropImageFlyout = useFlyout({
  name: 'avatar-file-upload',
  component: () => import('../components/PersonalSettingAvatarCropImageFlyout.vue'),
})

const modifyDefaultAvatarCache = (
  cache: ApolloCache<NormalizedCacheObject>,
  avatar: Avatar | undefined,
  newValue: boolean,
) => {
  if (!avatar) return

  cache.modify({
    id: cache.identify(avatar),
    fields: {
      default() {
        return newValue
      },
    },
  })
}

const storeAvatar = (image: ImageFileData) => {
  if (!image) return

  const addAvatarMutation = new MutationHandler(
    useUserCurrentAvatarAddMutation({
      variables: {
        images: {
          original: image,
          resized: {
            name: 'resized_avatar.png',
            type: 'image/png',
            content: image.content,
          },
        },
      },
      update: (cache, { data }) => {
        if (!data) return

        const { userCurrentAvatarAdd } = data
        if (!userCurrentAvatarAdd?.avatar) return

        const newIdPresent = currentAvatars.value.find((avatar) => {
          return avatar.id === userCurrentAvatarAdd.avatar?.id
        })
        if (newIdPresent) return

        modifyDefaultAvatarCache(cache, currentDefaultAvatar.value, false)

        let existingAvatars = cache.readQuery<UserCurrentAvatarListQuery>({
          query: UserCurrentAvatarListDocument,
        })

        existingAvatars = {
          ...existingAvatars,
          userCurrentAvatarList: [
            ...(existingAvatars?.userCurrentAvatarList || []),
            userCurrentAvatarAdd.avatar,
          ],
        }

        cache.writeQuery({
          query: UserCurrentAvatarListDocument,
          data: existingAvatars,
        })
      },
    }),
    {
      errorNotificationMessage: __('The avatar could not be uploaded.'),
    },
  )

  addAvatarMutation.send().then((data) => {
    if (data?.userCurrentAvatarAdd?.avatar) {
      if (user.value) {
        user.value.image = data.userCurrentAvatarAdd.avatar.imageHash
      }

      notify({
        id: 'avatar-upload-success',
        type: NotificationTypes.Success,
        message: __('Your avatar has been uploaded.'),
      })
    }
  })
}

const addAvatarByUpload = () => {
  fileUploadElement.value?.click()
}

const addAvatarByCamera = () => {
  cameraFlyout.open({
    onAvatarCaptured: (image: ImageFileData) => {
      storeAvatar(image)
    },
  })
}

const loadAvatar = async (input: HTMLInputElement | null) => {
  const files = input?.files
  if (!files) return

  const [avatar] = await convertFileList(files)

  cropImageFlyout.open({
    image: avatar,
    onImageCropped: (image: ImageFileData) => storeAvatar(image),
  })

  // Reset input value to allow selecting the same file again
  input.value = ''
}

const selectAvatar = (avatar: Avatar) => {
  // Update the cache already before the
  const { cache } = getApolloClient()
  const oldDefaultAvatar = currentDefaultAvatar.value

  modifyDefaultAvatarCache(cache, oldDefaultAvatar, false)
  modifyDefaultAvatarCache(cache, avatar, true)

  const accountAvatarSelectMutation = new MutationHandler(
    useUserCurrentAvatarSelectMutation(() => ({
      variables: { id: avatar.id },
    })),
    {
      errorNotificationMessage: __('The avatar could not be selected.'),
    },
  )

  accountAvatarSelectMutation
    .send()
    .then(() => {
      notify({
        id: 'avatar-select-success',
        type: NotificationTypes.Success,
        message: __('Your avatar has been changed.'),
      })
    })
    .catch(() => {
      // Reset the cache again if the mutation fails.
      modifyDefaultAvatarCache(cache, oldDefaultAvatar, true)
      modifyDefaultAvatarCache(cache, avatar, false)
    })
}

const deleteAvatar = (avatar: Avatar) => {
  const accountAvatarDeleteMutation = new MutationHandler(
    useUserCurrentAvatarDeleteMutation(() => ({
      variables: { id: avatar.id },
      update(cache) {
        if (avatar.default) {
          modifyDefaultAvatarCache(cache, currentAvatars.value[0], true)
        }

        cache.evict({ id: cache.identify(avatar) })
        cache.gc()
      },
    })),
    {
      errorNotificationMessage: __('The avatar could not be deleted.'),
    },
  )

  accountAvatarDeleteMutation.send().then(() => {
    notify({
      id: 'avatar-delete-success',
      type: NotificationTypes.Success,
      message: __('Your avatar has been deleted.'),
    })
  })
}

const { waitForVariantConfirmation } = useConfirmation()

const confirmDeleteAvatar = async (avatar: Avatar) => {
  const confirmed = await waitForVariantConfirmation('delete')

  if (confirmed) deleteAvatar(avatar)
}

const avatarButtonClasses = [
  'cursor-pointer',
  'outline-transparent',
  'hover:outline-blue-900',
  'rounded-full',
  'outline',
  'outline-3',
  'focus:outline-blue-800',
  'hover:focus:outline-blue-800',
]

const activeAvatarButtonClass = (active: boolean) => {
  return {
    'outline-blue-800 hover:outline-blue-800': active,
  }
}

const { tabs, activeTab } = usePersonalSettingTabs()
</script>

<template>
  <!-- Hidden File Input for Image Uploading (shared by Customer & Agent views) -->
  <input
    ref="file-upload"
    :accept="allowedImageTypesString()"
    aria-hidden="true"
    class="hidden"
    data-test-id="fileUploadInput"
    type="file"
    @change="loadAvatar(fileUploadElement)"
  />

  <!-- CUSTOMER REDESIGNED AVATAR VIEW -->
  <div v-if="isCustomer" class="max-w-3xl space-y-6">
    <!-- Header & Breadcrumb -->
    <div>
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
        <router-link to="/" class="hover:text-slate-600 transition-colors">{{ $t('Dashboard') }}</router-link>
        <span>/</span>
        <span class="text-slate-600">{{ $t('Settings') }}</span>
        <span>/</span>
        <span class="text-[#15803d] font-bold">{{ $t('Avatar') }}</span>
      </div>
      <h1 class="text-2xl font-black text-slate-900 tracking-tight">
        {{ $t('Profile Avatar') }}
      </h1>
      <p class="text-sm text-slate-500 mt-1">
        {{ $t('Manage the profile picture and initials that represent you in the Student Support Portal.') }}
      </p>
    </div>

    <!-- Active Avatar Hero Card -->
    <div class="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs">
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <!-- Big Avatar Preview -->
        <div class="relative shrink-0">
          <div
            class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden ring-4 ring-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center bg-slate-100 shadow-md"
          >
            <!-- If default avatar is custom image -->
            <img
              v-if="currentDefaultAvatar?.imageHash"
              :src="`${apiUrl}/users/image/${currentDefaultAvatar.imageHash}`"
              alt="Profile Avatar"
              class="w-full h-full object-cover"
            />
            <!-- If default avatar is initials -->
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-amber-400 text-slate-900 font-extrabold text-3xl sm:text-4xl select-none"
            >
              {{ userInitial }}
            </div>
          </div>
          <!-- Active Badge Pin -->
          <div class="absolute -bottom-2 ltr:-right-2 rtl:-left-2 bg-[#16a34a] text-white p-1 rounded-full ring-2 ring-white shadow-xs">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <!-- Details & Active Status -->
        <div class="flex-1 text-center sm:text-left">
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
            <h2 class="text-lg font-extrabold text-slate-900">
              {{ userDisplayName }}
            </h2>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#15803d] border border-emerald-200/70">
              <span class="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
              {{ $t('Active Avatar') }}
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-lg">
            {{ $t('This avatar is displayed on all tickets, replies, and status notifications visible to the support team.') }}
          </p>

          <!-- Quick Action Buttons -->
          <div class="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer"
              @click="addAvatarByUpload"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{{ $t('Upload New Photo') }}</span>
            </button>

            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer"
              @click="addAvatarByCamera"
            >
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{{ $t('Use Camera') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Avatar Gallery / Selection Card -->
    <div class="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900">
            {{ $t('Saved Avatars') }}
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ $t('Click on any avatar below to make it your active profile picture.') }}
          </p>
        </div>
        <span class="text-xs font-semibold text-slate-400">
          {{ currentAvatars.length }} {{ $t('available') }}
        </span>
      </div>

      <!-- Avatar Grid -->
      <div class="flex flex-wrap gap-4 pt-2">
        <template v-for="avatar in currentAvatars" :key="avatar.id">
          <!-- Initials Avatar Option -->
          <div
            v-if="avatar.initial && user"
            class="relative group cursor-pointer"
            role="button"
            :tabindex="0"
            :aria-label="$t('Select initials avatar')"
            @click="avatar.default ? void 0 : selectAvatar(avatar)"
            @keydown.enter="avatar.default ? void 0 : selectAvatar(avatar)"
          >
            <div
              class="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center font-extrabold text-lg select-none transition-all duration-150"
              :class="
                avatar.default
                  ? 'ring-3 ring-[#16a34a] ring-offset-2 scale-105 shadow-md bg-amber-400 text-slate-950'
                  : 'bg-amber-300/80 text-slate-800 ring-1 ring-slate-200 hover:ring-2 hover:ring-slate-400 hover:scale-102'
              "
            >
              {{ userInitial }}
            </div>
            <!-- Checkmark badge if default -->
            <div
              v-if="avatar.default"
              class="absolute -top-1.5 ltr:-right-1.5 rtl:-left-1.5 bg-[#16a34a] text-white p-0.5 rounded-full ring-2 ring-white"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <!-- Image Avatar Option -->
          <div
            v-else-if="avatar.imageHash"
            class="relative group cursor-pointer"
            role="button"
            :tabindex="0"
            :aria-label="$t('Select image avatar')"
            @click="avatar.default ? void 0 : selectAvatar(avatar)"
            @keydown.enter="avatar.default ? void 0 : selectAvatar(avatar)"
          >
            <div
              class="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 transition-all duration-150"
              :class="
                avatar.default
                  ? 'ring-3 ring-[#16a34a] ring-offset-2 scale-105 shadow-md'
                  : 'ring-1 ring-slate-200 hover:ring-2 hover:ring-slate-400 hover:scale-102'
              "
            >
              <img
                :src="`${apiUrl}/users/image/${avatar.imageHash}`"
                alt="Avatar option"
                class="w-full h-full object-cover"
              />
            </div>

            <!-- Checkmark badge if default -->
            <div
              v-if="avatar.default"
              class="absolute -top-1.5 ltr:-right-1.5 rtl:-left-1.5 bg-[#16a34a] text-white p-0.5 rounded-full ring-2 ring-white"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <!-- Delete Button on Hover -->
            <button
              v-if="avatar.deletable"
              type="button"
              class="absolute -bottom-1.5 ltr:-right-1.5 rtl:-left-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center ring-2 ring-white shadow-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              :title="$t('Delete this avatar')"
              @click.stop="confirmDeleteAvatar(avatar)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </template>
      </div>

      <!-- Helper tip -->
      <div class="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
        <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ $t('Supported formats: PNG, JPG, GIF, WebP. Maximum file size: 5MB.') }}</span>
      </div>
    </div>
  </div>

  <!-- AGENT UNTOUCHED AVATAR VIEW -->
  <LayoutContent
    v-else
    :active-tab="activeTab"
    :tabs="tabs"
    :breadcrumb-items="breadcrumbItems"
    width="narrow"
  >
    <CommonLoader :loading="avatarListQueryLoading">
      <template #skeleton>
        <PersonalSettingAvatarSkeleton />
      </template>

      <div class="mb-4">
        <CommonLabel class="mt-0.5! mb-1 block!">{{ $t('Your avatar') }} </CommonLabel>

        <div class="rounded-lg bg-blue-200 dark:bg-gray-700">
          <div class="flex flex-row flex-wrap gap-2.5 p-2.5">
            <template v-for="avatar in currentAvatars" :key="avatar.id">
              <button
                v-if="avatar.initial && user"
                :aria-label="$t('Select this avatar')"
                :class="[...avatarButtonClasses, activeAvatarButtonClass(avatar.default)]"
                @click.stop="avatar.default ? void 0 : selectAvatar(avatar)"
              >
                <CommonUserAvatar
                  :class="{ 'avatar-selected': avatar.default }"
                  :entity="user"
                  class="flex! border-neutral-100 dark:border-gray-900"
                  size="large"
                  initials-only
                  personal
                  no-indicator
                  no-muted
                />
              </button>
              <div v-else-if="avatar.imageHash" class="group/avatar relative flex">
                <button
                  :aria-label="$t('Select this avatar')"
                  :class="[...avatarButtonClasses, activeAvatarButtonClass(avatar.default)]"
                  @click.stop="avatar.default ? void 0 : selectAvatar(avatar)"
                >
                  <CommonAvatar
                    :class="{ 'avatar-selected': avatar.default }"
                    :image="`${apiUrl}/users/image/${avatar.imageHash}`"
                    class="flex! border-neutral-100 dark:border-gray-900"
                    size="large"
                  >
                  </CommonAvatar>
                </button>
                <CommonButton
                  v-if="avatar.deletable"
                  v-tooltip="$t('Delete this avatar')"
                  :class="{ 'opacity-0 transition-opacity': !isTouchDevice }"
                  class="absolute -inset-e-2 -top-1 text-white group-hover/avatar:opacity-100 focus:opacity-100"
                  icon="x-lg"
                  size="small"
                  variant="remove"
                  @click.stop="confirmDeleteAvatar(avatar)"
                />
              </div>
            </template>
          </div>

          <CommonDivider padding />

          <div class="w-full p-1 text-center">
            <CommonButton class="m-1" size="medium" prefix-icon="image" @click="addAvatarByUpload">
              {{ $t('Upload') }}
            </CommonButton>

            <CommonButton class="m-1" size="medium" prefix-icon="camera" @click="addAvatarByCamera">
              {{ $t('Camera') }}
            </CommonButton>
          </div>
        </div>
      </div>
    </CommonLoader>
  </LayoutContent>
</template>
