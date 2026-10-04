# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

module TicketApprovalHelpers
  def create_manager(groups: [], access: 'read', **attributes)
    manager = create(:agent, **attributes)
    manager.roles = [Role.find_by(name: Studenthub::TicketApproval::MANAGER_ROLE)]
    manager.group_names_access_map = groups.to_h { |group| [group.name, [access]] }
    manager.save!
    manager.reload
  end
end

RSpec.configure do |config|
  config.include TicketApprovalHelpers
end
