# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: which overview belongs to which group of the new UI's views panel, and how the
# agent groups and sorts each view (Studenthub::TicketViews::Choice).
class StudenthubTicketViewsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  rescue_from ArgumentError do |e|
    render json: { error: e.message }, status: :unprocessable_content
  end

  # GET /api/v1/studenthub/ticket_views
  def index
    render json: Studenthub::TicketViews.sections_for(current_user)
  end

  # GET /api/v1/studenthub/ticket_views/:overview_id/choice
  def choice
    render json: choice_payload
  end

  # PUT /api/v1/studenthub/ticket_views/:overview_id/choice (group_by, order_by, order_direction)
  def update_choice
    Studenthub::TicketViews::Choice.save!(
      current_user, overview!,
      group_by:        params.key?(:group_by) ? params[:group_by].to_s : nil,
      order_by:        params[:order_by].presence,
      order_direction: order_direction_param,
    )
    render json: choice_payload
  end

  # DELETE /api/v1/studenthub/ticket_views/:overview_id/choice: back to the view's defaults
  def reset_choice
    Studenthub::TicketViews::Choice.reset!(current_user, overview!)
    render json: choice_payload
  end

  private

  # The new UI sends GraphQL's ASCENDING / DESCENDING.
  def order_direction_param
    direction = params[:order_direction].to_s.upcase
    { 'ASCENDING' => 'ASC', 'DESCENDING' => 'DESC' }.fetch(direction, direction).presence
  end

  # Only views the agent has (Zammad checks roles and users of the overview).
  def overview!
    @overview ||= Ticket::Overviews.all(current_user: current_user).find { |overview| overview.id == params[:overview_id].to_i } ||
                  raise(Exceptions::Forbidden)
  end

  def choice_payload
    choice   = Studenthub::TicketViews::Choice
    overview = overview!

    {
      group_by:         choice.group_by(current_user, overview).to_s,
      order_by:         choice.order_by(current_user, overview),
      order_direction:  choice.order_direction(current_user, overview),
      default_group_by: overview.group_by.to_s,
      customised:       choice.for(current_user, overview).present?,
      grouping_options: choice.grouping_options,
    }
  end
end
