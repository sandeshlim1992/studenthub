# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Members see each other: agents and admins, not managers without another staff role.
class Controllers::StudenthubMembersControllerPolicy < Controllers::ApplicationControllerPolicy
  def index?
    return true if Service::StudenthubMembers::List.member?(user)

    not_authorized __('Only agents and admins can see the members.')
  end
end
