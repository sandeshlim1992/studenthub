# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: a request form's own questions (items of type 'question'). They are not Zammad
# ticket fields: the form defines them, and their answers are sent with the ticket's first message,
# checked here and saved by Student Hub (StudenthubRequestAnswer). See README → "Request forms".
#
# A question: { 'type' => 'question', 'key', 'label', 'kind', 'help', 'required', 'options' (lists) }.
# Its key comes from its label when it is added and never changes, so answers keep their meaning.
module Studenthub::RequestForms::Questions
  KINDS        = %w[text textarea select multiselect date datetime boolean integer].freeze
  OPTION_KINDS = %w[select multiselect].freeze
  MAX_OPTIONS  = 50

  # A question as admins send it, cleaned up; nil without a label. `taken` holds the keys given out
  # so far and gets this question's key; `reserved` holds the keys of the form's questions that
  # have one already, so a new question never takes an existing question's key.
  def self.normalize(item, taken, reserved = [])
    label = item[:label].to_s.strip.first(120)
    return if label.blank?

    kind = KINDS.include?(item[:kind].to_s) ? item[:kind].to_s : 'text'
    key  = item[:key].present? ? unique_key(item[:key], taken) : unique_key(label, taken + reserved)
    taken << key

    question = {
      'type'     => 'question',
      'key'      => key,
      'label'    => label,
      'kind'     => kind,
      'help'     => item[:help].to_s.strip.first(500),
      'required' => ActiveModel::Type::Boolean.new.cast(item[:required]) == true,
    }
    question['options'] = options(item[:options]) if OPTION_KINDS.include?(kind)
    question
  end

  def self.key_base(text)
    text.to_s.parameterize(separator: '_').first(40).presence || 'question'
  end

  def self.unique_key(text, taken)
    base = key_base(text)
    key  = base
    number = 1
    key = "#{base}_#{number += 1}" while taken.include?(key)
    key
  end

  def self.options(list)
    Array(list).map { |option| option.to_s.strip.first(120) }.compact_blank.uniq.first(MAX_OPTIONS)
  end

  def self.of(definition)
    Array(definition['items']).select { |item| item['type'] == 'question' }
  end

  # The answers to these questions (key => value) from what was sent: unknown keys, empty answers
  # and values of the wrong kind or outside the options are left out.
  def self.clean_answers(questions, sent)
    sent = sent.respond_to?(:to_unsafe_h) ? sent.to_unsafe_h : sent.to_h
    sent = sent.stringify_keys

    questions.each_with_object({}) do |question, answers|
      value = clean_value(question, sent[question['key']])
      answers[question['key']] = value if !value.nil?
    end
  end

  CLEANERS = {
    'text'        => ->(_question, value) { value.to_s.strip.first(1000).presence },
    'textarea'    => ->(_question, value) { value.to_s.strip.first(10_000).presence },
    'select'      => ->(question, value) { value.to_s if question['options'].include?(value.to_s) },
    'multiselect' => ->(question, value) { (Array(value).map(&:to_s) & question['options']).presence },
    'date'        => ->(_question, value) { Date.iso8601(value.to_s).iso8601 },
    'datetime'    => ->(_question, value) { Time.iso8601(value.to_s).utc.iso8601 },
    'boolean'     => ->(_question, value) { ActiveModel::Type::Boolean.new.cast(value) },
    'integer'     => ->(_question, value) { Integer(value.to_s, 10) },
  }.freeze

  def self.clean_value(question, value)
    return if value.nil? || value == '' || value == []

    CLEANERS.fetch(question['kind'], CLEANERS['text']).call(question, value)
  rescue ArgumentError, TypeError
    nil
  end

  # Required questions without an answer (a yes / no question always has one).
  def self.unanswered(questions, answers)
    questions.select { |question| question['required'] && question['kind'] != 'boolean' && !answers.key?(question['key']) }
  end

  # An answer as people read it, for the Request details block.
  def self.answer_text(question, value)
    case question['kind']
    when 'boolean'     then value ? __('yes') : __('no')
    when 'date'        then Date.iso8601(value).strftime('%-d %b %Y')
    when 'datetime'    then Time.iso8601(value).in_time_zone(Setting.get('timezone_default').presence || 'UTC').strftime('%-d %b %Y %H:%M')
    when 'multiselect' then Array(value).join(', ')
    else value.to_s
    end
  rescue ArgumentError, TypeError
    value.to_s
  end
end
