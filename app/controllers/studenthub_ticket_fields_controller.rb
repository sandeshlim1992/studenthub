# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: data for the new UI's Ticket States, Ticket Priorities and Tags pages. Changes go
# through Zammad's own APIs; only the "new tags" setting is switched here.
class StudenthubTicketFieldsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/ticket_states
  def states
    render json: Service::StudenthubTicketFields::States.execute
  end

  # GET /api/v1/studenthub/ticket_priorities
  def priorities
    render json: Service::StudenthubTicketFields::Priorities.execute
  end

  # GET /api/v1/studenthub/tag_settings
  def tag_settings
    render json: { tag_new: Setting.get('tag_new') == true }
  end

  # PUT /api/v1/studenthub/tag_settings { tag_new: true|false }
  def update_tag_settings
    Setting.set('tag_new', ActiveModel::Type::Boolean.new.cast(params[:tag_new]) == true)

    tag_settings
  end
end
