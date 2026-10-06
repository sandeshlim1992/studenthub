# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub ticket views: what the Teams and Institutions views share. Until 6 Oct 2026 this
# made the LSST / UKBC / FSB overviews by campus; the Institutions views by organisation
# (Studenthub::TicketViews::Institutions) replaced them, and ensure!/remove! are kept for the
# 20261004200000 migration.
module Studenthub::TicketViews::Setup
  CLOSED_STATE_TYPES = %w[closed merged removed].freeze

  def self.ensure!
    Studenthub::TicketViews::Institutions.sync!
  end

  def self.remove!
    Studenthub::TicketViews::Institutions.remove!
  end

  def self.open_state_ids
    Ticket::State.joins(:state_type).where.not(ticket_state_types: { name: CLOSED_STATE_TYPES }).pluck(:id).map(&:to_s)
  end
end
