# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::StudenthubTicketFieldsControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! :states, to: 'admin.ticket_state'
  permit! :priorities, to: 'admin.ticket_priority'
  permit! %i[tag_settings update_tag_settings], to: 'admin.tag'
end
