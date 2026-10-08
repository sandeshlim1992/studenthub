# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: one view per site (organisation) that has managers assigned, with its open tickets,
# for those managers only (Managers role, limited to their users). Listed under Sites in the new
# UI's views panel, like the admins' Sites views (Studenthub::TicketViews::Institutions), which stay
# as they are. Kept up to date by sync!, run by StudenthubTeamViewsSyncJob whenever an assignment,
# an organisation, a role or one of these overviews changes, so changes made by hand are undone.
module Studenthub::TicketViews::ManagerSites
  LINK_PREFIX = 'studenthub_site_managers_'.freeze
  PRIO_START  = 9500

  def self.link(organization)
    "#{LINK_PREFIX}#{organization.id}"
  end

  def self.site_view?(overview)
    overview.link.to_s.start_with?(LINK_PREFIX)
  end

  def self.sync!
    return if !Overview.table_exists? || !ActiveRecord::Base.connection.table_exists?(:studenthub_manager_sites)

    role   = Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)
    wanted = role ? managers_by_organization : {}

    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").where.not(link: wanted.keys.map { |organization| link(organization) }).destroy_all
    wanted.keys.sort_by { |organization| organization.name.downcase }.each_with_index do |organization, index|
      ensure_view!(organization, wanted[organization], PRIO_START + index, role)
    end
  end

  # Active organisations with their active managers.
  def self.managers_by_organization
    manager_ids = Studenthub::TicketApproval.managers.reorder(nil).pluck(:id)

    StudenthubManagerSite.includes(:organization)
      .where(user_id: manager_ids)
      .select { |site| site.organization&.active }
      .group_by(&:organization)
      .transform_values { |sites| sites.map(&:user_id).sort }
  end

  def self.ensure_view!(organization, user_ids, prio, role)
    overview   = Overview.find_by(link: link(organization))
    attributes = {
      name:      organization.name,
      prio:      prio,
      role_ids:  [role.id],
      user_ids:  user_ids,
      condition: {
        'ticket.organization_id' => { operator: 'is', value: [organization.id.to_s] },
        'ticket.state_id'        => { operator: 'is', value: Studenthub::TicketViews::Setup.open_state_ids },
      },
      active:    true,
    }

    if overview
      overview.update!(**attributes, updated_by_id: 1) if changed?(overview, attributes)
      return overview
    end

    Overview.create!(
      **attributes,
      link:          link(organization),
      order:         { by: 'created_at', direction: 'DESC' },
      view:          { s: Studenthub::TicketViews::Institutions::VIEW_COLUMNS },
      created_by_id: 1,
      updated_by_id: 1,
    )
  end

  def self.changed?(overview, attributes)
    overview.name != attributes[:name] || overview.prio != attributes[:prio] || !overview.active ||
      overview.role_ids.sort != attributes[:role_ids].sort ||
      overview.user_ids.sort != attributes[:user_ids].sort ||
      overview.condition.to_h.deep_stringify_keys != attributes[:condition].deep_stringify_keys
  end

  def self.remove!
    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").destroy_all
  end

  # Added to Overview: one of these views changed by hand is put back in the background.
  module OverviewSync
    extend ActiveSupport::Concern

    included do
      after_commit :studenthub_sync_manager_site_overviews
    end

    private

    def studenthub_sync_manager_site_overviews
      return if Setting.get('import_mode')
      return if [link, link_before_last_save].none? { |value| value.to_s.start_with?(LINK_PREFIX) }

      StudenthubTeamViewsSyncJob.perform_later
    end
  end
end
