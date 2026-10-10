# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: request forms. An admin picks a Category › Sub-category and the extra ticket fields
# asked for when a ticket is raised under it, optionally only for some organisations or roles.
# The published forms are applied by the core workflow module CoreWorkflow::Custom::StudenthubRequestForm
# (every New ticket form, and the server's own check); the student wizard reads them through
# StudenthubRequestFormsController#applicable. See README → "Request forms".
module Studenthub::RequestForms
  # Student Hub's own ticket fields (made by admins) that a form is chosen by.
  CATEGORY_FIELD     = 'category2'.freeze
  SUB_CATEGORY_FIELD = 'subcategory'.freeze

  # Ticket field types a request form can ask for.
  FIELD_TYPES = %w[input textarea select multiselect tree_select multi_tree_select boolean integer date datetime].freeze
  MAX_FIELDS  = 20 # questions per form
  MAX_ITEMS   = 60 # questions, headings and notes together

  WORKFLOW_NAME = 'Student Hub - request forms'.freeze # rubocop:disable Zammad/DetectTranslatableString -- a record name, not shown
  PERMISSION    = 'admin.request_forms'.freeze

  # The published forms (their definitions with string keys, plus 'id' and 'version', the time it
  # was published). Cached until a form changes.
  def self.live
    Rails.cache.fetch(['Studenthub::RequestForms.live', forms_version]) do
      StudenthubRequestForm.where.not(published: nil).reorder(:id).map do |form|
        form.published.merge('id' => form.id, 'version' => form.published_at&.iso8601)
      end
    end
  end

  # The published form for this Category › Sub-category that is meant for the customer, if any.
  def self.applicable(category, sub_category, customer)
    return if category.blank? || sub_category.blank?

    live.find do |form|
      form['category'] == category && form['sub_category'] == sub_category && for_customer?(form, customer)
    end
  end

  # A form limited to organisations or roles is for customers in one of them; the others for everyone.
  def self.for_customer?(form, customer)
    organization_ids = Array(form['organization_ids'])
    role_ids         = Array(form['role_ids'])
    return true if organization_ids.blank? && role_ids.blank?
    return false if !customer

    customer.all_organization_ids.intersect?(organization_ids) || customer.role_ids.intersect?(role_ids)
  end

  # Fields of the published forms that nobody sees on New ticket by their own settings: they only
  # appear through request forms, so on a ticket they show only where its form asks for them.
  def self.request_only_field_names
    names = live.flat_map { |form| form['fields'].pluck('name') }.uniq
    return [] if names.blank?

    Rails.cache.fetch(['Studenthub::RequestForms.request_only', forms_version, ticket_attributes.maximum(:updated_at).to_f]) do
      ticket_attributes.where(name: names).select { |attribute| request_only?(attribute) }.map(&:name)
    end
  end

  def self.request_only?(attribute)
    screen = attribute.screens['create_middle']
    return true if screen.blank?

    screen.values.none? { |options| options.present? && options['shown'] != false }
  end

  # A field is in someone's ticket form only if its settings mention their permission. Publishing
  # adds a hidden New ticket entry for customers and agents where there is none (the core workflow
  # shows the field when a form asks for it), and lets agents see the answer on the ticket.
  # Settings that are already there are kept.
  def self.prepare_fields!(names)
    ticket_attributes.where(name: names).find_each do |attribute|
      screens = attribute.screens.to_h.deep_dup
      changed = add_missing_screen(screens, 'create_middle', 'ticket.customer', { 'shown' => false, 'required' => false })
      changed = add_missing_screen(screens, 'create_middle', 'ticket.agent', { 'shown' => false, 'required' => false }) || changed
      changed = add_missing_screen(screens, 'edit', 'ticket.agent', { 'shown' => true, 'required' => false }) || changed
      next if !changed

      attribute.screens = screens
      attribute.save!
    end
  end

  def self.add_missing_screen(screens, screen, permission, options)
    entries = screens[screen].to_h
    return false if entries.key?('-all-') || entries.key?(permission)

    screens[screen] = entries.merge(permission => options)
    true
  end

  def self.ticket_attributes
    ObjectManager::Attribute.where(object_lookup_id: ObjectLookup.by_name('Ticket'))
  end

  # Changes when a form is added, changed or deleted.
  def self.forms_version
    StudenthubRequestForm.pick(Arel.sql('COUNT(*)'), Arel.sql('MAX(updated_at)')).join('/')
  end
end
