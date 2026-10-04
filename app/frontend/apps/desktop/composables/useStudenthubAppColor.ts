// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { watch } from 'vue'

import { useApplicationStore } from '#shared/stores/application.ts'

import { applyStudenthubAppColor } from '#desktop/utils/studenthubAppColor.ts'

// Keeps the --sh-app CSS variable in step with the admin setting, including live
// updates when an admin changes it while others have the app open.
export const useStudenthubAppColor = () => {
  const application = useApplicationStore()

  watch(
    () => application.config.studenthub_app_color,
    (value) => applyStudenthubAppColor(value),
    { immediate: true },
  )
}
