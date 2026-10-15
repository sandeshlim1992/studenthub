# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: choices for the condition and action editors of the new UI (Scheduler, Triggers,
# Macros, Templates, SLAs, Report Profiles, Time Accounting). The records are saved through Zammad's
# own API (/api/v1/jobs, /api/v1/triggers, …); the tickets, users or organisations matching a
# condition are counted with /api/v1/<tickets|users|organizations>/selector.
class StudenthubAutomationController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/automation/options
  def options
    render json: Service::StudenthubAutomation::Options.execute
  end
end
