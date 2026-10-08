# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# One feedback request emailed to a customer after their ticket was closed, and the
# rating they gave. Ticket, customer, owner and group are also kept as plain text so that
# imported or deleted records stay readable.
class FeedbackRequest < ApplicationModel
  STATES  = %w[pending sent failed submitted].freeze
  SOURCES = %w[native import].freeze
  RATINGS = (1..5)

  DEFAULT_CONFIG = {
    channel_id:        nil,
    from_name:         __('Student Hub Feedback'),
    from_email:        '',
    reply_to:          '',
    notify_email:      '',
    group_ids:         [],
    require_owner:     true,
    skip_tags:         ['spam'],
    resend_after_days: 0,
    add_internal_note: false,
  }.freeze

  belongs_to :ticket,   optional: true
  belongs_to :customer, class_name: 'User', optional: true
  belongs_to :owner,    class_name: 'User', optional: true
  belongs_to :group,    optional: true

  before_validation :ensure_token_digest

  validates :ticket_number, presence: true
  validates :token_digest,  presence: true, uniqueness: true
  validates :state,  inclusion: { in: STATES }
  validates :source, inclusion: { in: SOURCES }
  validates :rating, inclusion: { in: RATINGS }, allow_nil: true

  scope :submitted, -> { where(state: 'submitted') }

  def self.enabled?
    Setting.get('feedback_collection') == true
  end

  def self.config
    DEFAULT_CONFIG.merge((Setting.get('feedback_collection_config') || {}).to_h.symbolize_keys).with_indifferent_access
  end

  # The admin page stores simple rules; they are evaluated with Zammad's ticket selector,
  # the same engine triggers use, so they can grow into full conditions later.
  def self.condition(config = self.config)
    conditions = []

    group_ids = Array(config[:group_ids]).compact_blank.map(&:to_s)
    conditions << { name: 'ticket.group_id', operator: 'is', value: group_ids } if group_ids.any?
    conditions << { name: 'ticket.owner_id', operator: 'is not', pre_condition: 'not_set', value: [] } if ActiveModel::Type::Boolean.new.cast(config[:require_owner])

    skip_tags = Array(config[:skip_tags]).map { |tag| tag.to_s.strip }.compact_blank
    conditions << { name: 'ticket.tags', operator: 'contains one not', value: skip_tags.join(', ') } if skip_tags.any?

    return if conditions.empty?

    { operator: 'AND', conditions: conditions }
  end

  def self.generate_token
    SecureRandom.hex(32)
  end

  def self.digest(token)
    Digest::SHA256.hexdigest(token.to_s)
  end

  def self.lookup_by_token(token)
    return if token.blank? || token.to_s.length > 128

    find_by(token_digest: digest(token))
  end

  # Replaces the stored digest with one for a fresh token and returns the token,
  # which exists only in the email that is about to be sent.
  def regenerate_token!
    token = self.class.generate_token
    update!(token_digest: self.class.digest(token))
    token
  end

  def awaiting_feedback?
    state == 'sent'
  end

  def submitted?
    state == 'submitted'
  end

  def as_api_json
    {
      id:             id,
      ticket_id:      ticket_id,
      ticket_number:  ticket_number,
      ticket_title:   ticket_title,
      customer_name:  customer_name,
      customer_email: customer_email,
      owner_name:     owner_name,
      group_name:     group_name,
      state:          state,
      source:         source,
      sent_at:        sent_at,
      error:          error,
      rating:         rating,
      comments:       comments,
      rated_at:       rated_at,
      created_at:     created_at,
    }
  end

  private

  def ensure_token_digest
    self.token_digest ||= self.class.digest(self.class.generate_token)
  end
end
