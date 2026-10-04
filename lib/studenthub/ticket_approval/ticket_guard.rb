# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Included into Ticket by config/initializers/studenthub_ticket_approval.rb.
# Keeps the approval columns out of reach of ordinary ticket updates (forms, the REST API,
# macros, triggers): only the approval services may change them.
module Studenthub::TicketApproval::TicketGuard
  extend ActiveSupport::Concern

  included do
    before_save :studenthub_protect_approval_columns
  end

  private

  def studenthub_protect_approval_columns
    return if Studenthub::TicketApproval.writing?

    changed_columns = changed & Studenthub::TicketApproval::COLUMNS
    return if changed_columns.empty?

    Rails.logger.warn "Ticket Approvals: ignored a change to #{changed_columns.join(', ')} on ticket #{id || 'new'} made outside the approval workflow."
    restore_attributes(changed_columns)
  end
end
