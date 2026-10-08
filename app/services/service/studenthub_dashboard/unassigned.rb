# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: unassigned tickets in each of the user's teams, for the agents' dashboard. One entry
# per group the user can read (the groups of their Teams views), without the Managers group where
# approvals wait. Unassigned and open mean what the Teams views show first ("Unassigned tickets").
class Service::StudenthubDashboard::Unassigned < Service::Base
  requires_current_user!

  OLDEST = 3

  def execute
    Group.where(id: group_ids).sort_by { |group| group.name_last.downcase }.map { |group| team(group) }
  end

  private

  def group_ids
    current_user.group_ids_access('read') - [Studenthub::TicketApproval::WaitingGroup.group_id]
  end

  def team(group)
    scope = Ticket.where(group_id: group.id, owner_id: [nil, 1], state_id: open_state_ids)

    {
      id:        group.id,
      name:      group.name_last,
      count:     scope.count,
      overdue:   scope.where(escalation_at: ...Time.zone.now).count,
      oldest:    scope.reorder(:created_at, :id).limit(OLDEST).map { |ticket| ticket_item(ticket) },
      view_link: view_link(group),
    }
  end

  def ticket_item(ticket)
    { id: ticket.id, number: ticket.number, title: ticket.title, created_at: ticket.created_at }
  end

  def open_state_ids
    @open_state_ids ||= Studenthub::TicketViews::Setup.open_state_ids.map(&:to_i)
  end

  def view_link(group)
    link = Studenthub::TicketViews::Teams.link(group)
    Overview.exists?(link:, active: true) ? link : nil
  end
end
