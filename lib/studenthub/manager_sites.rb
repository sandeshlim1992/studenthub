# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admins assign sites (organisations) to managers. A manager can read the tickets of
# their sites (customers of that organisation), sees each site's open tickets in a view under
# Sites (Studenthub::TicketViews::ManagerSites) and its numbers on the manager dashboard
# (Service::StudenthubManagerSites::Stats). It adds read access only; their teams don't change.
# The access rules are prepended to Zammad's TicketPolicy and its scopes by
# config/initializers/studenthub_ticket_approval.rb.
module Studenthub::ManagerSites
  ACCESS_TYPES = %w[read overview].freeze

  # The active sites of a manager; none for anyone else.
  def self.organization_ids_for(user)
    return [] if !Studenthub::TicketApproval.manager?(user)

    StudenthubManagerSite.joins(:organization)
      .where(user_id: user.id, organizations: { active: true })
      .reorder(:organization_id)
      .pluck(:organization_id)
  end

  def self.organizations_for(user)
    Organization.where(id: organization_ids_for(user)).sort_by { |organization| organization.name.downcase }
  end

  # The managers with their sites, for the admin page.
  def self.assignments
    sites = StudenthubManagerSite.pluck(:user_id, :organization_id).group_by(&:first)

    Studenthub::TicketApproval.managers.map do |manager|
      { user_id: manager.id, name: manager.fullname, organization_ids: (sites[manager.id] || []).map(&:last).sort }
    end
  end

  def self.assign!(user, organization_ids)
    raise ArgumentError, __('Sites can only be assigned to managers.') if !Studenthub::TicketApproval.manager?(user)

    wanted  = Organization.where(id: Array(organization_ids)).pluck(:id)
    user_id = UserInfo.current_user_id || 1

    StudenthubManagerSite.transaction do
      StudenthubManagerSite.where(user_id: user.id).where.not(organization_id: wanted).destroy_all
      (wanted - StudenthubManagerSite.where(user_id: user.id).pluck(:organization_id)).each do |organization_id|
        StudenthubManagerSite.create!(user_id: user.id, organization_id: organization_id, created_by_id: user_id, updated_by_id: user_id)
      end
    end

    organization_ids_for(user)
  end

  def self.granted?(user, ticket)
    return false if !user || !ticket&.organization_id

    organization_ids_for(user).include?(ticket.organization_id)
  end

  # Zammad caches overview contents per group permission set; managers with sites see more than
  # their groups allow, so their cache is their own.
  def self.cache_key_part(user)
    ids = user ? organization_ids_for(user) : []
    return if ids.empty?

    "studenthubManagerSites:#{user.id}:#{ids.join(',')}"
  end

  module Policy
    private

    def agent_access?(access)
      return true if super
      return false if Studenthub::ManagerSites::ACCESS_TYPES.exclude?(access.to_s)

      Studenthub::ManagerSites.granted?(user, record)
    end
  end

  module Scope
    def resolve
      relation = super
      return relation if Studenthub::ManagerSites::ACCESS_TYPES.exclude?(self.class::ACCESS_TYPE.to_s)

      organization_ids = Studenthub::ManagerSites.organization_ids_for(user)
      return relation if organization_ids.empty?

      relation.or(scope.where(organization_id: organization_ids))
    end
  end
end
