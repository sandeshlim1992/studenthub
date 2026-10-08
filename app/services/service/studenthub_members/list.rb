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

  def execute
    users       = members
    last_active = last_active_by_user_id(users.map(&:id))

    online, offline = users.map { |user| row(user, last_active[user.id]) }.partition { |row| row[:online] }

    online + offline.sort_by { |row| [row[:last_login] ? 0 : 1, -row[:last_login].to_i] }
  end

  private

  def members
    User.joins(:roles)
      .where(roles: { id: self.class.member_role_ids }, active: true)
      .where.not(id: 1)
      .distinct
      .reorder(:firstname, :lastname)
  end

  def last_active_by_user_id(user_ids)
    ids = user_ids.to_set

    ActiveRecord::SessionStore::Session.where(updated_at: ONLINE_WINDOW.ago..).each_with_object({}) do |session, result|
      user_id = session.data['user_id'].to_i
      next if ids.exclude?(user_id)

      result[user_id] = [result[user_id], session.updated_at].compact.max
    end
  end

  def row(user, last_active_at)
    {
      id:             user.id,
      firstname:      user.firstname,
      lastname:       user.lastname,
      name:           user.fullname,
      image:          user.image,
      role:           role_label(user),
      teams:          user.groups_access('read').where(active: true).map(&:name_last).sort,
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
