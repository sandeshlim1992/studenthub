# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what the new UI's Roles page shows: every role with its permissions, team access and
# number of active users, every permission that can be given (with Zammad's label, description and
# rules), and the teams. Roles are saved through Zammad's own API (/api/v1/roles).
class Service::StudenthubRoles::Overview < Service::Base
  def execute
    {
      roles:       roles,
      permissions: permissions,
      groups:      Group.reorder(:name).map { |group| { id: group.id, name: group.fullname, active: group.active } },
      # The roles of the admin looking, so the page can warn before they take away their own access.
      my_role_ids: current_user&.role_ids || [],
    }
  end

  private

  def roles
    user_counts = User.joins(:roles).where(active: true).group('roles_users.role_id').count

    Role.reorder(:name).map do |role|
      {
        id:                role.id,
        name:              role.name,
        note:              role.note,
        active:            role.active,
        default_at_signup: role.default_at_signup,
        permission_ids:    role.permission_ids,
        group_ids:         role.saved_group_ids_access_map.transform_values { |access| Array(access) },
        user_count:        user_counts[role.id] || 0,
      }
    end
  end

  def permissions
    Permission.where(active: true).sort_by { |permission| permission.preferences[:prio].to_i }.map do |permission|
      {
        id:          permission.id,
        name:        permission.name,
        label:       permission.label,
        description: permission.description,
        # Parent entries like "ticket" that can't be given on their own
        disabled:    permission.preferences[:disabled] == true,
        # Only together with these (e.g. agent profile settings need "ticket.agent")
        required:    Array(permission.preferences[:required]),
        # "ticket.agent" comes with team access
        groups:      Array(permission.preferences[:plugin]).include?('groups'),
      }
    end
  end
end
