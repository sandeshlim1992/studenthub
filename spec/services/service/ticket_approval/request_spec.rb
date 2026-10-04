# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::TicketApproval::Request, aggregate_failures: true do
  subject(:request_approval) { described_class.with_current_user(agent).execute(ticket:, approver: manager, reason:) }

  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, firstname: 'Aidan', groups: [group]) }
  let(:manager) { create_manager(firstname: 'Waliul', groups: [group]) }
  let(:ticket)  { create(:ticket, group:, owner: agent, state_name: 'open') }
  let(:reason)  { "Needs a new laptop\nBudget code 42" }

  before do
    Setting.set('ticket_approval', true)
    allow(NotificationFactory::Mailer).to receive(:notification)
  end

  it 'marks the ticket as waiting for the chosen manager and records the round' do
    approval = request_approval

    expect(ticket.reload).to have_attributes(approval_state: 'pending', approval_approver_id: manager.id, approval_requested_by_id: agent.id)
    expect(approval).to have_attributes(state: 'pending', reason: reason, approver_id: manager.id, requested_by_id: agent.id)
    expect(ticket.state.name).to eq('open')
  end

  it 'adds an internal note with the reason' do
    request_approval

    note = ticket.articles.last
    expect(note).to have_attributes(internal: true, subject: 'Approval requested')
    expect(note.body).to include('Approval requested from', 'Waliul', 'Budget code 42')
  end

  it 'tells the manager in the bell and by email' do
    request_approval

    expect(OnlineNotification.where(user_id: manager.id, o_id: ticket.id)).to exist
    expect(NotificationFactory::Mailer).to have_received(:notification).with(hash_including(template: 'ticket_approval_requested', user: manager))
  end

  context 'when the feature is off' do
    before { Setting.set('ticket_approval', false) }

    it 'refuses' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{turned off})
    end
  end

  context 'when the chosen user is not a manager' do
    let(:manager) { create(:agent, groups: [group]) }

    it 'refuses' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{not a manager})
    end
  end

  context 'when the manager cannot open the ticket' do
    let(:manager) { create_manager(groups: []) }

    it 'refuses and explains how to fix it' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{Give the Managers role read access})
    end
  end

  context 'when the agent cannot change the ticket' do
    let(:agent) { create(:agent) }

    it 'refuses' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{permission to change})
    end
  end

  context 'without a reason' do
    let(:reason) { '  ' }

    it 'refuses' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{reason})
    end
  end

  context 'when the ticket is already waiting' do
    before { described_class.with_current_user(agent).execute(ticket:, approver: manager, reason: 'First') }

    it 'refuses a second request' do
      expect { request_approval }.to raise_error(Service::TicketApproval::Base::Error, %r{already waiting})
    end
  end
end
