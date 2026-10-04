# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Renders the feedback request email. Templates use the same {{placeholder}} names as the
# old PHP version, so existing templates can be pasted in unchanged. Every value is
# HTML-escaped in the body; unknown placeholders are left as they are.
class Service::FeedbackCollection::RenderEmail < Service::Base
  DEFAULT_TEMPLATE_PATH = Rails.root.join('lib/studenthub/feedback_collection/default_email_template.html')
  PLACEHOLDERS = %w[ticket_number ticket_title customer_name customer_email agent_name link_1 link_2 link_3 link_4 link_5].freeze
  PATTERN = %r{\{\{\s*([a-z0-9_]+)\s*\}\}}

  attr_reader :values, :subject_template, :body_template

  # values: hash with the PLACEHOLDERS keys (see .values_for)
  def initialize(values:, subject_template: nil, body_template: nil)
    @values           = values.to_h.stringify_keys
    @subject_template = subject_template.presence || self.class.subject_template
    @body_template    = body_template.presence || self.class.body_template
  end

  def execute
    {
      subject: substitute(subject_template, escape: false).squish,
      body:    substitute(body_template, escape: true),
    }
  end

  def self.subject_template
    Setting.get('feedback_collection_email_subject').presence || 'Service Feedback Request: Ticket #{{ticket_number}}'
  end

  def self.body_template
    Setting.get('feedback_collection_email_template').presence || default_template
  end

  def self.default_template
    File.read(DEFAULT_TEMPLATE_PATH)
  end

  def self.feedback_url(token, rating = nil)
    url = "#{Setting.get('http_type')}://#{Setting.get('fqdn')}/feedback/#{token}"
    rating ? "#{url}?rating=#{rating}" : url
  end

  def self.values_for(feedback_request, token)
    links = FeedbackRequest::RATINGS.to_h { |rating| ["link_#{rating}", feedback_url(token, rating)] }

    {
      'ticket_number'  => feedback_request.ticket_number,
      'ticket_title'   => feedback_request.ticket_title,
      'customer_name'  => feedback_request.customer_name.presence || 'there',
      'customer_email' => feedback_request.customer_email,
      'agent_name'     => feedback_request.owner_name.presence || __('IT Service Desk'),
    }.merge(links)
  end

  def self.sample_values
    links = FeedbackRequest::RATINGS.to_h { |rating| ["link_#{rating}", feedback_url('preview-token', rating)] }

    {
      'ticket_number'  => '884512',
      'ticket_title'   => __('Moodle keeps logging me out'),
      'customer_name'  => 'Amira',
      'customer_email' => 'amira@example.com',
      'agent_name'     => 'Sandesh',
    }.merge(links)
  end

  private

  def substitute(template, escape:)
    template.to_s.gsub(PATTERN) do |match|
      key = Regexp.last_match(1)
      next match if !values.key?(key)

      escape ? ERB::Util.html_escape(values[key].to_s) : values[key].to_s
    end
  end
end
