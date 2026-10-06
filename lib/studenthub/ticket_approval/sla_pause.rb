# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Pauses a ticket's SLA while it waits for approval, the way Zammad pauses it in pending states:
# no deadlines while waiting, and the waiting time doesn't count once they are calculated again.
# Only rounds sent while the pause was on count (TicketApproval#sla_paused), so changing the
# setting later doesn't move past deadlines. Prepended by config/initializers/studenthub_ticket_approval.rb.
module Studenthub::TicketApproval::SlaPause
  def self.paused_rounds(ticket)
    TicketApproval.where(ticket_id: ticket.id, sla_paused: true)
  end

  def self.paused?(ticket)
    paused_rounds(ticket).pending.exists?
  end

  # Prepended to Escalation.
  module Escalation
    def escalation_disabled?
      return true if super

      @studenthub_sla_paused = Studenthub::TicketApproval::SlaPause.paused?(ticket) if !defined?(@studenthub_sla_paused)
      @studenthub_sla_paused
    end
  end

  # Prepended to Escalation::TicketBizBreak: waiting periods become breaks, like pending states.
  module TicketBizBreak
    def biz_breaks
      waiting = Studenthub::TicketApproval::SlaPause.paused_rounds(@ticket).map do |round|
        history_range_to_breaks({ 'created_at' => round.created_at }, { 'created_at' => round.decided_at || Time.zone.now })
      end
      return super if waiting.empty?

      accumulate_breaks([super, *waiting])
    end
  end
end
