# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the "Request details" block written at the top of a ticket's first message when it
# is raised under a request form: the form's headings and the answers to its own questions and
# Zammad fields, in the form's order, as they are at creation. Unanswered questions and notes are
# left out. See README → "Request forms".
module Studenthub::RequestForms::Details
  # The block for this form and ticket as HTML (html: true) or plain text, or nil when nothing
  # was answered. `answers` holds the cleaned answers to the form's own questions (key => value).
  def self.build(form, ticket, html:, answers: {})
    groups = answered_groups(form, ticket, answers)
    return if groups.blank?

    title = "#{__('Request details')} · #{form['sub_category']}"
    html ? as_html(title, groups) : as_text(title, groups)
  end

  # [{ heading:, rows: [[label, answer], …] }, …]; questions before the first heading are in a
  # group without a heading. Groups without answers are left out.
  def self.answered_groups(form, ticket, answers = {})
    attributes = Studenthub::RequestForms.ticket_attributes.where(name: Array(form['fields']).pluck('name')).index_by(&:name)
    groups = [{ heading: nil, rows: [] }]

    Array(form['items']).each do |item|
      if item['type'] == 'heading'
        groups << { heading: item['text'], rows: [] }
        next
      end

      row = item['type'] == 'question' ? question_row(item, answers) : field_row(item, attributes, ticket)
      groups.last[:rows] << row if row
    end

    groups.select { |group| group[:rows].present? }
  end

  # [label, answer] for a form's own question, or nil when it wasn't answered.
  def self.question_row(item, answers)
    return if !answers.key?(item['key'])

    [item['label'], Studenthub::RequestForms::Questions.answer_text(item, answers[item['key']])]
  end

  # [label, answer] for a Zammad field (notes and unknown items give nil), or nil when empty.
  def self.field_row(item, attributes, ticket)
    attribute = item['type'] == 'field' && attributes[item['name']]
    return if !attribute

    answer = answer_text(attribute, ticket[attribute.name])
    [attribute.display, answer] if answer.present?
  end

  # How each type of ticket field's answer is written.
  ANSWER_FORMATS = {
    'boolean'           => :boolean_answer,
    'date'              => :date_answer,
    'datetime'          => :datetime_answer,
    'select'            => :option_answer,
    'multiselect'       => :option_answer,
    'tree_select'       => :tree_answer,
    'multi_tree_select' => :tree_answer,
  }.freeze

  def self.answer_text(attribute, value)
    return if value.nil? || value == '' || value == []

    send(ANSWER_FORMATS.fetch(attribute.data_type, :text_answer), attribute, value)
  rescue ArgumentError, TypeError
    value.to_s
  end

  def self.boolean_answer(attribute, value)
    option_label(attribute, value) || (value ? __('yes') : __('no'))
  end

  def self.date_answer(_attribute, value)
    date = value.is_a?(String) ? Date.parse(value) : value.to_date
    date.strftime('%-d %b %Y')
  end

  def self.datetime_answer(_attribute, value)
    time = value.is_a?(String) ? Time.zone.parse(value) : value
    time.in_time_zone(Setting.get('timezone_default').presence || 'UTC').strftime('%-d %b %Y %H:%M')
  end

  def self.option_answer(attribute, value)
    Array(value).map { |one| option_label(attribute, one) || one.to_s }.join(', ')
  end

  def self.tree_answer(_attribute, value)
    Array(value).map { |one| one.to_s.gsub('::', ' › ') }.join(', ')
  end

  def self.text_answer(_attribute, value)
    value.to_s.strip.presence
  end

  # The label of a select or yes / no option ({ value => label } in the field's settings).
  def self.option_label(attribute, value)
    options = attribute.data_option.to_h.with_indifferent_access[:options]
    return if !options.is_a?(Hash)

    options[value.to_s]
  end

  def self.as_html(title, groups)
    esc = ->(text) { ERB::Util.html_escape(text.to_s).gsub("\n", '<br>') }

    parts = ["<p><strong>#{esc.call(title)}</strong></p>"]
    groups.each do |group|
      parts << "<p><strong>#{esc.call(group[:heading])}</strong></p>" if group[:heading].present?
      rows = group[:rows].map { |label, answer| "<tr><td>#{esc.call(label)}</td><td>#{esc.call(answer)}</td></tr>" }
      parts << "<table><tbody>#{rows.join}</tbody></table>"
    end
    parts << '<hr>'
    parts.join
  end

  def self.as_text(title, groups)
    lines = [title, '']
    groups.each do |group|
      lines << group[:heading].upcase if group[:heading].present?
      group[:rows].each { |label, answer| lines << "#{label}: #{answer}" }
      lines << ''
    end
    lines << ('-' * 40)
    "#{lines.join("\n")}\n"
  end
end
