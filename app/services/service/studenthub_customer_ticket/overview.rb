# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what the student's column on the ticket screen shows. A summary of the request,
# where it stands (four steps), the files shared in the conversation, what the student can do
# (close, reopen) and the rating Feedback Collection asks for once the ticket is closed.
class Service::StudenthubCustomerTicket::Overview < Service::Base
  requires_current_user!

  # The ticket's own fields on the summary, as Category › Sub-category and Campus.
  CATEGORY_FIELD     = 'category2'.freeze
  SUB_CATEGORY_FIELD = 'subcategory'.freeze
  CAMPUS_FIELD       = 'campus'.freeze

  # Received → With the team → Being worked on → Resolved; a closed ticket has done them all.
  STEPS = {
    'received'        => 0,
    'with_team'       => 1,
    'in_progress'     => 2,
    'waiting_for_you' => 2,
    'on_hold'         => 2,
    'review'          => 2,
    'resolved'        => 3,
    'closed'          => 4,
  }.freeze

  attr_reader :ticket

  def initialize(ticket:)
    @ticket = ticket
  end

  # Zammad files most of this site's states under the type "open", so the stage also reads the
  # state's name (as the ticket list colours do).
  def self.stage(ticket)
    state = ticket.state
    type  = state.state_type.name

    return 'closed' if %w[closed merged].include?(type)
    return 'review' if ticket.try(:approval_state) == 'pending'
    return 'resolved' if state.name.match?(%r{resolv|solved}i)
    return 'waiting_for_you' if state.name.match?(%r{await|waiting\s+(for\s+)?(you|user|customer|reply)}i)
    return 'on_hold' if type.start_with?('pending')
    return 'received' if type == 'new'
    return 'in_progress' if state.name.match?(%r{progress|working}i)

    'with_team'
  end

  def execute
    stage = self.class.stage(ticket)

    {
      id:                 ticket.id,
      number:             ticket.number,
      title:              ticket.title,
      team:               ticket.group&.name_last,
      created_at:         ticket.created_at,
      last_team_reply_at: ticket.last_contact_agent_at,
      fields:             fields,
      progress:           { stage:, step: STEPS.fetch(stage) },
      files:              files,
      actions:            actions(stage),
      feedback:           feedback,
    }
  end

  private

  def policy
    @policy ||= TicketPolicy.new(current_user, ticket)
  end

  def fields
    category = [CATEGORY_FIELD, SUB_CATEGORY_FIELD].filter_map { |name| display_value(name) }

    [
      category.any? ? { name: CATEGORY_FIELD, label: label(CATEGORY_FIELD), value: category.join(' › ') } : nil,
      display_value(CAMPUS_FIELD) ? { name: CAMPUS_FIELD, label: label(CAMPUS_FIELD), value: display_value(CAMPUS_FIELD) } : nil,
    ].compact
  end

  def attribute(name)
    @attributes ||= {}
    return @attributes[name] if @attributes.key?(name)

    @attributes[name] = ObjectManager::Attribute.get(object: 'Ticket', name:)
  end

  def label(name)
    attribute(name)&.display.presence || name.humanize
  end

  def display_value(name)
    return if !ticket.has_attribute?(name)

    values = Array.wrap(ticket[name]).compact_blank
    return if values.empty?

    values.map { |value| option_name(attribute(name)&.data_option&.dig(:options), value.to_s) }.join(', ')
  end

  # Select fields keep { value => name }; a tree select's value is already its path ("A::B").
  def option_name(options, value)
    name = options[value] || options[value.to_sym] if options.is_a?(Hash)

    (name.presence || value).to_s.gsub('::', ' › ')
  end

  # Files from the messages the student can see; images pasted into a message stay in it.
  def files
    ticket.articles.where(internal: false).includes(:sender).reorder(:created_at).flat_map do |article|
      _body, attachments = Ticket::Article.insert_urls(article)

      attachments.map do |file|
        {
          id:           file.id,
          article_id:   article.id,
          filename:     file.filename,
          size:         file.size.to_i,
          content_type: file.preferences['Content-Type'] || file.preferences['Mime-Type'],
          from_team:    article.sender&.name == 'Agent',
          created_at:   article.created_at,
          url:          "/api/v1/ticket_attachment/#{ticket.id}/#{article.id}/#{file.id}?disposition=attachment",
        }
      end
    end
  end

  def actions(stage)
    closed     = stage == 'closed'
    can_reopen = (closed || stage == 'resolved') && ticket.state.state_type.name != 'merged' && allowed?(:follow_up?)

    {
      can_close:  !closed && allowed?(:update?),
      can_reopen: can_reopen,
      # The team doesn't take replies on this closed ticket: the student raises a new one.
      new_ticket: closed && !can_reopen && ticket.state.state_type.name != 'merged',
    }
  end

  # For customers Zammad's ticket rules answer with the fields they may not change, not true.
  def allowed?(query)
    [false, nil].exclude?(policy.public_send(query))
  end

  # The last request Feedback Collection sent for this ticket; the emailed link stops working
  # once it is answered here.
  def feedback
    request = Service::StudenthubCustomerTicket::Rate.latest_request(ticket)
    return if !request

    if request.submitted?
      { state: 'submitted', rating: request.rating, comments: request.comments, rated_at: request.rated_at }
    elsif Service::StudenthubCustomerTicket::Rate.answerable?(request, ticket, current_user)
      { state: 'awaiting' }
    end
  end
end
