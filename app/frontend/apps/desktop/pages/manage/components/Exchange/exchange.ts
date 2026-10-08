// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the new UI's Exchange page (GET/PUT /api/v1/studenthub/integrations/exchange plus
// Zammad's /api/v1/integration/exchange/... wizard steps).

export const EXCHANGE_ONLINE_ENDPOINT = 'https://outlook.office365.com/EWS/Exchange.asmx'

// What the classic wizard suggests.
export const EXCHANGE_DEFAULT_ATTRIBUTES: Record<string, string> = {
  given_name: 'firstname',
  surname: 'lastname',
  'email_addresses.emailaddress1': 'email',
  'phone_numbers.businessphone': 'phone',
}

export interface ExchangeConfig {
  auth_type?: 'oauth' | 'basic'
  endpoint?: string
  user?: string
  password?: string
  disable_ssl_verify?: boolean
  folders?: string[]
  attributes?: Record<string, string>
}

export interface ExchangeSettings {
  enabled: boolean
  config: ExchangeConfig
  app: { id: number; client_id: string; client_tenant: string | null } | null
  account: { user: string; connected_at: string } | null
  callback_url: string
  user_attributes: { name: string; display: string }[]
}

export interface ExchangeJob {
  started_at?: string | null
  finished_at?: string | null
  result?: {
    sum?: number
    total?: number
    created?: number
    updated?: number
    unchanged?: number
    skipped?: number
    failed?: number
    error?: string
  } | null
}

export interface AttributeRow {
  uid: number
  source: string
  dest: string
}

let nextUid = 1

export const newAttributeRow = (source = '', dest = ''): AttributeRow => ({ uid: nextUid++, source, dest })

export const toAttributeRows = (map?: Record<string, string>) =>
  Object.entries(map ?? {}).map(([source, dest]) => newAttributeRow(source, dest))

export const fromAttributeRows = (rows: AttributeRow[]) =>
  Object.fromEntries(rows.filter((row) => row.source && row.dest).map((row) => [row.source, row.dest]))

// ?result= after the Microsoft 365 sign-in (Studenthub::ExchangeReturn).
export const exchangeResultMessage = (result: unknown) => {
  if (typeof result !== 'string' || !result) return null
  if (result.startsWith('success')) return { ok: true, text: __('The Microsoft 365 account is connected.') }
  if (result.includes('AADSTS65004'))
    return { ok: false, text: __('Microsoft 365 needs an administrator to consent to the app first.') }
  return { ok: false, text: __('Connecting the Microsoft 365 account failed.') }
}
