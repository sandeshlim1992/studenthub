# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: data for the new UI's dashboards. The team overview is for admins; the activity
# list is for every staff member (agents' "Briefing" and the admins' overview).
class StudenthubDashboardController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/dashboard/overview
  def overview
    render json: Service::StudenthubDashboard::Overview.with_current_user(current_user).execute
  end

  # GET /api/v1/studenthub/dashboard/activity
  def activity
    render json: { items: Service::StudenthubDashboard::Activity.with_current_user(current_user).execute }
  end
end
