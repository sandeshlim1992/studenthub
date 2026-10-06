# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::TicketApproval::SlaPause, aggregate_failures: true do
  let(:group)     { create(:group) }
  let(:agent)     { create(:agent, groups: [group]) }
  let(:manager)   { create_manager }
  let(:calendar)  { create(:calendar, :'24/7') }
  let(:ticket)    { create(:ticket, group:, owner: agent, state_name: 'open') }
  let(:pause_sla) { true }

  before do
    Setting.set('ticket_approval', true)
    # Before freeze_time: settings are cached by their last change.
    Setting.set('ticket_approval_pause_sla', pause_sla)
    allow(NotificationFactory::Mailer).to receive(:notification)
    create(:sla, :condition_blank, solution_time: 240, calendar:)
    freeze_time
    ticket
  end

  def request_approval
    Service::TicketApproval::Request.with_current_user(agent).execute(ticket: ticket.reload, approver: manager, reason: 'Please approve')
  end

  def approve
    Service::TicketApproval::Decide.with_current_user(manager).execute(ticket: ticket.reload, decision: 'approved', comment: 'OK')
  end

  it 'stops the SLA while the ticket waits and leaves the waiting time out afterwards' do
    deadline = ticket.reload.close_escalation_at
    expect(deadline).to be_within(1.minute).of(4.hours.from_now)

    travel 1.hour
    request_approval
    expect(ticket.reload).to have_attributes(close_escalation_at: nil, escalation_at: nil)

    travel 2.hours
    approve

    # The two hours with the manager don't count.
    expect(ticket.reload.close_escalation_at).to be_within(1.minute).of(deadline + 2.hours)
  end

  context 'when the pause is off' do
    let(:pause_sla) { false }

    it 'keeps the SLA running' do
      deadline = ticket.reload.close_escalation_at

      travel 1.hour
      request_approval
      expect(ticket.reload.close_escalation_at).to be_within(1.minute).of(deadline)

      travel 2.hours
      approve
      expect(ticket.reload.close_escalation_at).to be_within(1.minute).of(deadline)
    end
  end

  it "doesn't move past deadlines when the setting changes later" do
    deadline = ticket.reload.close_escalation_at
    travel 1.hour
    request_approval
    travel 2.hours
    approve

    Setting.set('ticket_approval_pause_sla', false)
    ticket.reload.escalation_calculation(true)

    expect(ticket.reload.close_escalation_at).to be_within(1.minute).of(deadline + 2.hours)
  end
end
