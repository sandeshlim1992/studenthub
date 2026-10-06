# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# One approval round on a ticket: an agent asked a manager, who approved or denied it
# (or the request was withdrawn). The ticket's approval_* columns mirror the latest round.
# While it waits, the ticket is in the Managers group; previous_group/previous_owner are where
# it goes back to, and sla_paused whether its SLA stops meanwhile.
class TicketApproval < ApplicationModel
  STATES = %w[pending approved denied cancelled].freeze
  TEXT_MAX_LENGTH = 5000

  belongs_to :ticket
  belongs_to :requested_by, class_name: 'User', optional: true
  belongs_to :approver,     class_name: 'User', optional: true
  belongs_to :decided_by,   class_name: 'User', optional: true
  belongs_to :previous_group, class_name: 'Group', optional: true
  belongs_to :previous_owner, class_name: 'User', optional: true

  validates :state, inclusion: { in: STATES }
  validates :reason, presence: true, length: { maximum: TEXT_MAX_LENGTH }
  validates :comment, length: { maximum: TEXT_MAX_LENGTH }, allow_nil: true

  scope :pending, -> { where(state: 'pending') }

  def as_api_json
    {
      id:           id,
      state:        state,
      reason:       reason,
      comment:      comment,
      requested_by: self.class.user_json(requested_by),
      approver:     self.class.user_json(approver),
      decided_by:   self.class.user_json(decided_by),
      requested_at: created_at,
      decided_at:   decided_at,
      sla_paused:   sla_paused,
    }
  end

  def self.user_json(user)
    return if !user

    { id: user.id, name: user.fullname }
  end
end
