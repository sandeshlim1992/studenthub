# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub theme: the colour of each ticket state and the "due soon" point of the escalation
# label in the new UI's ticket lists. Admins change both on the Branding page.
# Idempotent. Used by the 20261004180000 migration and by the test suite, which empties
# all tables and re-runs only Zammad's own seeds between runs.
module Studenthub::Theme::TicketListSetup
  # Keys of the label palette; the colours themselves live in the frontend (studenthubTicketList.ts).
  STATE_COLORS = %w[blue purple amber green teal red grey].freeze

  DEFAULT_ESCALATION_WARNING_MINUTES = 60

  # First guess from the state's name. Zammad files several Student Hub states under the type
  # "open", so the type alone can't tell "In Progress" from "Resolved".
  NAME_HINTS = [
    [%r{resolv|solved}i, 'green'],
    [%r{closed|merged}i, 'grey'],
    [%r{await|waiting|pending|hold}i, 'amber'],
    [%r{assign|progress}i, 'purple'],
    [%r{\bnew\b}i, 'blue'],
  ].freeze

  # Fallback by type; the frontend uses the same table for states admins haven't coloured yet.
  TYPE_COLORS = {
    'new'              => 'blue',
    'open'             => 'purple',
    'pending reminder' => 'amber',
    'pending action'   => 'amber',
    'closed'           => 'grey',
    'merged'           => 'grey',
    'removed'          => 'grey',
  }.freeze

  def self.ensure!
    Setting.create_if_not_exists(
      title:       __('Ticket state colours'),
      name:        'studenthub_ticket_state_colors',
      area:        'System::Branding',
      description: __('Colour of each ticket state in the ticket lists of the new UI.'),
      options:     {},
      state:       initial_state_colors,
      preferences: {
        permission:  ['admin.branding'],
        validations: ['Setting::Validation::StudenthubTicketStateColors'],
        hidden:      true, # edited on the new UI's Branding page, not in the classic admin
      },
      frontend:    true
    )

    Setting.create_if_not_exists(
      title:       __('Escalation warning'),
      name:        'studenthub_escalation_warning_minutes',
      area:        'System::Branding',
      description: __('Minutes before the escalation time at which ticket lists in the new UI show "due soon".'),
      options:     {},
      state:       DEFAULT_ESCALATION_WARNING_MINUTES,
      preferences: {
        permission:  ['admin.branding'],
        validations: ['Setting::Validation::StudenthubEscalationWarningMinutes'],
        hidden:      true,
      },
      frontend:    true
    )
  end

  def self.remove!
    Setting.where(name: %w[studenthub_ticket_state_colors studenthub_escalation_warning_minutes]).destroy_all
  end

  def self.initial_state_colors
    Ticket::State.includes(:state_type).to_h do |state|
      [state.id.to_s, guess_state_color(state.name, state.state_type&.name)]
    end
  end

  def self.guess_state_color(name, type_name)
    NAME_HINTS.each { |pattern, color| return color if name.to_s.match?(pattern) }

    TYPE_COLORS.fetch(type_name.to_s, 'grey')
  end
end
