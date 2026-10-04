# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admin API for the Feedback Collection page under /desktop/manage, plus one read-only
# endpoint agents use to show a ticket's rating in the ticket sidebar.
class FeedbackCollectionController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  SORTABLE = %w[rated_at created_at sent_at ticket_number owner_name customer_name customer_email group_name rating state].freeze
  PER_PAGE = [10, 25, 50, 100].freeze
  EMAIL_CHANNEL_AREAS = %w[Email::Account Microsoft365::Account Google::Account MicrosoftGraph::Account Email::Notification].freeze
  CONFIG_KEYS = %i[channel_id from_name from_email reply_to notify_email group_ids require_owner skip_tags resend_after_days add_internal_note].freeze

  # GET /api/v1/feedback_collection/requests
  def index
    per_page = PER_PAGE.include?(params[:per_page].to_i) ? params[:per_page].to_i : 25
    page     = [params[:page].to_i, 1].max
    scope    = filtered_scope

    render json: {
      items:    scope.reorder(sort_clause).offset((page - 1) * per_page).limit(per_page).map(&:as_api_json),
      total:    scope.count,
      page:     page,
      per_page: per_page,
    }
  end

  # GET /api/v1/feedback_collection/requests/:id
  def show
    render json: FeedbackRequest.find(params[:id]).as_api_json
  end

  # DELETE /api/v1/feedback_collection/requests/:id
  def destroy
    FeedbackRequest.find(params[:id]).destroy!
    render json: {}, status: :ok
  end

  # GET /api/v1/feedback_collection/export
  def export
    send_data Service::FeedbackCollection::ExportCsv.execute(scope: filtered_scope(default_state: 'submitted')),
              filename:    Service::FeedbackCollection::ExportCsv.filename,
              type:        'text/csv; charset=utf-8',
              disposition: 'attachment'
  end

  # GET /api/v1/feedback_collection/report
  def report
    render json: Service::FeedbackCollection::Report.execute(from: params[:from], to: params[:to])
  end

  # GET /api/v1/feedback_collection/settings
  def settings
    render json: settings_payload
  end

  # PUT /api/v1/feedback_collection/settings
  def update_settings
    config = sanitized_config
    errors = config_errors(config)
    if errors.any?
      render json: { error: errors.join(' ') }, status: :unprocessable_content
      return
    end

    Setting.set('feedback_collection_config', config)
    Setting.set('feedback_collection', ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true) if params.key?(:enabled)
    Setting.set('feedback_collection_email_subject', params[:subject].to_s.strip.truncate(250)) if params[:subject].present?
    Setting.set('feedback_collection_email_template', normalized_template) if params.key?(:template)

    render json: settings_payload
  end

  # POST /api/v1/feedback_collection/preview
  def preview
    render json: Service::FeedbackCollection::RenderEmail.execute(
      values:           Service::FeedbackCollection::RenderEmail.sample_values,
      subject_template: params[:subject],
      body_template:    params[:template],
    )
  end

  # POST /api/v1/feedback_collection/test_email
  def test_email
    to = params[:to].presence || current_user.email
    if !EmailAddressValidation.new(to.to_s).valid?
      render json: { error: "#{to.presence || __('Your account')} is not a valid email address." }, status: :unprocessable_content
      return
    end

    email = Service::FeedbackCollection::RenderEmail.execute(values: Service::FeedbackCollection::RenderEmail.sample_values)
    Service::FeedbackCollection::DeliverRequest.deliver(
      Service::FeedbackCollection::DeliverRequest.delivery_channel!,
      to:      to,
      subject: "[Test] #{email[:subject]}",
      body:    email[:body],
    )

    render json: { sent_to: to }
  rescue => e
    render json: { error: e.message }, status: :unprocessable_content
  end

  # GET /api/v1/feedback_collection/tickets/:ticket_id
  def ticket
    ticket = Ticket.find(params[:ticket_id])
    authorize!(ticket, :show?)

    render json: {
      items: FeedbackRequest.submitted.where(ticket_id: ticket.id).reorder(rated_at: :desc).map do |row|
        row.as_api_json.slice(:id, :rating, :comments, :rated_at, :customer_name, :owner_name)
      end
    }
  end

  private

  def filtered_scope(default_state: 'submitted')
    scope = FeedbackRequest.all

    state = params[:state].presence || default_state
    scope = scope.where(state: state) if FeedbackRequest::STATES.include?(state)

    rating = params[:rating].to_i
    scope = scope.where(rating: rating) if FeedbackRequest::RATINGS.include?(rating)

    date_column = state == 'submitted' ? :rated_at : :created_at
    from = parse_date(params[:from])
    to   = parse_date(params[:to])
    scope = scope.where(date_column => from.beginning_of_day..) if from
    scope = scope.where(date_column => ..to.end_of_day) if to

    if params[:query].present?
      term = "%#{FeedbackRequest.sanitize_sql_like(params[:query].to_s.strip)}%"
      scope = scope.where(
        'ticket_number ILIKE :t OR ticket_title ILIKE :t OR customer_name ILIKE :t OR customer_email ILIKE :t OR owner_name ILIKE :t OR comments ILIKE :t',
        t: term
      )
    end

    scope
  end

  def sort_clause
    column    = SORTABLE.include?(params[:sort_by]) ? params[:sort_by] : 'rated_at'
    direction = params[:order_by].to_s.casecmp('asc').zero? ? 'ASC' : 'DESC'
    Arel.sql("feedback_requests.#{column} #{direction} NULLS LAST, feedback_requests.id #{direction}")
  end

  def parse_date(value)
    return if value.blank?

    Date.iso8601(value.to_s)
  rescue Date::Error
    nil
  end

  def sanitized_config # rubocop:disable Metrics/AbcSize
    input  = params[:config].respond_to?(:permit) ? params[:config].permit(*CONFIG_KEYS - %i[group_ids skip_tags], group_ids: [], skip_tags: []).to_h : {}
    config = FeedbackRequest.config.merge(input.symbolize_keys)

    {
      channel_id:        config[:channel_id].presence&.to_i,
      from_name:         config[:from_name].to_s.strip.truncate(150),
      from_email:        config[:from_email].to_s.strip,
      reply_to:          config[:reply_to].to_s.strip,
      notify_email:      config[:notify_email].to_s.strip,
      group_ids:         Array(config[:group_ids]).filter_map { |id| Integer(id.to_s, exception: false) }.uniq,
      require_owner:     ActiveModel::Type::Boolean.new.cast(config[:require_owner]) == true,
      skip_tags:         Array(config[:skip_tags]).map { |tag| tag.to_s.strip }.compact_blank.uniq,
      resend_after_days: config[:resend_after_days].to_i.clamp(0, 3650),
      add_internal_note: ActiveModel::Type::Boolean.new.cast(config[:add_internal_note]) == true,
    }
  end

  def config_errors(config)
    errors = []
    errors << __('The selected email channel does not exist.') if config[:channel_id] && !Channel.exists?(id: config[:channel_id], area: EMAIL_CHANNEL_AREAS)
    %i[from_email reply_to notify_email].each do |key|
      next if config[key].blank?
      next if EmailAddressValidation.new(config[key]).valid?

      errors << "#{config[key]} is not a valid email address."
    end
    if ActiveModel::Type::Boolean.new.cast(params[:enabled]) == true && (config[:channel_id].blank? || config[:from_email].blank?)
      errors << __('Choose an email channel and a sender address before turning feedback collection on.')
    end
    errors
  end

  # The built-in default is stored as blank so later improvements to it apply automatically.
  def normalized_template
    template = params[:template].to_s
    return '' if template.strip.blank?
    return '' if template.strip == Service::FeedbackCollection::RenderEmail.default_template.strip

    template
  end

  def settings_payload
    {
      enabled:          FeedbackRequest.enabled?,
      config:           FeedbackRequest.config,
      subject:          Service::FeedbackCollection::RenderEmail.subject_template,
      template:         Service::FeedbackCollection::RenderEmail.body_template,
      template_custom:  Setting.get('feedback_collection_email_template').present?,
      default_template: Service::FeedbackCollection::RenderEmail.default_template,
      placeholders:     Service::FeedbackCollection::RenderEmail::PLACEHOLDERS,
      channels:         email_channels,
      groups:           Group.reorder(:name).map { |group| { id: group.id, name: group.name, active: group.active } },
      feedback_url:     "#{Setting.get('http_type')}://#{Setting.get('fqdn')}/feedback/",
    }
  end

  def email_channels
    Channel.where(area: EMAIL_CHANNEL_AREAS).reorder(:id).map do |channel|
      addresses = EmailAddress.where(channel_id: channel.id).pluck(:email)
      account   = channel.options.dig(:inbound, :options, :user) || channel.options.dig(:outbound, :options, :user)
      {
        id:      channel.id,
        area:    channel.area,
        active:  channel.active,
        adapter: channel.options.dig(:outbound, :adapter),
        label:   [addresses.first || account || channel.area, channel.area.split('::').first].compact.uniq.join(' · '),
      }
    end
  end
end
