# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Transaction::StudenthubStudentNotification, aggregate_failures: true, performs_jobs: true do
  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:student) { create(:customer) }
  let(:ticket)  { create(:ticket, group:, owner: agent, customer: student, state_name: 'new') }

  before do
    ticket
    run_transactions
  end

  def run_transactions
    TransactionDispatcher.commit
    perform_enqueued_jobs(only: TransactionJob)
  end

  def change_state(state_name, user: agent)
    state = Ticket::State.find_by(name: state_name) || create(:ticket_state, name: state_name, state_type: Ticket::StateType.find_by(name: 'open'))
    ticket.update!(state:, updated_by: user)
    run_transactions
  end

  def write(sender_name, user: agent, internal: false)
    create(:ticket_article, ticket:, sender_name:, internal:, created_by: user, updated_by: user)
    run_transactions
  end

  def student_notifications
    OnlineNotification.where(user: student).reorder(:id).map { |notification| [notification.type.name, notification.seen, notification.created_by_id] }
  end

  it 'is registered as an async transaction backend' do
    expect(Setting.where(area: 'Transaction::Backend::Async').map { |setting| Setting.get(setting.name) }).to include(described_class.name)
  end

  it 'tells the student when staff reply' do
    write('Agent')

    expect(student_notifications).to eq([['studenthub_reply', false, agent.id]])
  end

  it 'tells nothing of escalations and reminders, which come with the last reply' do
    write('Agent')
    article = ticket.articles.last

    %w[escalation escalation_warning reminder_reached].each do |type|
      described_class.new({ object: 'Ticket', type:, object_id: ticket.id, article_id: article.id, user_id: 1 }).perform
    end

    expect(student_notifications.map(&:first)).to eq(%w[studenthub_reply])
  end

  it 'tells nothing of internal notes, the system’s emails or what the student wrote' do
    write('Agent', internal: true)
    write('System')
    write('Customer', user: student)

    expect(student_notifications).to be_empty
  end

  it 'tells the student where the ticket stands as it moves on' do
    change_state('open')
    change_state('4. Awaiting user Response')
    change_state('5. Resolved')
    change_state('closed')

    expect(student_notifications.map(&:first)).to eq(%w[studenthub_progress studenthub_waiting studenthub_resolved studenthub_closed])
  end

  it 'tells nothing when the ticket stays at the same stage' do
    change_state('open')
    change_state('3. In Progress')

    expect(student_notifications.map(&:first)).to eq(%w[studenthub_progress])
  end

  it 'tells of the reply, not the state that came with it' do
    create(:ticket_article, ticket:, sender_name: 'Agent', created_by: agent, updated_by: agent)
    ticket.update!(state: Ticket::State.find_by(name: 'closed'), updated_by: agent)
    run_transactions

    expect(student_notifications.map(&:first)).to eq(%w[studenthub_reply])
  end

  it 'tells nothing of what the student did, nor of merging' do
    change_state('closed', user: student)
    ticket.merge_to(ticket_id: create(:ticket, group:, customer: student).id, user_id: agent.id)
    run_transactions

    expect(student_notifications).to be_empty
  end

  it 'tells nothing to staff who raised the ticket, nor to inactive students' do
    ticket.update!(customer: create(:agent, groups: [group]))
    write('Agent')
    ticket.update!(customer: create(:customer, active: false))
    write('Agent')

    expect(OnlineNotification.where(type: TypeLookup.where(name: described_class::TYPES))).to be_empty
  end

  it 'keeps "closed" unread when closing marks the ticket’s other notifications read' do
    staff_notification = OnlineNotification.add(type: 'update', object: 'Ticket', o_id: ticket.id, seen: false, user_id: agent.id, created_by_id: 1)

    change_state('closed')
    TicketOnlineNotificationSeenJob.perform_now(ticket, agent.id)

    expect(student_notifications).to eq([['studenthub_closed', false, agent.id]])
    expect(staff_notification.reload.seen).to be(true)
  end
end
