# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: sorts the overviews in the new UI's views panel into "Approval needed", "My views",
# "Teams" and "Institutions".
#
# - The Ticket Approvals overviews ("Awaiting my approval" for managers, "Sent for approval" for
#   agents) are listed under Approval needed.
# - Teams lists the Student Hub team views (Studenthub::TicketViews::Teams: one per group, its open
#   tickets) of the groups the agent can read through their roles. Admins can read every team group
#   (Teams.grant_admin_role!); managers don't get Teams, unless they're admins too. Other overviews that show one group's tickets
#   (condition "group is X" and nothing about the current user) stay under My views for members
#   of that group. Both kinds are hidden for everyone else, who could not see the tickets anyway.
# - Institution overviews are created by Studenthub::TicketViews::Setup (links below) and are
#   visible to the Admin role only.
# - Everything else stays under My views.
module Studenthub::TicketViews
  INSTITUTIONS = { 'lsst' => 'LSST', 'ukbc' => 'UKBC', 'fsb' => 'FSB' }.freeze

  def self.institution_link(key)
    "studenthub_institution_#{key}"
  end

  def self.sections_for(user)
    overviews = Ticket::Overviews.all(current_user: user)
    member_group_ids = user.group_ids_access('read')
    institution_links = INSTITUTIONS.keys.map { |key| institution_link(key) }
    approval_links = Studenthub::TicketApproval::Setup::OVERVIEW_LINKS
    no_teams = Studenthub::TicketApproval.manager?(user) && !user.permissions?('admin')

    result = { teams: [], hidden_overview_ids: [], institution_overview_ids: [], approval_overview_ids: [] }

    overviews.each do |overview|
      if approval_links.include?(overview.link)
        result[:approval_overview_ids] << overview.id
        next
      end

      if institution_links.include?(overview.link)
        result[:institution_overview_ids] << overview.id
        next
      end

      group_id = team_group_id(overview)
      next if !group_id

      if member_group_ids.exclude?(group_id) || (no_teams && Studenthub::TicketViews::Teams.team_view?(overview))
        result[:hidden_overview_ids] << overview.id
      elsif Studenthub::TicketViews::Teams.team_view?(overview)
        result[:teams] << { overview_id: overview.id, group_id: group_id }
      end
    end

    result
  end

  # The group of an overview that shows exactly one group's tickets, otherwise nil.
  def self.team_group_id(overview)
    return if !overview.condition.is_a?(Hash)

    condition = overview.condition.to_h.with_indifferent_access
    return if condition.key?(:conditions) # expert conditions: not a team view

    return if condition.values.any? { |rule| rule.is_a?(Hash) && rule['pre_condition'].to_s.start_with?('current_user') }

    group_rule = condition['ticket.group_id']
    return if !group_rule.is_a?(Hash) || group_rule['operator'] != 'is'

    group_ids = Array(group_rule['value']).compact_blank
    return if group_ids.size != 1

    group_ids.first.to_i
  end
end
