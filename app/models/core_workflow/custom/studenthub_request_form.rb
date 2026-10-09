# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: applies the published request forms (Studenthub::RequestForms).
#
# New ticket: once Category and Sub-category match a form meant for the ticket's customer, its
# fields are shown and the required ones made mandatory (the server checks the same when the ticket
# is created). Customers don't get sub-categories whose form is limited to other organisations or
# roles. On a ticket, fields that only exist for request forms are left out unless its form asks for
# them or they hold a value.
class CoreWorkflow::Custom::StudenthubRequestForm < CoreWorkflow::Custom::Backend
  def saved_attribute_match?
    object?(Ticket)
  end

  def selected_attribute_match?
    object?(Ticket)
  end

  def perform
    return if forms.blank?

    if screen?('create_middle')
      perform_create
    elsif screen?('edit')
      perform_edit
    end
  end

  private

  def forms
    @forms ||= Studenthub::RequestForms.live
  end

  def perform_create
    remove_sub_categories_for_others if !current_user&.permissions?('ticket.agent')

    form = Studenthub::RequestForms.applicable(value(category_field), value(sub_category_field), customer)
    return if !form

    form['fields'].each do |field|
      # A field deleted since the form was published (the admin page flags the form).
      next if !@result_object.attributes.object_elements_hash.key?(field['name'])

      result('show', field['name'])
      result(field['required'] ? 'set_mandatory' : 'set_optional', field['name'])
    end
  end

  # Only under the form's own category: the same sub-category name can exist under another one.
  def remove_sub_categories_for_others
    removed = forms.filter_map do |form|
      next if form['category'] != value(category_field)
      next if Studenthub::RequestForms.for_customer?(form, customer)

      form['sub_category']
    end
    return if removed.blank?

    result('remove_option', sub_category_field, removed)
  end

  def perform_edit
    form = forms.find { |candidate| candidate['category'] == value(category_field) && candidate['sub_category'] == value(sub_category_field) }
    asked_for = form ? form['fields'].pluck('name') : []

    Studenthub::RequestForms.request_only_field_names.each do |name|
      next if asked_for.include?(name)
      next if value(name).present?

      result('remove', name)
    end
  end

  # The ticket's customer: the person raising it, or whom an agent raises it for.
  def customer
    return @customer if defined?(@customer)

    @customer = params['customer_id'].to_s.match?(%r{\A\d+\z}) ? User.find_by(id: params['customer_id']) : nil
  end

  def value(name)
    return params[name] if params.key?(name)

    saved&.try(name)
  end

  def category_field
    Studenthub::RequestForms::CATEGORY_FIELD
  end

  def sub_category_field
    Studenthub::RequestForms::SUB_CATEGORY_FIELD
  end
end
