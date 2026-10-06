# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: one overview per institution (LSST, UKBC, FSB) with its open tickets, for the
# Admin role only. Zammad can't filter "campus starts with LSST", so each overview lists the
# campus values that exist when it is created; a campus added later has to be ticked in the
# overview by an admin. Existing overviews are left alone, so admin edits survive.
module Studenthub::TicketViews::Setup
  CLOSED_STATE_TYPES = %w[closed merged removed].freeze
  VIEW_COLUMNS = %w[number title customer group owner state campus updated_at].freeze

  def self.ensure!
    return if !ObjectManager::Attribute.get(object: 'Ticket', name: 'campus')

    Studenthub::TicketViews::INSTITUTIONS.each_with_index do |(key, name), index|
      link = Studenthub::TicketViews.institution_link(key)
      next if Overview.exists?(link: link)

      values = campus_values(name)
      next if values.empty?

      Overview.create!(
        name:          name,
        link:          link,
        prio:          9000 + index,
        roles:         Role.where(name: 'Admin'),
        condition:     {
          'ticket.state_id' => { operator: 'is', value: open_state_ids },
          'ticket.campus'   => { operator: 'is', value: values },
        },
        order:         { by: 'created_at', direction: 'DESC' },
        view:          { s: VIEW_COLUMNS },
        user_ids:      [],
        active:        true,
        created_by_id: 1,
        updated_by_id: 1,
      )
    end
  end

  def self.remove!
    links = Studenthub::TicketViews::INSTITUTIONS.keys.map { |key| Studenthub::TicketViews.institution_link(key) }
    Overview.where(link: links).destroy_all
  end

  # Campus field options plus values already on tickets (some older ones differ in case).
  def self.campus_values(institution)
    attribute = ObjectManager::Attribute.get(object: 'Ticket', name: 'campus')
    options = flatten_options(attribute&.data_option&.dig(:options) || attribute&.data_option&.dig('options'))
    (options + used_campus_values).map(&:to_s).uniq.grep(%r{\A#{Regexp.escape(institution)}\b}i).sort
  end

  def self.used_campus_values
    Ticket.where.not(campus: [nil, '']).distinct.pluck(:campus)
  end

  def self.flatten_options(options)
    Array(options).flat_map do |option|
      option = option.with_indifferent_access
      [option[:value], *flatten_options(option[:children])]
    end.compact
  end

  def self.open_state_ids
    Ticket::State.joins(:state_type).where.not(ticket_state_types: { name: CLOSED_STATE_TYPES }).pluck(:id).map(&:to_s)
  end
end
