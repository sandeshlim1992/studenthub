# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what the new UI's condition and action editors offer (Scheduler): states, priorities,
# teams, agents, organisations, webhooks and the ticket's select fields with their options (tree
# fields flattened, "Parent › Child"). Inactive records are included, marked, so existing jobs that
# use them still show their names.
class Service::StudenthubAutomation::Options < Service::Base
  SELECT_TYPES = %w[select multiselect tree_select multi_tree_select boolean].freeze

  # Fields that have their own list above, or can't be set by automation.
  SKIPPED_FIELDS = %w[group_id owner_id state_id priority_id organization_id customer_id approval_state approval_approver_id approval_requested_by_id].freeze

  def execute
    {
      states:            rows(Ticket::State.reorder(:name)),
      priorities:        rows(Ticket::Priority.reorder(:name)),
      groups:            Group.reorder(:name).map { |group| { id: group.id, name: group.fullname, active: group.active } },
      agents:            User.with_permissions('ticket.agent').where.not(id: 1).reorder(:firstname, :lastname).map { |user| { id: user.id, name: user.fullname, active: user.active } },
      organizations:     rows(Organization.reorder(:name)),
      webhooks:          rows(Webhook.reorder(:name)),
      ticket_attributes: ticket_attributes,
    }
  end

  private

  def rows(scope)
    scope.map { |record| { id: record.id, name: record.name, active: record.active } }
  end

  def ticket_attributes
    ObjectManager::Attribute.list_full
      .map(&:with_indifferent_access)
      .select { |attribute| attribute[:object].to_s == 'Ticket' && SELECT_TYPES.include?(attribute[:data_type]) }
      .reject { |attribute| SKIPPED_FIELDS.include?(attribute[:name]) }
      .sort_by { |attribute| attribute[:display].to_s.downcase }
      .map do |attribute|
        {
          name:      attribute[:name],
          display:   attribute[:display],
          data_type: attribute[:data_type],
          active:    attribute[:active],
          options:   flatten_options(attribute.dig(:data_option, :options)),
        }
      end
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
