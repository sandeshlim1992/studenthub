# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Institutions views, one per active organisation with its open tickets, for the
# Admin role only (the "Institutions" group of the new UI's views panel). They follow the
# organisations: a new one gets a view, a renamed one is renamed, an inactive or removed one
# loses it. Kept up to date by sync!, which runs in the background whenever an organisation, a
# role or one of these overviews changes (StudenthubTeamViewsSyncJob), so changes made by hand
# are undone. Replaced the LSST / UKBC / FSB views by campus (6 Oct 2026), whose links shared
# the prefix and are removed by the first sync.
module Studenthub::TicketViews::Institutions
  LINK_PREFIX  = 'studenthub_institution_'.freeze
  PRIO_START   = 9000
  ADMIN_ROLE   = 'Admin'.freeze
  VIEW_COLUMNS = %w[number title customer group owner state updated_at].freeze

  def self.link(organization)
    "#{LINK_PREFIX}#{organization.id}"
  end

  def self.institution_view?(overview)
    overview.link.to_s.start_with?(LINK_PREFIX)
  end

  def self.organizations
    Organization.where(active: true).sort_by { |organization| organization.name.downcase }
  end

  def self.sync!
    return if !Overview.table_exists?

    role = Role.find_by(name: ADMIN_ROLE)
    wanted = role ? organizations : []
    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").where.not(link: wanted.map { |organization| link(organization) }).destroy_all
    wanted.each_with_index { |organization, index| ensure_view!(organization, PRIO_START + index, role) }
  end

  def self.ensure_view!(organization, prio, role)
    overview   = Overview.find_by(link: link(organization))
    attributes = {
      name:      organization.name,
      prio:      prio,
      role_ids:  [role.id],
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
      view:          { s: VIEW_COLUMNS },
      user_ids:      [],
      created_by_id: 1,
      updated_by_id: 1,
    )
  end

  def self.changed?(overview, attributes)
    overview.name != attributes[:name] || overview.prio != attributes[:prio] || !overview.active ||
      overview.role_ids.sort != attributes[:role_ids].sort ||
      overview.condition.to_h.deep_stringify_keys != attributes[:condition].deep_stringify_keys
  end

  def self.remove!
    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").destroy_all
  end

  # Added to Organization. Zammad touches an organisation whenever a member changes, so only a
  # new, renamed, switched or removed organisation starts a sync.
  module Sync
    extend ActiveSupport::Concern

    included do
      after_commit :studenthub_sync_institution_views
    end

    private

    def studenthub_sync_institution_views
      return if Setting.get('import_mode')
      return if !destroyed? && !previously_new_record? && !saved_change_to_name? && !saved_change_to_active?

      StudenthubTeamViewsSyncJob.perform_later
    end
  end

  # Added to Overview: an Institutions view changed by hand is put back in the background.
  module OverviewSync
    extend ActiveSupport::Concern

    included do
      after_commit :studenthub_sync_institution_overviews
    end

    private

    def studenthub_sync_institution_overviews
      return if Setting.get('import_mode')
      return if [link, link_before_last_save].none? { |value| value.to_s.start_with?(LINK_PREFIX) }

      StudenthubTeamViewsSyncJob.perform_later
    end
  end
end
