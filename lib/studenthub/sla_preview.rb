# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: which SLA a ticket would get, before it exists (New ticket screen).
#
# Zammad matches SLA conditions with a database query on the saved ticket (Sla.for_ticket).
# Here the simple conditions ("ticket.<field> is / is not <values>") are checked against the
# form's values instead, in the same order as Zammad. A condition that can't be checked that way
# (another operator, an expert condition, a field the form doesn't have) makes the result unknown.
module Studenthub::SlaPreview
  OPERATORS = ['is', 'is not'].freeze

  # @param values [Hash] ticket attribute name => value, e.g. { 'priority_id' => '4' }
  # @return [Hash] { status: 'match' | 'none' | 'unknown', sla: Sla | nil }
  def self.for(values)
    values   = values.to_h.transform_keys(&:to_s)
    fallback = nil

    Sla.reorder(:name, :created_at).each do |sla|
      if sla.condition.blank?
        fallback = sla
        next
      end

      case match(sla.condition, values)
      when true then return { status: 'match', sla: }
      when nil  then return { status: 'unknown', sla: nil }
      end
    end

    fallback ? { status: 'match', sla: fallback } : { status: 'none', sla: nil }
  end

  # true / false, or nil when it can't be decided before the ticket exists.
  def self.match(condition, values)
    condition = condition.to_h.with_indifferent_access
    return if condition.key?(:conditions) # expert conditions

    results = condition.map { |key, rule| rule_match(key, rule, values) }
    return if results.include?(nil)

    results.all?
  end

  def self.rule_match(key, rule, values)
    object, field = key.to_s.split('.', 2)
    return if object != 'ticket' || !rule.is_a?(Hash) || OPERATORS.exclude?(rule[:operator]) || rule[:pre_condition].present?
    return if !values.key?(field)

    included = Array(values[field]).map(&:to_s).intersect?(Array(rule[:value]).map(&:to_s))
    rule[:operator] == 'is' ? included : !included
  end
end
