# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: roles for customers only (students) never carry admin permissions. Each admin.*
# permission on such a role opens part of Administration to every student: a dev database's Customer
# role had admin.request_forms (added by hand on 10 Oct), so every student could change the request
# forms. Used by the 20261013120000 migration, which takes them off on every server.
module Studenthub::CustomerRoles
  # Permissions that make a role a staff role; a role with any of them is left as it is.
  STAFF_PERMISSIONS = %w[admin ticket ticket.agent].freeze

  # Roles that give ticket.customer and no staff permission.
  def self.customer_only
    Role.includes(:permissions).select do |role|
      names = role.permissions.map(&:name)
      names.include?('ticket.customer') && !names.intersect?(STAFF_PERMISSIONS)
    end
  end

  # Takes the admin.* permissions off those roles. Returns what was removed, { role name => [names] }.
  def self.remove_admin_permissions!
    UserInfo.ensure_current_user_id do
      customer_only.each_with_object({}) do |role, removed|
        admin = role.permissions.select { |permission| permission.name.start_with?('admin.') }
        next if admin.empty?

        role.update!(permission_ids: role.permission_ids - admin.map(&:id))
        removed[role.name] = admin.map(&:name).sort
      end
    end
  end
end
