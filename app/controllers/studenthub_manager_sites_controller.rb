# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: sites (organisations) assigned to managers (Studenthub::ManagerSites): the admin
# page's list and changes, and the numbers for the manager dashboard.
class StudenthubManagerSitesController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/manager_sites
  def index
    render json: {
      organizations: Organization.where(active: true).sort_by { |organization| organization.name.downcase }.map { |organization| { id: organization.id, name: organization.name } },
      managers:      Studenthub::ManagerSites.assignments,
    }
  end

  # PUT /api/v1/studenthub/manager_sites/:user_id
  def update
    user = User.find(params[:user_id])
    render json: { user_id: user.id, organization_ids: Studenthub::ManagerSites.assign!(user, params[:organization_ids]) }
  rescue ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # GET /api/v1/studenthub/manager_sites/stats
  def stats
    render json: Service::StudenthubManagerSites::Stats.with_current_user(current_user).execute
  end
end
