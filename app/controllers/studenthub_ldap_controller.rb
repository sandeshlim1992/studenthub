# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the new UI's LDAP page. Servers are set up with Zammad's own API
# (/api/v1/integration/ldap/* and /api/v1/ldap_sources), like the classic wizard.
class StudenthubLdapController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/ldap
  def show
    render json: Service::StudenthubLdap::Options.execute
  end

  # PUT /api/v1/studenthub/ldap { enabled: true|false }
  def update
    Setting.set('ldap_integration', ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true)

    render json: Service::StudenthubLdap::Options.execute
  end
end
