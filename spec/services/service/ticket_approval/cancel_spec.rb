# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::TicketApproval::Cancel, aggregate_failures: true do
  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:manager) { create_manager(groups: [group]) }
  let(:ticket)  { create(:ticket, group:, state_name: 'open') }

  before do
    Setting.set('ticket_approval', true)
    allow(NotificationFactory::Mailer).to receive(:notification)
    Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
  end

  it 'withdraws the request and clears the ticket fields' do
    approval = described_class.with_current_user(agent).execute(ticket: ticket.reload)

    expect(ticket.reload).to have_attributes(approval_state: nil, approval_approver_id: nil, approval_requested_by_id: nil)
    expect(approval.state).to eq('cancelled')
    expect(OnlineNotification.where(user_id: manager.id, o_id: ticket.id).count).to eq(2)
  end

  it 'lets the agent who asked withdraw it while they can only read the ticket, and sends it back' do
    expect(TicketPolicy.new(agent, ticket.reload).update?).to be(false)

    described_class.with_current_user(agent).execute(ticket: ticket.reload)

    expect(ticket.reload.group_id).to eq(group.id)
    # A withdrawn round gives the manager no access any more.
    expect(Studenthub::TicketApproval::TicketAccess.granted?(manager, ticket)).to be(false)
  end

  it 'withdraws everything when an admin turns Ticket Approvals off' do
    admin = create(:admin)
    Setting.set('ticket_approval', false)

    approval = described_class.with_current_user(admin).execute(ticket: ticket.reload, turned_off: true)

    expect(approval.state).to eq('cancelled')
    expect(ticket.reload).to have_attributes(group_id: group.id, approval_state: nil)
    expect(ticket.articles.last.body).to include('turned Ticket Approvals off')
  end

  it 'refuses agents without change access' do
    expect { described_class.with_current_user(create(:agent)).execute(ticket: ticket.reload) }
      .to raise_error(Service::TicketApproval::Base::Error, %r{permission})
  end
end
