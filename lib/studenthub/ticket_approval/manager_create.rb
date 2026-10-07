# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Managers who are also customers raise tickets for themselves on the student-style New ticket
# screen. As staff, Zammad would only offer the groups they may create tickets in (managers only
# have read access), so their New ticket screen offers the groups a customer may choose instead.
# Zammad then creates the ticket as theirs, like a customer's (Service::Ticket::Create#customer?).
# Prepended to Zammad's CoreWorkflow::Attributes::Group by config/initializers/studenthub_ticket_approval.rb.
module Studenthub::TicketApproval::ManagerCreate
  module GroupOptions
    def groups
      return super if !studenthub_customer_manager_create?

      @groups ||= customer_ticket_create_group_ids.present? ? groups_customer : groups_default
    end

    private

    def studenthub_customer_manager_create?
      @attributes.payload_class == Ticket &&
        @attributes.payload['screen'] == 'create_middle' &&
        Studenthub::TicketApproval.customer_manager?(@attributes.user)
    end
  end
end
