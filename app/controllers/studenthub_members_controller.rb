# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub "Members": who of the agents and admins is online, and when each last signed in.
class StudenthubMembersController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/members
  def index
    render json: {
      online_window_minutes: Service::StudenthubMembers::List::ONLINE_WINDOW.in_minutes.to_i,
      members:               Service::StudenthubMembers::List.execute,
    }
  end
end
