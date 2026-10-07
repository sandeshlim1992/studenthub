# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# How an agent groups and sorts a ticket view, saved per agent and view in their preferences
# (so it is the same on every device). Without a choice the view's own settings apply; the
# Teams views come grouped by agent. Applied where Zammad reads an overview's grouping and
# order: the ticket query, the overview type of the GraphQL API and its cache keys (see
# config/initializers/studenthub_ticket_views.rb).
module Studenthub::TicketViews::Choice
  PREFERENCE = 'studenthub_overview_choices'.freeze
  DIRECTIONS = %w[ASC DESC].freeze

  # Ticket relations Zammad can group by, with the names used in the new UI.
  BASE_GROUPINGS = {
    'owner'        => __('Agent'),
    'group'        => __('Team'),
    'state'        => __('State'),
    'priority'     => __('Priority'),
    'customer'     => __('Customer'),
    'organization' => __('Organization'),
  }.freeze
  GROUPABLE_DATA_TYPES = %w[select tree_select boolean].freeze
  # Ticket fields that are not offered: approval_state belongs to the Ticket Approvals workflow
  # (and Zammad can't sort by it, so a grouping saved before 6 Oct 2026 broke the view).
  HIDDEN_GROUPINGS = %w[approval_state].freeze

  # [{ value:, label: }] for the "Group by" menu; '' means no grouping.
  def self.grouping_options
    attributes = ObjectManager::Attribute
      .where(object_lookup_id: ObjectLookup.by_name('Ticket'), active: true, data_type: GROUPABLE_DATA_TYPES)
      .where.not(name: HIDDEN_GROUPINGS)
      .reorder(:position, :name)
      .reject { |attribute| BASE_GROUPINGS.key?(attribute.name.delete_suffix('_id')) }

    BASE_GROUPINGS.map { |value, label| { value:, label: } } +
      attributes.map { |attribute| { value: attribute.name, label: attribute.display } }
  end

  def self.groupable?(value)
    value == '' || grouping_options.any? { |option| option[:value] == value }
  end

  def self.choices(user)
    choices = user.preferences[PREFERENCE]
    choices.is_a?(Hash) ? choices : {}
  end

  def self.for(user, overview)
    return {} if !user || !overview&.id

    choices(user)[overview.id.to_s] || {}
  end

  # A saved grouping that is no longer offered (field removed or hidden) falls back to the view's.
  def self.group_by(user, overview)
    choice = self.for(user, overview)
    return choice['group_by'].presence if choice.key?('group_by') && groupable?(choice['group_by'])

    overview.group_by.presence
  end

  def self.order_by(user, overview)
    self.for(user, overview)['order_by'].presence || overview.order['by']
  end

  def self.order_direction(user, overview)
    self.for(user, overview)['order_direction'].presence || overview.order['direction']
  end

  # A copy of the overview with the agent's grouping and order, for Zammad's ticket query.
  def self.apply(overview, user)
    choice = self.for(user, overview)
    return overview if choice.blank?

    copy = overview.dup
    copy.id = overview.id
    copy.group_by = group_by(user, overview)
    copy.order = { 'by' => order_by(user, overview), 'direction' => order_direction(user, overview) }
    copy
  end

  def self.save!(user, overview, group_by: nil, order_by: nil, order_direction: nil)
    choice = self.for(user, overview).dup

    if !group_by.nil?
      raise ArgumentError, "Unknown grouping '#{group_by}'" if !groupable?(group_by)

      choice['group_by'] = group_by
    end
    if order_by.present?
      raise ArgumentError, "Unknown order '#{order_by}'" if !%r{\A[a-z0-9_]+\z}.match?(order_by)

      choice['order_by'] = order_by
    end
    if order_direction.present?
      raise ArgumentError, "Unknown direction '#{order_direction}'" if DIRECTIONS.exclude?(order_direction)

      choice['order_direction'] = order_direction
    end

    store!(user, overview, choice)
  end

  def self.reset!(user, overview)
    store!(user, overview, nil)
  end

  def self.store!(user, overview, choice)
    choices = choices(user).dup
    if choice.blank?
      choices.delete(overview.id.to_s)
    else
      choices[overview.id.to_s] = choice
    end
    user.preferences[PREFERENCE] = choices
    user.save!
  end

  # Part of the overview cache keys: Zammad shares cached ticket lists between users with the
  # same group permissions, and an agent's own grouping and order must not leak to others.
  def self.cache_key_part(user, overview)
    choice = self.for(user, overview)
    return if choice.blank?

    "studenthubChoice:#{user.id}:#{choice.values_at('group_by', 'order_by', 'order_direction').join(',')}"
  end

  # Prepended to Ticket::Overviews' class methods: the ticket query uses the agent's choice.
  # Teams views also list unassigned tickets first, whatever the grouping (they form the
  # "Unassigned tickets" group at the top of the list).
  module Overviews
    def tickets_for_overview(overview, user, order_by: nil, order_direction: nil)
      relation = super(Studenthub::TicketViews::Choice.apply(overview, user), user, order_by:, order_direction:)
      return relation if !Studenthub::TicketViews::Teams.team_view?(overview)

      relation.reorder(Arel.sql('CASE WHEN tickets.owner_id = 1 THEN 0 ELSE 1 END'), *relation.order_values)
    end
  end

  # Prepended to Gql::Types::OverviewType: the new UI reads grouping, order and the visible
  # columns (the grouped one is left out) from here.
  module OverviewType
    def group_by
      Studenthub::TicketViews::Choice.group_by(context.current_user, object)
    end

    def order_by
      Studenthub::TicketViews::Choice.order_by(context.current_user, object)
    end

    def order_direction
      Studenthub::TicketViews::Choice.order_direction(context.current_user, object)
    end

    def view_columns_raw
      grouped        = group_by
      ticket_columns = ::Ticket.column_names
      flatten_columns(object.view['s']).reject { |field_name| field_name == grouped }.map do |field_name|
        ticket_columns.include?(field_name) ? field_name : "#{field_name}_id"
      end
    end
  end

  # Prepended to the classes using Gql::Concerns::HandlesOverviewCaching.
  module OverviewCaching
    def object_cache_key(overview)
      user = context.current_user
      [
        super,
        Studenthub::TicketViews::Choice.cache_key_part(user, overview),
        Studenthub::TicketApproval::TicketAccess.cache_key_part(user),
        Studenthub::ManagerSites.cache_key_part(user),
      ].compact.join('-')
    end
  end
end
