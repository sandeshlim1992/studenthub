# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::TicketApproval::Dashboard, aggregate_failures: true do
  let(:group)    { create(:group, name: 'Service Desk') }
  let(:agent)    { create(:agent, groups: [group], firstname: 'Tom', lastname: 'Barker') }
  let(:manager)  { create_manager(groups: [group]) }
  let(:customer) { create(:customer, firstname: 'Helen', lastname: 'Ward') }

  before do
    Setting.set('ticket_approval', true)
    allow(NotificationFactory::Mailer).to receive(:notification)
  end

  def send_for_approval(title, reason: 'Please approve')
    ticket = create(:ticket, group:, customer:, title:, state_name: 'open')
    Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason:)
    ticket
  end

  def decide(ticket, decision: 'approved', comment: 'Fine', waited: 2.hours, days_ago: 1)
    Service::TicketApproval::Decide.with_current_user(manager).execute(ticket: ticket.reload, decision:, comment:)
    decided_at = days_ago.days.ago
    TicketApproval.where(ticket_id: ticket.id).update_all(created_at: decided_at - waited, decided_at:)
  end

  def dashboard
    described_class.with_current_user(manager).execute
  end

  it 'lists the waiting requests, oldest first, with what the manager needs to decide' do
    newer = send_for_approval('CCTV footage', reason: 'Security asked')
    older = send_for_approval('Laptop for new starter', reason: 'New starter on Monday')
    TicketApproval.find_by(ticket_id: older.id).update!(created_at: 26.hours.ago)
    create(:ticket_article, :inbound_phone, ticket: older, internal: false, created_by_id: customer.id,
                                           content_type: 'text/html', body: '<p>Could IT get a <b>laptop</b> ready?</p>')
    create(:ticket_article, :outbound_note, ticket: older, internal: true, body: 'Internal note')

    waiting = dashboard[:waiting]

    expect(waiting).to include(count: 2, overdue: true)
    expect(waiting[:requests].pluck(:ticket_id)).to eq([older.id, newer.id])
    expect(waiting[:requests].first).to include(
      number:       older.number,
      reason:       'New starter on Monday',
      requested_by: 'Tom Barker',
      team:         'Service Desk',
      customer:     'Helen Ward',
      sla_paused:   true,
    )
    expect(waiting[:requests].first[:latest_message]).to include(from: 'Helen Ward', body: 'Could IT get a laptop ready?')
  end

  it 'sums up the last 30 days for the month in review' do
    decide(send_for_approval('One'), waited: 1.hour)
    decide(send_for_approval('Two'), waited: 3.hours)
    decide(send_for_approval('Three'), decision: 'denied', comment: 'No', waited: 30.hours)
    decide(send_for_approval('Older'), waited: 5.hours, days_ago: 40)

    result = dashboard

    expect(result[:waiting]).to include(count: 0, requests: [])
    expect(result[:decisions]).to include(approved: 2, denied: 1, approval_rate: 67)
    expect(result[:month]).to include(
      decided:              3,
      median_wait_seconds:  3.hours.to_i,
      longest_wait_seconds: 30.hours.to_i,
      over_warning:         1,
      previous:             { decided: 1, median_wait_seconds: 5.hours.to_i },
    )
    expect(result[:month][:by_team]).to eq([{ name: 'Service Desk', decided: 3, approved: 2 }])

    weeks = result[:month][:per_week]
    expect(weeks.size).to eq(described_class::WEEKS)
    expect(weeks.first[:week_start]).to eq(Time.zone.today.beginning_of_week - 4.weeks)
    expect(weeks.sum { |week| week[:approved] + week[:denied] }).to eq(3)
  end

  it 'counts nothing for a manager without decisions' do
    expect(dashboard[:month]).to include(decided: 0, median_wait_seconds: nil, longest_wait_seconds: nil, by_team: [])
  end
end
