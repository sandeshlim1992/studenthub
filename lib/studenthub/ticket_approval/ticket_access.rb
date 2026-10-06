# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Read access that doesn't come from groups: while a ticket waits for approval (in the Managers
# group, which nobody has access to), the manager it was sent to and the agent who sent it can
# open it and see it in their approval overviews; the manager keeps read access after deciding.
# Prepended to Zammad's TicketPolicy and its scopes by config/initializers/studenthub_ticket_approval.rb.
module Studenthub::TicketApproval::TicketAccess
  ACCESS_TYPES = %w[read overview].freeze

  # Approval rounds that give the user read access to their ticket.
  def self.rounds_for(user)
    TicketApproval.where(approver_id: user.id, state: %w[pending approved denied])
      .or(TicketApproval.where(requested_by_id: user.id, state: 'pending'))
  end

  def self.ticket_ids_for(user)
    rounds_for(user).select(:ticket_id)
  end

  # Zammad caches overview contents per group permission set; users with approval access see
  # more than their groups allow, so their cache is their own.
  def self.cache_key_part(user)
    return if !user || !rounds_for(user).exists?

    "studenthubApprovalAccess:#{user.id}"
  end

  def self.granted?(user, ticket)
    return false if !user || !ticket&.id

    rounds_for(user).exists?(ticket_id: ticket.id)
  end

  module Policy
    private

    def agent_access?(access)
      return true if super
      return false if Studenthub::TicketApproval::TicketAccess::ACCESS_TYPES.exclude?(access.to_s)

      Studenthub::TicketApproval::TicketAccess.granted?(user, record)
    end
  end

  module Scope
    def resolve
      relation = super
      return relation if Studenthub::TicketApproval::TicketAccess::ACCESS_TYPES.exclude?(self.class::ACCESS_TYPE.to_s)

      relation.or(scope.where(id: Studenthub::TicketApproval::TicketAccess.ticket_ids_for(user)))
    end
  end
end
