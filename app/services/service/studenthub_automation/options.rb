# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what the new UI's condition and action editors offer (Scheduler, Triggers, Macros,
# Templates, SLAs, Report Profiles, Time Accounting): states, priorities, teams, agents, organisations,
# webhooks, message senders and types, roles, calendars, the ticket's select fields with their options
# (tree fields flattened, "Parent › Child"), and the fields of tickets, users and organisations with
# their types, from which the editors build the conditions and actions of each field. Inactive records
# are included, marked, so existing records that use them still show their names.
class Service::StudenthubAutomation::Options < Service::Base
  SELECT_TYPES = %w[select multiselect tree_select multi_tree_select boolean].freeze

  # Fields that have their own list above, or can't be set by automation.
  SKIPPED_FIELDS = %w[group_id owner_id state_id priority_id organization_id customer_id approval_state approval_approver_id approval_requested_by_id].freeze

  # Field types the editors know. Lists of ids (roles, teams, organisations) have their own fields.
  FIELD_TYPES = %w[
    input textarea richtext select multiselect tree_select multi_tree_select boolean active integer date datetime
    autocompletion_ajax user_autocompletion autocompletion_ajax_customer_organization
  ].freeze

  FIELD_OBJECTS = { ticket: 'Ticket', user: 'User', organization: 'Organization' }.freeze

  def execute
    {
      states:            rows(Ticket::State.reorder(:name)),
      priorities:        rows(Ticket::Priority.reorder(:name)),
      groups:            Group.reorder(:name).map { |group| { id: group.id, name: group.fullname, active: group.active } },
      agents:            User.with_permissions('ticket.agent').where.not(id: 1).reorder(:firstname, :lastname).map { |user| { id: user.id, name: user.fullname, active: user.active } },
      organizations:     rows(Organization.reorder(:name)),
      webhooks:          rows(Webhook.reorder(:name)),
      article_senders:   always_active_rows(Ticket::Article::Sender.reorder(:id)),
      article_types:     rows(Ticket::Article::Type.reorder(:name)),
      roles:             rows(Role.reorder(:name)),
      calendars:         always_active_rows(Calendar.reorder(:name)),
      ticket_attributes: ticket_attributes,
      attributes:        FIELD_OBJECTS.transform_values { |object| fields_of(object) },
    }
  end

  private

  def rows(scope)
    scope.map { |record| { id: record.id, name: record.name, active: record.active } }
  end

  # Message senders and calendars can't be switched off.
  def always_active_rows(scope)
    scope.map { |record| { id: record.id, name: record.name, active: true } }
  end

  def ticket_attributes
    attributes_of('Ticket')
      .select { |attribute| SELECT_TYPES.include?(attribute[:data_type]) }
      .reject { |attribute| SKIPPED_FIELDS.include?(attribute[:name]) }
      .map { |attribute| describe(attribute) }
  end

  def fields_of(object)
    attributes_of(object)
      .select { |attribute| FIELD_TYPES.include?(attribute[:data_type]) }
      .reject { |attribute| attribute[:name].end_with?('_ids') || attribute.dig(:data_option, :type) == 'password' }
      .map { |attribute| describe(attribute) }
  end

  def attributes_of(object)
    all_attributes
      .select { |attribute| attribute[:object].to_s == object }
      .sort_by { |attribute| attribute[:display].to_s.downcase }
  end

  def all_attributes
    @all_attributes ||= ObjectManager::Attribute.list_full.map(&:with_indifferent_access)
  end

  def describe(attribute)
    {
      name:      attribute[:name],
      display:   attribute[:display],
      data_type: attribute[:data_type],
      active:    attribute[:active],
      relation:  attribute.dig(:data_option, :relation).presence,
      options:   flatten_options(attribute.dig(:data_option, :options)),
    }
  end

  # select: { key => label }; tree_select: [{ name, value, children }]
  def flatten_options(options, parents = [])
    case options
    when Hash
      options.map { |value, label| { value: value.to_s, label: label.to_s } }
    when Array
      options.flat_map do |option|
        option = option.with_indifferent_access
        path   = parents + [option[:name].to_s]
        [{ value: option[:value].to_s, label: path.join(' › ') }] + flatten_options(option[:children], path)
      end
    else
      []
    end
  end
end
