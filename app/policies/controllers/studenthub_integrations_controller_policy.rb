# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::StudenthubIntegrationsControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! %i[secure_email update_secure_email], to: -> { "admin.integration.#{record.params[:kind]}" }
  permit! %i[exchange update_exchange], to: 'admin.integration.exchange'
end
