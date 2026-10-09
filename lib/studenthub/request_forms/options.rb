# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the request forms admin page offers: the categories and sub-categories a form can be for,
# and the ticket fields it can ask for (Studenthub::RequestForms).
module Studenthub::RequestForms::Options
  # The ticket fields a form can ask for: those made by admins, of a type a form can show,
  # except the fields the forms are chosen by and the Ticket Approvals columns.
  def self.field_choices
    Studenthub::RequestForms.ticket_attributes
      .where(active: true, editable: true, data_type: Studenthub::RequestForms::FIELD_TYPES)
      .where.not(name: [Studenthub::RequestForms::CATEGORY_FIELD, Studenthub::RequestForms::SUB_CATEGORY_FIELD, *Studenthub::TicketApproval::COLUMNS])
      .reorder(:position, :name)
      .map do |attribute|
        { name: attribute.name, display: attribute.display, data_type: attribute.data_type, shown_for: shown_on_new_ticket(attribute) }
      end
  end

  # Who sees the field on New ticket by its own settings ('customers', 'staff'), request form or not.
  def self.shown_on_new_ticket(attribute)
    screen = attribute.screens['create_middle'].to_h

    { 'ticket.customer' => 'customers', 'ticket.agent' => 'staff' }.filter_map do |permission, who|
      options = screen['-all-'] || screen[permission]
      who if options.present? && options['shown'] != false
    end
  end

  # The options of a select or tree select field as { value:, label: }, a tree's children
  # with their full value ("Parent::Child") and label ("Parent › Child").
  def self.option_values(name)
    attribute = Studenthub::RequestForms.ticket_attributes.find_by(name:, active: true)
    return [] if !attribute

    flatten_options(attribute.data_option[:options])
  end

  def self.flatten_options(options, parents = [])
    if options.is_a?(Hash)
      return options.map { |value, label| { value: value.to_s, label: label.to_s } }
    end

    Array(options).flat_map do |option|
      label = [*parents, option['name'].to_s]
      [{ value: option['value'].to_s, label: label.join(' › ') }, *flatten_options(option['children'], label)]
    end
  end

  # Sub-categories offered under each category. Student Hub's core workflows narrow the
  # Sub-category list for a category with "remove option"; without one, every sub-category.
  def self.sub_categories_by_category
    sub_categories = option_values(Studenthub::RequestForms::SUB_CATEGORY_FIELD)

    option_values(Studenthub::RequestForms::CATEGORY_FIELD).to_h do |category|
      removed = removed_sub_categories(category[:value])
      [category[:value], sub_categories.reject { |sub_category| removed.include?(sub_category[:value]) }]
    end
  end

  def self.removed_sub_categories(category)
    CoreWorkflow.where(active: true, object: 'Ticket').each_with_object([]) do |workflow, removed|
      condition = workflow.condition_selected.to_h
      next if condition.keys.map(&:to_s) != ["ticket.#{Studenthub::RequestForms::CATEGORY_FIELD}"]

      selected = condition.values.first
      next if selected['operator'] != 'is' || Array(selected['value']).exclude?(category)

      perform = workflow.perform.to_h["ticket.#{Studenthub::RequestForms::SUB_CATEGORY_FIELD}"]
      next if perform.blank? || Array(perform['operator']).exclude?('remove_option')

      removed.concat(Array(perform['remove_option']))
    end
  end
end
