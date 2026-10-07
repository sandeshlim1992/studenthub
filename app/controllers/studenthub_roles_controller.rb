# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: data for the new UI's Roles page. Saving uses Zammad's /api/v1/roles.
class StudenthubRolesController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/roles
  def index
    render json: Service::StudenthubRoles::Overview.execute(current_user:)
  end
end
