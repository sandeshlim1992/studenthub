# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A request form (Studenthub::RequestForms). Admins edit the draft; publishing copies it to
# `published`, the definition that applies. Both have the same keys: category, sub_category,
# title, help_text, items, fields, organization_ids and role_ids. `items` is the form in order:
# its own questions ({ type: 'question', key, label, kind, … }, see Studenthub::RequestForms::Questions),
# Zammad ticket fields ({ type: 'field', name, required }), headings ({ type: 'heading', text }) and
# notes ({ type: 'note', text }); `fields` ([{ name, required }]) is its Zammad fields alone, for
# the code that only needs those (core workflow, server checks).
class StudenthubRequestForm < ApplicationModel
  belongs_to :published_by, class_name: 'User', optional: true

  validate :draft_names_a_sub_category
  validate :draft_within_limits
  validate :draft_fields_exist
  validate :one_form_per_sub_category
  validate :published_question_kinds_kept

  # The draft as admins send it, cleaned up: unknown keys dropped, ids as numbers, fields once each.
  def self.normalize_definition(input)
    input = input.respond_to?(:to_unsafe_h) ? input.to_unsafe_h : input.to_h
    input = input.with_indifferent_access
    items = normalize_items(input[:items].nil? ? field_items(input[:fields]) : input[:items])

    {
      'category'         => input[:category].to_s.strip,
      'sub_category'     => input[:sub_category].to_s.strip,
      'title'            => input[:title].to_s.strip.first(120),
      'help_text'        => input[:help_text].to_s.strip.first(1000),
      'items'            => items,
      'fields'           => items.select { |item| item['type'] == 'field' }.map { |item| item.slice('name', 'required') },
      'organization_ids' => normalize_ids(input[:organization_ids]),
      'role_ids'         => normalize_ids(input[:role_ids]),
    }
  end

  # A definition from before items (fields only) as items: its questions, in the same order.
  def self.field_items(fields)
    Array(fields).map { |field| field.to_h.merge('type' => 'field') }
  end

  # Items in order; empty headings, notes and questions are dropped, a field is asked once and
  # every question has its own key.
  def self.normalize_items(items)
    items    = Array(items).map { |item| item.to_h.with_indifferent_access }
    reserved = items.filter_map { |item| Studenthub::RequestForms::Questions.key_base(item[:key]) if item[:type].to_s == 'question' && item[:key].present? }
    taken    = []

    items.filter_map do |item|
      case item[:type].to_s
      when 'heading'  then normalize_text(item, 'heading', 120)
      when 'note'     then normalize_text(item, 'note', 1000)
      when 'field'    then normalize_field(item)
      when 'question' then Studenthub::RequestForms::Questions.normalize(item, taken, reserved)
      end
    end.uniq { |item| item['type'] == 'field' ? "field:#{item['name']}" : item.object_id }
  end

  def self.normalize_text(item, type, length)
    text = item[:text].to_s.strip.first(length)
    { 'type' => type, 'text' => text } if text.present?
  end

  def self.normalize_field(item)
    return if item[:name].blank?

    { 'type' => 'field', 'name' => item[:name].to_s, 'required' => ActiveModel::Type::Boolean.new.cast(item[:required]) == true }
  end

  def self.normalize_ids(ids)
    Array(ids).map(&:to_i).select(&:positive?).uniq.sort
  end

  # draft: never published; published: the live form is the draft; changed: the draft has changes
  # that aren't live yet.
  def status
    return 'draft' if published.nil?
    return 'published' if published == draft

    'changed'
  end

  # What stops the draft from being published, as messages for admins.
  def problems
    problems = []
    problems << __('This sub-category no longer exists.') if !sub_category_exists?(draft)
    problems << __('Add at least one field.') if draft['fields'].blank? && Studenthub::RequestForms::Questions.of(draft).blank?
    missing = missing_fields(draft)
    problems << format(__('These fields no longer exist: %s'), missing.join(', ')) if missing.present?
    problems
  end

  # The live form no longer matches the ticket fields (an admin renamed or removed a sub-category
  # or a field), so it stops applying where it no longer fits.
  def published_problems
    return [] if published.nil?

    problems = []
    problems << __('This sub-category no longer exists.') if !sub_category_exists?(published)
    missing = missing_fields(published)
    problems << format(__('These fields no longer exist: %s'), missing.join(', ')) if missing.present?
    problems
  end

  def publish!
    current = problems
    raise Exceptions::UnprocessableContent, current.join(' ') if current.present?

    Studenthub::RequestForms.prepare_fields!(draft['fields'].pluck('name'))
    update!(published: draft, published_at: Time.zone.now, published_by_id: UserInfo.current_user_id)
  end

  def unpublish!
    update!(published: nil, published_at: nil, published_by_id: nil)
  end

  # Back to the live form, dropping the draft's changes.
  def discard_changes!
    return if published.nil?

    update!(draft: published)
  end

  private

  def sub_category_exists?(definition)
    categories = Studenthub::RequestForms::Options.option_values(Studenthub::RequestForms::CATEGORY_FIELD).pluck(:value)
    sub_categories = Studenthub::RequestForms::Options.option_values(Studenthub::RequestForms::SUB_CATEGORY_FIELD).pluck(:value)

    categories.include?(definition['category']) && sub_categories.include?(definition['sub_category'])
  end

  def missing_fields(definition)
    names = Array(definition['fields']).pluck('name')
    names - Studenthub::RequestForms::Options.field_choices.pluck(:name)
  end

  def draft_names_a_sub_category
    errors.add(:base, __('Choose a category.')) if draft['category'].blank?
    errors.add(:base, __('Choose a sub-category.')) if draft['sub_category'].blank?
  end

  # Up to MAX_FIELDS questions and Zammad fields, and MAX_ITEMS items in all.
  def draft_within_limits
    asked = Array(draft['fields']).size + Studenthub::RequestForms::Questions.of(draft).size
    errors.add(:base, format(__('A form can ask for up to %s fields.'), Studenthub::RequestForms::MAX_FIELDS)) if asked > Studenthub::RequestForms::MAX_FIELDS
    errors.add(:base, format(__('A form can have up to %s fields, headings and notes together.'), Studenthub::RequestForms::MAX_ITEMS)) if Array(draft['items']).size > Studenthub::RequestForms::MAX_ITEMS
  end

  # Fields that disappear later are reported by #problems; new ones must exist.
  def draft_fields_exist
    fields   = Array(draft['fields'])
    previous = Array(draft_was.to_h['fields']).pluck('name')
    unknown  = fields.pluck('name') - previous - Studenthub::RequestForms::Options.field_choices.pluck(:name)
    errors.add(:base, format(__('These fields cannot be used: %s'), unknown.join(', '))) if unknown.present?
  end

  # One form per Category › Sub-category, so two forms never compete for the same ticket.
  def one_form_per_sub_category
    return if draft['category'].blank? || draft['sub_category'].blank?

    taken = self.class.where.not(id: id).any? do |form|
      [form.draft, form.published].compact.any? do |definition|
        definition['category'] == draft['category'] && definition['sub_category'] == draft['sub_category']
      end
    end
    return if !taken

    errors.add(:base, format(__('%s already has a request form.'), "#{draft['category']} › #{draft['sub_category']}"))
  end

  # A published question's answers must keep their meaning, so its kind can't change; the admin
  # adds a new question instead.
  def published_question_kinds_kept
    return if published.nil?

    published_kinds = Studenthub::RequestForms::Questions.of(published).to_h { |question| [question['key'], question['kind']] }
    changed = Studenthub::RequestForms::Questions.of(draft).select do |question|
      published_kinds.key?(question['key']) && published_kinds[question['key']] != question['kind']
    end
    return if changed.empty?

    errors.add(:base, format(__('The type of a published question can\'t change; add a new question instead: %s'), changed.pluck('label').join(', ')))
  end
end
