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

  describe 'managers without another staff role' do
    it 'are told apart from managers who are also agents or admins' do
      manager_only = create_manager
      manager_only.roles << Role.find_by(name: 'Customer')
      also_agent = create_manager
      also_agent.roles << Role.find_by(name: 'Agent')
      also_admin = create_manager
      also_admin.roles << Role.find_by(name: 'Admin')

      expect(described_class.manager_only?(manager_only)).to be(true)
      expect(described_class.manager_only?(also_agent)).to be(false)
      expect(described_class.manager_only?(also_admin)).to be(false)
      expect(described_class.manager_only?(create(:agent))).to be(false)
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

    it 'shows the agent who asked their request until the manager decides' do
      expect(overview_tickets('sent_for_approval', agent)).to eq([ticket])

      Service::TicketApproval::Decide.with_current_user(manager).execute(ticket: ticket.reload, decision: 'approved')

      expect(overview_tickets('sent_for_approval', agent)).to be_empty
      expect(overview_tickets('awaiting_my_approval', manager)).to be_empty
    end

    it 'gives "Awaiting my approval" to the Managers role' do
      expect(Overview.find_by(link: 'awaiting_my_approval').role_ids).to eq([Role.find_by(name: 'Managers').id])
    end

    it 'gives "Sent for approval" to the agent roles but not to Managers' do
      role_ids = Overview.find_by(link: 'sent_for_approval').role_ids

      expect(role_ids).to include(Role.find_by(name: 'Agent').id)
      expect(role_ids).not_to include(Role.find_by(name: 'Managers').id)
    end

    # Zammad lists a view's tickets only from groups with "overview" access ("read" only opens
    # them), so the Managers role needs both (README → Ticket Approvals → Going live).
    it 'lists the waiting ticket in the manager view when the Managers role has overview access' do
      Studenthub::TicketApproval::Setup.sync_overviews(true)
      role = Role.find_by(name: 'Managers')
      role.group_names_access_map = { group.name => %w[read overview] }
      role.save!
      role_manager = create_manager
      Service::TicketApproval::Request.with_current_user(agent)
        .execute(ticket: create(:ticket, group:, state_name: 'open'), approver: role_manager, reason: 'Please')

      expect(Ticket::Overviews.index(role_manager.reload, ['awaiting_my_approval']).first[:count]).to eq(1)
    end
  end

  describe 'setup' do
    it 'gives the Managers role the approver permission' do
      expect(Role.find_by(name: 'Managers').permissions.pluck(:name)).to include('ticket.approver', 'ticket.agent')
    end

    it 'hides the overviews while the feature is off and shows them when on' do
      Studenthub::TicketApproval::Setup.sync_overviews(false)
      expect(Overview.where(link: %w[awaiting_my_approval sent_for_approval]).pluck(:active)).to eq([false, false])

      Studenthub::TicketApproval::Setup.sync_overviews(true)
      expect(Overview.where(link: %w[awaiting_my_approval sent_for_approval]).pluck(:active)).to eq([true, true])
    end

    it 'turns the old "Approval decisions" view into "Sent for approval", keeping it' do
      overview = Overview.find_by(link: 'sent_for_approval')
      overview.update!(name: 'Approval decisions', link: 'approval_decisions')

      Studenthub::TicketApproval::Setup.create_overviews

      expect(overview.reload).to have_attributes(name: 'Sent for approval', link: 'sent_for_approval')
      expect(overview.condition['ticket.approval_state']['value']).to eq(%w[pending])
      expect(Overview.where(link: %w[approval_decisions sent_for_approval]).count).to eq(1)
    end
  end
end
