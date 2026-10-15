# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Service::User::PasswordReset::Deprecated::Send < Service::User::PasswordReset::Send

  attr_reader :username

  def initialize(username:)
    super

    # Student Hub: the new UI's address, as in the service this one extends; the classic UI's
    # #password_reset_verify/… opened the new UI's home page, which is served at / (Studenthub::NewUiAtRoot)
    @path = {
      reset: 'reset-password/verify/'
    }
  end
end
