# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: tells students in the app when staff reply on their ticket or it moves on (in
# progress, waiting for them, resolved, closed), as Zammad's own notifications go to staff only.
# One notification per change, the reply rather than the state it came with. Registered as an
# async transaction backend by Studenthub::MobileApp.ensure!.
class Transaction::StudenthubStudentNotification
  REPLY = 'studenthub_reply'.freeze

  # Overview.stage's stages as the mobile app shows them (studenthubTicketStage.ts); a ticket
  # coming in is no news to the student.
  STAGES = {
    'with_team'       => 'studenthub_progress',
    'in_progress'     => 'studenthub_progress',
    'on_hold'         => 'studenthub_progress',
    'review'          => 'studenthub_progress',
    'waiting_for_you' => 'studenthub_waiting',
    'resolved'        => 'studenthub_resolved',
    'closed'          => 'studenthub_closed',
  }.freeze

  TYPES = [REPLY, *STAGES.values.uniq].freeze

  def initialize(item, params = {})
    @item   = item
    @params = params
  end

  def perform
    return if Setting.get('import_mode') || @params[:disable_notification]
    # Escalations and reminders come with the ticket's last article, which is no news.
    return if @item[:object] != 'Ticket' || %w[create update].exclude?(@item[:type])
    return if !ticket || ticket.state.state_type.name == 'merged'

    student = ticket.customer
    return if !student?(student) || student.id == @item[:user_id]

    type = staff_reply? ? REPLY : stage_type
    return if !type

    OnlineNotification.add(type:, object: 'Ticket', o_id: ticket.id, seen: false, user_id: student.id, created_by_id: @item[:user_id] || 1)
  end

  private

  def ticket
    @ticket ||= Ticket.find_by(id: @item[:object_id])
  end

  # Staff hear from Zammad's own notifications, also on tickets they raised themselves.
  def student?(user)
    user&.active? && user.permissions?('ticket.customer') && !user.permissions?('ticket.agent')
  end

  # What staff wrote to the student; internal notes and the system's automatic emails don't count.
  def staff_reply?
    article = Ticket::Article.find_by(id: @item[:article_id])
    return false if !article || article.internal?

    article.sender&.name == 'Agent'
  end

  def stage_type
    from, to = @item.dig(:changes, 'state_id')
    return if !from || !to

    type = STAGES[stage(to)]
    type if type != STAGES[stage(from)]
  end

  # Overview.stage reads the state from a ticket, so it gets the ticket in that state.
  def stage(state_id)
    Service::StudenthubCustomerTicket::Overview.stage(ticket.dup.tap { it.state_id = state_id })
  end
end
