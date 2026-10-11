# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub "Members": the agents and admins, who of them is online and when each last signed
# in. Online means signed in and active in the last few minutes: every request of a signed-in
# browser touches its session (ApplicationController::HasUser#session_update). Managers without
# another staff role and customers aren't members.
class Service::StudenthubMembers::List < Service::Base
  ONLINE_WINDOW = 5.minutes

  def self.member_role_ids
    Role.with_permissions(%w[ticket.agent admin])
      .where.not(name: Studenthub::TicketApproval::MANAGER_ROLE)
      .pluck(:id)
  end

  def self.member?(user)
    return false if !user&.active

    user.roles.exists?(id: member_role_ids)
  end

  def self.members
    User.joins(:roles)
      .where(roles: { id: member_role_ids }, active: true)
      .where.not(id: 1)
      .distinct
  end

  # How many members there are and how many of them are online, without building the list
  # (the dashboard only shows the numbers).
  def self.counts
    ids = members.pluck(:id)

    { online: last_active_by_user_id(ids).size, total: ids.size }
  end

  def self.last_active_by_user_id(user_ids)
    ids = user_ids.to_set

    ActiveRecord::SessionStore::Session.where(updated_at: ONLINE_WINDOW.ago..).each_with_object({}) do |session, result|
      user_id = session.data['user_id'].to_i
      next if ids.exclude?(user_id)

      result[user_id] = [result[user_id], session.updated_at].compact.max
    end
  end

  def execute
    users       = self.class.members.preload(:roles).reorder(:firstname, :lastname).to_a
    last_active = self.class.last_active_by_user_id(users.map(&:id))
    teams       = teams_by_user_id(users)

    online, offline = users.map { |user| row(user, last_active[user.id], teams[user.id]) }.partition { |row| row[:online] }

    online + offline.sort_by { |row| [row[:last_login] ? 0 : 1, -row[:last_login].to_i] }
  end

  private

  # Each member's teams, looked up for all members at once: the active groups they can read,
  # directly or through a role, and only for agents (as HasGroups#group_ids_access).
  def teams_by_user_id(users)
    agents   = users.select { |user| user.permissions?('ticket.agent') }
    role_ids = agents.flat_map(&:role_ids).uniq

    direct  = group_ids_by(UserGroup, :user_id, agents.map(&:id))
    by_role = group_ids_by(RoleGroup, :role_id, role_ids)
    names   = Group.where(id: (direct.values + by_role.values).flatten.uniq).to_h { |group| [group.id, group.name_last] }

    agents.to_h do |user|
      group_ids = direct.fetch(user.id, []) | user.role_ids.flat_map { |role_id| by_role.fetch(role_id, []) }
      [user.id, group_ids.filter_map { |group_id| names[group_id] }.sort]
    end
  end

  def group_ids_by(klass, key, ids)
    return {} if ids.empty?

    klass.joins(:group)
      .where(key => ids, access: %w[read full], groups: { active: true })
      .pluck(key, :group_id)
      .group_by(&:first)
      .transform_values { |pairs| pairs.map(&:last) }
  end

  def row(user, last_active_at, teams)
    {
      id:             user.id,
      firstname:      user.firstname,
      lastname:       user.lastname,
      name:           user.fullname,
      image:          user.image,
      role:           role_label(user),
      teams:          teams || [],
      online:         last_active_at.present?,
      last_active_at: last_active_at,
      last_login:     user.last_login,
      out_of_office:  user.out_of_office?,
    }
  end

  # Same names as under the logo in the new UI (useStudenthubRoleLabel).
  def role_label(user)
    manager = Studenthub::TicketApproval.manager?(user)

    if user.permissions?('admin')
      manager ? __('Admin & Manager') : __('Admin')
    else
      manager ? __('Agent & Manager') : __('Agent')
    end
  end
end
