# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: roles for customers only lose any admin.* permission (Studenthub::CustomerRoles), so no
# student can open part of Administration.
class StudenthubCustomerRolesWithoutAdmin < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::CustomerRoles.remove_admin_permissions!.each do |role, permissions|
      say "#{role}: removed #{permissions.join(', ')}"
    end
  end
end
