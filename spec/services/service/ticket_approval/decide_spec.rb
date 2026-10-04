# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::TicketApproval::Decide, aggregate_failures: true do
  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:owner)   { create(:agent, groups: [group]) }
  let(:manager) { create_manager(groups: [group]) }
  let(:ticket)  { create(:ticket, group:, owner:, state_name: 'open') }

  before do
    Setting.set('ticket_approval', true)
    allow(NotificationFactory::Mailer).to receive(:notification)
    Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
  end

  def decide(user: manager, decision: 'approved', comment: 'Go ahead')
    described_class.with_current_user(user).execute(ticket: ticket.reload, decision:, comment:)
  end

  it 'approves, keeps the ticket state and records who decided' do
    approval = decide

    expect(ticket.reload).to have_attributes(approval_state: 'approved', approval_requested_by_id: agent.id)
    expect(ticket.state.name).to eq('open')
    expect(approval).to have_attributes(state: 'approved', comment: 'Go ahead', decided_by_id: manager.id, decided_at: be_present)
    expect(ticket.articles.last.body).to include('Approved by', 'Go ahead')
  end

  it 'denies with a comment' do
    decide(decision: 'denied', comment: 'No budget left')

    expect(ticket.reload.approval_state).to eq('denied')
    expect(ticket.articles.last).to have_attributes(internal: true, subject: 'Denied')
  end

  it 'needs a comment to deny' do
    expect { decide(decision: 'denied', comment: '') }.to raise_error(Service::TicketApproval::Base::Error, %r{why})
    expect(ticket.reload.approval_state).to eq('pending')
  end

  it 'tells the agent who asked and the owner' do
    decide

    expect(NotificationFactory::Mailer).to have_received(:notification).with(hash_including(template: 'ticket_approval_decided', user: agent))
    expect(NotificationFactory::Mailer).to have_received(:notification).with(hash_including(template: 'ticket_approval_decided', user: owner))
    expect(OnlineNotification.where(user_id: agent.id, o_id: ticket.id)).to exist
  end

  it 'lets only the chosen manager decide' do
    other_manager = create_manager(groups: [group])

    expect { decide(user: other_manager) }.to raise_error(Service::TicketApproval::Base::Error, %r{Only the manager})
    expect { decide(user: agent) }.to raise_error(Service::TicketApproval::Base::Error, %r{Only the manager})
  end

  it 'lets an admin decide' do
    decide(user: create(:admin))

    expect(ticket.reload.approval_state).to eq('approved')
  end

  it 'decides only once' do
    decide

    expect { decide(decision: 'denied', comment: 'Changed my mind') }.to raise_error(Service::TicketApproval::Base::Error, %r{not waiting})
  end

  it 'allows a new request after a denial' do
    decide(decision: 'denied', comment: 'Not like this')
    Service::TicketApproval::Request.with_current_user(agent).execute(ticket: ticket.reload, approver: manager, reason: 'Updated plan')

    expect(ticket.reload.approval_state).to eq('pending')
    expect(TicketApproval.where(ticket_id: ticket.id).pluck(:state)).to eq(%w[denied pending])
  end
end
