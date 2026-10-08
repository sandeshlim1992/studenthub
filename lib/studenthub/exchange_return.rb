# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: after signing in to Microsoft 365 for the Exchange integration, Zammad sends the admin
# back to the classic UI's Exchange page. Staff work in the new UI, so this sends them to its Exchange
# page instead, with the outcome ("success/1" or "error/<code>") as ?result=.
module Studenthub::ExchangeReturn
  CLASSIC_PAGE = '/#system/integration/exchange/'.freeze
  NEW_UI_PAGE  = '/desktop/manage/system/integrations/exchange'.freeze

  def link_account(...)
    url = super
    return url if !url.is_a?(String) || url.exclude?(CLASSIC_PAGE)

    base, result = url.split(CLASSIC_PAGE, 2)
    "#{base}#{NEW_UI_PAGE}?result=#{CGI.escape(result.to_s)}"
  end
end
