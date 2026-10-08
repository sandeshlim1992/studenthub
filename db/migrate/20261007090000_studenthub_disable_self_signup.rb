# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: no self-registration. Accounts come from Microsoft 365 sign-in or the admins, so
# "New user accounts" is switched off: the sign-up page and API refuse, in both UIs. Admins can
# switch it back on under Security.
class StudenthubDisableSelfSignup < ActiveRecord::Migration[8.0]
  def up
    return if !Setting.exists?(name: 'user_create_account')

    Setting.set('user_create_account', false)
  end
end
