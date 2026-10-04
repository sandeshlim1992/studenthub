# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketApproval, aggregate_failures: true do
  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:manager) { create_manager(groups: [group]) }
  let(:ticket)  { create(:ticket, group:, state_name: 'open') }

  describe 'managers' do
    it 'are the active users with the Managers role' do
      inactive = create_manager(active: false)

      expect(described_class.managers).to include(manager)
      expect(described_class.managers).not_to include(agent, inactive)
      expect(described_class.manager?(manager)).to be(true)
      expect(described_class.manager?(agent)).to be(false)
    end
  end

  describe 'ticket guard' do
    it 'ignores approval changes made outside the approval workflow' do
      ticket.update!(approval_state: 'approved', approval_approver_id: agent.id, title: 'New title')

      expect(ticket.reload).to have_attributes(approval_state: nil, approval_approver_id: nil, title: 'New title')
    end

    it 'ignores approval values sent when a ticket is created' do
      created = create(:ticket, group:, approval_state: 'approved')

      expect(created.reload.approval_state).to be_nil
    end

    it 'allows changes inside the workflow' do
      described_class.writing { ticket.update!(approval_state: 'pending') }

      expect(ticket.reload.approval_state).to eq('pending')
    end
  end

  describe 'overviews' do
    before do
      Setting.set('ticket_approval', true)
      allow(NotificationFactory::Mailer).to receive(:notification)
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
    end

    def overview_tickets(link, user)
      _count, tickets = Ticket.selectors(Overview.find_by(link:).condition, limit: 50, current_user: user, access: 'read')
      tickets.to_a
    end

    it 'shows a waiting ticket to its manager only' do
      expect(overview_tickets('awaiting_my_approval', manager)).to eq([ticket])
      expect(overview_tickets('awaiting_my_approval', create_manager(groups: [group]))).to be_empty
    end

    it 'shows the decision to the agent who asked until the ticket is closed' do
      Service::TicketApproval::Decide.with_current_user(manager).execute(ticket: ticket.reload, decision: 'approved')

      expect(overview_tickets('approval_decisions', agent)).to eq([ticket])
      expect(overview_tickets('awaiting_my_approval', manager)).to be_empty

      ticket.reload.update!(state: Ticket::State.find_by(name: 'closed'))
      expect(overview_tickets('approval_decisions', agent)).to be_empty
    end

    it 'gives "Awaiting my approval" to the Managers role' do
      expect(Overview.find_by(link: 'awaiting_my_approval').role_ids).to eq([Role.find_by(name: 'Managers').id])
    end
  end

  describe 'setup' do
    it 'gives the Managers role the approver permission' do
      expect(Role.find_by(name: 'Managers').permissions.pluck(:name)).to include('ticket.approver', 'ticket.agent')
    end

    it 'hides the overviews while the feature is off and shows them when on' do
      Studenthub::TicketApproval::Setup.sync_overviews(false)
      expect(Overview.where(link: %w[awaiting_my_approval approval_decisions]).pluck(:active)).to eq([false, false])

      Studenthub::TicketApproval::Setup.sync_overviews(true)
      expect(Overview.where(link: %w[awaiting_my_approval approval_decisions]).pluck(:active)).to eq([true, true])
    end
  end
end
