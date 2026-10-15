# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Service::User::Deprecated::Signup < Service::User::Signup

  attr_reader :user_data, :resend

  def initialize(user_data:, resend: false)
    super

    # Student Hub: the new UI's addresses, as in the service this one extends; the classic UI's
    # #email_verify/… and #password_reset_verify/… opened the new UI's home page, which is served at /
    # (Studenthub::NewUiAtRoot)
    @path = {
      signup: 'signup/verify/',
      taken:  'reset-password/verify/'
    }
  end
end
