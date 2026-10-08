# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: settings behind the new UI's S/MIME, PGP and Exchange pages. Certificates, keys and
# the Exchange wizard use Zammad's own integration API.
class StudenthubIntegrationsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/integrations/:kind (smime, pgp)
  def secure_email
    render json: Service::StudenthubSecureEmail::Settings.execute(kind: params[:kind])
  end

  # PUT /api/v1/studenthub/integrations/:kind { enabled, sign_system_notifications, groups: [{ id, sign, encryption }] }
  def update_secure_email
    changes = params.permit(:enabled, :sign_system_notifications, groups: %i[id sign encryption]).to_h
    render json: Service::StudenthubSecureEmail::Settings.execute(kind: params[:kind], changes:)
  end

  # GET /api/v1/studenthub/integrations/exchange
  def exchange
    render json: Service::StudenthubExchange::Settings.execute
  end

  # PUT /api/v1/studenthub/integrations/exchange { enabled, config: { … } }
  def update_exchange
    changes = params.permit(:enabled, config: [:auth_type, :endpoint, :user, :password, :disable_ssl_verify, { folders: [], attributes: {} }]).to_h
    render json: Service::StudenthubExchange::Settings.execute(changes:)
  end
end
