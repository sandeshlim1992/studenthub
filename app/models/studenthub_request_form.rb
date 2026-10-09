# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A request form (Studenthub::RequestForms). Admins edit the draft; publishing copies it to
# `published`, the definition that applies. Both have the same keys: category, sub_category,
# title, help_text, fields ([{ name, required }] in order), organization_ids and role_ids.
class StudenthubRequestForm < ApplicationModel
  belongs_to :published_by, class_name: 'User', optional: true

  validate :draft_names_a_sub_category
  validate :draft_fields_exist
  validate :one_form_per_sub_category

  # The draft as admins send it, cleaned up: unknown keys dropped, ids as numbers, fields once each.
  def self.normalize_definition(input)
    input = input.respond_to?(:to_unsafe_h) ? input.to_unsafe_h : input.to_h
    input = input.with_indifferent_access

    {
      'category'         => input[:category].to_s.strip,
      'sub_category'     => input[:sub_category].to_s.strip,
      'title'            => input[:title].to_s.strip.first(120),
      'help_text'        => input[:help_text].to_s.strip.first(1000),
      'fields'           => normalize_fields(input[:fields]),
      'organization_ids' => normalize_ids(input[:organization_ids]),
      'role_ids'         => normalize_ids(input[:role_ids]),
    }
  end

  def self.normalize_fields(fields)
    Array(fields).filter_map do |field|
      field = field.to_h.with_indifferent_access
      next if field[:name].blank?

      { 'name' => field[:name].to_s, 'required' => ActiveModel::Type::Boolean.new.cast(field[:required]) == true }
    end.uniq { |field| field['name'] }
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
    problems << __('Add at least one field.') if draft['fields'].blank?
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

  # Fields that disappear later are reported by #problems; new ones must exist.
  def draft_fields_exist
    fields = Array(draft['fields'])
    errors.add(:base, format(__('A form can ask for up to %s fields.'), Studenthub::RequestForms::MAX_FIELDS)) if fields.size > Studenthub::RequestForms::MAX_FIELDS

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
end
