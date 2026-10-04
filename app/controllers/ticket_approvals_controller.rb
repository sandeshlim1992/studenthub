# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Ticket Approvals: the ticket sidebar's Approval tab and the admin on/off switch.
class TicketApprovalsController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  rescue_from Service::TicketApproval::Base::Error do |e|
    render json: { error: e.message }, status: :unprocessable_content
  end

  # GET /api/v1/tickets/:ticket_id/approval
  def show
    render json: Service::TicketApproval::Status.with_current_user(current_user).execute(ticket: ticket!)
  end

  # POST /api/v1/tickets/:ticket_id/approval
  def create
    Service::TicketApproval::Request.with_current_user(current_user).execute(
      ticket:   ticket!,
      approver: User.find_by(id: params[:approver_id]),
      reason:   params[:reason],
    )
    show
  end

  # POST /api/v1/tickets/:ticket_id/approval/approve
  def approve
    decide('approved')
  end

  # POST /api/v1/tickets/:ticket_id/approval/deny
  def deny
    decide('denied')
  end

  # DELETE /api/v1/tickets/:ticket_id/approval
  def destroy
    Service::TicketApproval::Cancel.with_current_user(current_user).execute(ticket: ticket!)
    show
  end

  # GET /api/v1/ticket_approval/settings
  def settings
    render json: settings_payload
  end

  # PUT /api/v1/ticket_approval/settings
  def update_settings
    enabled = ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true
    Setting.set('ticket_approval', enabled)
    Studenthub::TicketApproval::Setup.sync_overviews(enabled)
    render json: settings_payload
  end

  private

  def ticket!
    @ticket ||= Ticket.find(params[:ticket_id]).tap { |ticket| authorize!(ticket, :show?) }
  end

  def decide(decision)
    Service::TicketApproval::Decide.with_current_user(current_user).execute(ticket: ticket!, decision:, comment: params[:comment])
    show
  end

  def settings_payload
    manager_role = Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)

    {
      enabled:   Studenthub::TicketApproval.enabled?,
      role:      manager_role && { id: manager_role.id, name: manager_role.name, active: manager_role.active, groups: manager_role.group_names_access_map },
      managers:  Studenthub::TicketApproval.managers.map { |user| { id: user.id, name: user.fullname, email: user.email } },
      overviews: Overview.where(link: Studenthub::TicketApproval::Setup::OVERVIEW_LINKS).map { |overview| { name: overview.name, link: overview.link, active: overview.active } },
      pending:   Ticket.where(approval_state: 'pending').count,
    }
  end
end
