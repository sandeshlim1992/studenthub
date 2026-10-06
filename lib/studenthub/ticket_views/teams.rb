# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Teams views, one per group with its open tickets, grouped by agent. The views
# panel lists them for the agents who can read that group, all of them for admins, none for
# managers (Studenthub::TicketViews.sections_for). They follow the groups: a new group gets a view, a renamed one is renamed, an inactive or
# removed one loses it. Kept up to date by sync!, which runs in the background whenever groups,
# roles or ticket states change (see Sync). Admins shouldn't edit these overviews.
module Studenthub::TicketViews::Teams
  LINK_PREFIX  = 'studenthub_team_'.freeze
  PRIO_START   = 5000
  ADMIN_ROLE   = 'Admin'.freeze
  VIEW_COLUMNS = %w[number title customer owner state priority escalation_at created_at].freeze

  def self.link(group)
    "#{LINK_PREFIX}#{group.id}"
  end

  def self.team_view?(overview)
    overview.link.to_s.start_with?(LINK_PREFIX)
  end

  def self.groups
    waiting_id = Studenthub::TicketApproval::WaitingGroup.group_id
    Group.where(active: true).where.not(id: waiting_id).sort_by { |group| group.fullname.downcase }
  end

  def self.sync!
    return if !Overview.table_exists?

    wanted = groups
    grant_admin_role!(wanted)
    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").where.not(link: wanted.map { |group| link(group) }).destroy_all
    wanted.each_with_index { |group, index| ensure_view!(group, PRIO_START + index) }
  end

  # Admins see every team: the Admin role gets full access to each team group. Zammad only keeps
  # groups on roles with agent permission, so the Admin role becomes an agent role too.
  def self.grant_admin_role!(groups)
    role = Role.find_by(name: ADMIN_ROLE)
    return if !role

    agent   = role.permissions.exists?(name: 'ticket.agent')
    missing = groups.map(&:id) - RoleGroup.where(role_id: role.id, access: 'full').pluck(:group_id)
    return if agent && missing.empty?

    Role.transaction do
      role.permission_grant('ticket.agent')
      role.group_ids_access_map = role.saved_group_ids_access_map.merge(missing.index_with { 'full' })
      role.touch # rubocop:disable Rails/SkipsModelValidations
    end
  end

  def self.ensure_view!(group, prio)
    overview   = Overview.find_by(link: link(group))
    attributes = {
      name:      group.fullname,
      prio:      prio,
      role_ids:  agent_role_ids,
      condition: {
        'ticket.group_id' => { operator: 'is', value: [group.id.to_s] },
        'ticket.state_id' => { operator: 'is', value: Studenthub::TicketViews::Setup.open_state_ids },
      },
      active:    true,
    }

    if overview
      overview.update!(**attributes, updated_by_id: 1) if changed?(overview, attributes)
      return overview
    end

    Overview.create!(
      **attributes,
      link:          link(group),
      group_by:      'owner',
      order:         { by: 'created_at', direction: 'DESC' },
      view:          { s: view_columns },
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

  def self.view_columns
    campus = ObjectManager::Attribute.get(object: 'Ticket', name: 'campus')
    campus ? VIEW_COLUMNS.dup.insert(4, 'campus') : VIEW_COLUMNS
  end

  # Agent roles (Admin included, see grant_admin_role!), not Managers: managers don't get Teams.
  def self.agent_role_ids
    Role.with_permissions('ticket.agent').where(active: true)
      .where.not(name: Studenthub::TicketApproval::MANAGER_ROLE).reorder(:id).pluck(:id)
  end

  def self.remove!
    Overview.where('link LIKE ?', "#{LINK_PREFIX}%").destroy_all
  end

  # Added to Group, Role and Ticket::State.
  module Sync
    extend ActiveSupport::Concern

    included do
      after_commit :studenthub_sync_team_views
    end

    private

    def studenthub_sync_team_views
      return if Setting.get('import_mode')

      StudenthubTeamViewsSyncJob.perform_later
    end
  end
end
