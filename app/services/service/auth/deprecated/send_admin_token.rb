# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Service::Auth::Deprecated::SendAdminToken < Service::Auth::SendAdminToken
  include Service::Auth::Concerns::CheckAdminPasswordAuth

  def initialize(login:)
    super

    # Student Hub: the new UI's address, as in the service this one extends; the classic UI's
    # #login/admin/… opened the new UI's home page, which is served at / (Studenthub::NewUiAtRoot)
    @path = 'login?token='
  end
end
