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

  # GET /api/v1/ticket_approval/viewer
  def viewer
    render json: {
      enabled:      Studenthub::TicketApproval.enabled?,
      manager_only: Studenthub::TicketApproval.manager_only?(current_user),
    }
  end

  # GET /api/v1/ticket_approval/managers
  # For "Send for approval" on the New ticket screen: every manager, whatever the team (the
  # ticket waits in the Managers group, where the chosen manager can open it).
  def managers
    render json: {
      enabled:  Studenthub::TicketApproval.enabled?,
      managers: Studenthub::TicketApproval.managers.where.not(id: current_user.id).map { |user| { id: user.id, name: user.fullname } },
    }
  end

  # GET /api/v1/ticket_approval/dashboard
  def dashboard
    render json: Service::TicketApproval::Dashboard.with_current_user(current_user).execute
  end

  # GET /api/v1/ticket_approval/settings
  def settings
    render json: settings_payload
  end

  # PUT /api/v1/ticket_approval/settings
  def update_settings
    Setting.set('ticket_approval_pause_sla', boolean_param(:pause_sla)) if params.key?(:pause_sla)
    switch_feature(boolean_param(:enabled)) if params.key?(:enabled)
    render json: settings_payload
  end

  private

  def boolean_param(name)
    ActiveModel::Type::Boolean.new.cast(params[name]) == true
  end

  # On: the Managers group is set up as the waiting group. Off: waiting tickets go back to
  # their teams, so none is left where nobody can open it.
  def switch_feature(enabled)
    return if enabled == Studenthub::TicketApproval.enabled?

    if enabled
      Setting.set('ticket_approval', true)
      Studenthub::TicketApproval::WaitingGroup.ensure!
    else
      Ticket.where(id: TicketApproval.pending.select(:ticket_id)).find_each do |ticket|
        Service::TicketApproval::Cancel.with_current_user(current_user).execute(ticket:, turned_off: true)
      end
      Setting.set('ticket_approval', false)
    end
    Studenthub::TicketApproval::Setup.sync_overviews(enabled)
  end

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
      pause_sla: Studenthub::TicketApproval.pause_sla?,
      group:     Studenthub::TicketApproval::WaitingGroup.group&.then { |group| { id: group.id, name: group.name } },
      role:      manager_role && { id: manager_role.id, name: manager_role.name, active: manager_role.active },
      managers:  Studenthub::TicketApproval.managers.map { |user| { id: user.id, name: user.fullname, email: user.email } },
      overviews: Overview.where(link: Studenthub::TicketApproval::Setup::OVERVIEW_LINKS).map { |overview| { name: overview.name, link: overview.link, active: overview.active } },
      pending:   Ticket.where(approval_state: 'pending').count,
    }
  end
end
