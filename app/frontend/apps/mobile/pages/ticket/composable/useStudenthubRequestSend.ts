// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { useFormUploadCacheAddMutation } from '#shared/components/Form/fields/FieldFile/graphql/mutations/uploadCache/add.api.ts'
import { useFormUploadCacheRemoveMutation } from '#shared/components/Form/fields/FieldFile/graphql/mutations/uploadCache/remove.api.ts'
import { useFormUpdaterLazyQuery } from '#shared/components/Form/graphql/queries/formUpdater.api.ts'
import type { FormFieldValue, FormSubmitData, FormValues } from '#shared/components/Form/types.ts'
import { useObjectAttributeFormData } from '#shared/entities/object-attributes/composables/useObjectAttributeFormData.ts'
import { useObjectAttributes } from '#shared/entities/object-attributes/composables/useObjectAttributes.ts'
import { useTicketCreateMutation } from '#shared/entities/ticket/graphql/mutations/create.api.ts'
import {
  EnumFormUpdaterId,
  EnumObjectManagerObjects,
  type TicketCreateInput,
} from '#shared/graphql/types.ts'
import { i18n } from '#shared/i18n.ts'
import MutationHandler from '#shared/server/apollo/handler/MutationHandler.ts'
import QueryHandler from '#shared/server/apollo/handler/QueryHandler.ts'
import { convertFileList } from '#shared/utils/files.ts'
import getUuid from '#shared/utils/getUuid.ts'
import { textToHtml } from '#shared/utils/helpers.ts'

// Student Hub: sends the request chat's ticket the way the new UI's wizard does (its own fields,
// the request form's fields and answers, Zammad's upload cache for files), through Zammad's ticket
// create mutation, so the server's checks are the same.

// Student Hub's category fields (Studenthub::RequestForms::CATEGORY_FIELD, SUB_CATEGORY_FIELD).
const CATEGORY_FIELD = 'category2'
const SUB_CATEGORY_FIELD = 'subcategory'
const CAMPUS_FIELD = 'campus'

export interface StudenthubRequest {
  category: string
  categoryName: string
  subCategory: string
  campus: string
  description: string
  fields: Record<string, unknown>
  requestAnswers?: { form_id?: number; answers: Record<string, unknown> }
  subject: string
}

export interface StudenthubRequestFile {
  id: string
  name: string
  size?: number | null
  type?: string | null
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The first message: the new UI wizard's Category and Campus lines, then what the student wrote.
// With a request form it is empty below the line: the server puts the answers there.
export const studenthubRequestBody = (request: StudenthubRequest) =>
  [
    `<p><strong>Category:</strong> ${escapeHtml(request.categoryName)} &gt; ${escapeHtml(request.subCategory)}</p>`,
    `<p><strong>Campus:</strong> ${escapeHtml(request.campus)}</p><hr/>`,
    request.description.trim() ? textToHtml(request.description) : '',
  ].join('')

interface GroupField {
  value?: unknown
  initialValue?: unknown
  options?: { value: unknown }[]
}

export const useStudenthubRequestSend = () => {
  // One upload cache per chat, as one per form.
  const formId = getUuid()
  const files = ref<StudenthubRequestFile[]>([])
  const isUploading = ref(false)

  const { attributesLookup } = useObjectAttributes(EnumObjectManagerObjects.Ticket)
  const addFiles = new MutationHandler(useFormUploadCacheAddMutation({}))
  const removeFiles = new MutationHandler(useFormUploadCacheRemoveMutation({}))
  const formUpdater = new QueryHandler(useFormUpdaterLazyQuery())
  const ticketCreate = new MutationHandler(useTicketCreateMutation({}), {
    errorShowNotification: false,
  })

  const attach = async (fileList: FileList | File[]) => {
    isUploading.value = true
    try {
      const uploads = await convertFileList(fileList)
      const data = await addFiles.send({ formId, files: uploads })
      files.value = [...files.value, ...(data?.formUploadCacheAdd?.uploadedFiles ?? [])]
    } finally {
      isUploading.value = false
    }
  }

  const detach = async (file: StudenthubRequestFile) => {
    await removeFiles.send({ formId, fileIds: [file.id] })
    files.value = files.value.filter((entry) => entry.id !== file.id)
  }

  // The group Zammad's own ticket form gives a student for these answers (its value, else its
  // first choice), as the new UI's wizard takes it.
  const group = async (values: Record<string, unknown>) => {
    const result = await formUpdater.query({
      variables: {
        formUpdaterId: EnumFormUpdaterId.FormUpdaterUpdaterTicketCreate,
        meta: { initial: true, formId },
        data: values,
        relationFields: [{ name: 'group_id', relation: 'group' }],
      },
      fetchPolicy: 'network-only',
    })
    const field = (result.data?.formUpdater?.fields as Record<string, GroupField> | undefined)
      ?.group_id

    return field?.value ?? field?.initialValue ?? field?.options?.[0]?.value
  }

  const send = async (request: StudenthubRequest) => {
    const values = {
      [CATEGORY_FIELD]: request.category,
      [SUB_CATEGORY_FIELD]: request.subCategory,
      [CAMPUS_FIELD]: request.campus,
      ...request.fields,
    } as FormValues
    const groupId = (await group(values)) as FormFieldValue | undefined
    if (!groupId) throw new Error(i18n.t('Your request could not be sent. Please try again.'))

    const { internalObjectAttributeValues, additionalObjectAttributeValues } =
      useObjectAttributeFormData(EnumObjectManagerObjects.Ticket, attributesLookup.value, {
        ...values,
        title: request.subject,
        group_id: groupId,
      } as FormSubmitData)

    const input = {
      ...internalObjectAttributeValues,
      article: {
        body: studenthubRequestBody(request),
        type: 'web',
        sender: 'Customer',
        contentType: 'text/html',
        attachments: files.value.length
          ? { formId, files: files.value.map(({ name, type }) => ({ name, type })) }
          : undefined,
        preferences: request.requestAnswers
          ? { studenthub_request_answers: request.requestAnswers }
          : undefined,
      },
      objectAttributeValues: additionalObjectAttributeValues,
    } as TicketCreateInput

    const result = await ticketCreate.send({ input })
    const ticket = result?.ticketCreate?.ticket
    if (!ticket) {
      const message = result?.ticketCreate?.errors?.[0]?.message
      throw new Error(
        message ? i18n.t(message) : i18n.t('Your request could not be sent. Please try again.'),
      )
    }

    return ticket
  }

  return { formId, files, isUploading, attach, detach, send }
}
