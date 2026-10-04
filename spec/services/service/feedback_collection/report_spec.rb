# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::Report, aggregate_failures: true do
  before do
    create(:feedback_request, :submitted, rating: 5, owner_name: 'Borice', group_name: 'Service Desk', rated_at: Time.zone.parse('2026-03-10 10:00'))
    create(:feedback_request, :submitted, rating: 3, owner_name: 'Borice', group_name: 'VLE', rated_at: Time.zone.parse('2026-04-02 10:00'))
    create(:feedback_request, :submitted, rating: 4, owner_name: 'Michael', group_name: 'VLE', rated_at: Time.zone.parse('2026-04-20 10:00'))
    create(:feedback_request, state: 'sent')
  end

  it 'summarises all submitted ratings' do
    report = described_class.new.execute

    expect(report).to include(
      responses:    3,
      average:      4.0,
      distribution: { 1 => 0, 2 => 0, 3 => 1, 4 => 1, 5 => 1 },
    )
    expect(report[:by_agent]).to eq([{ name: 'Borice', count: 2, average: 4.0 }, { name: 'Michael', count: 1, average: 4.0 }])
    expect(report[:by_month]).to eq([{ month: '2026-03', count: 1, average: 5.0 }, { month: '2026-04', count: 2, average: 3.5 }])
  end

  it 'limits to a date range' do
    report = described_class.new(from: '2026-04-01', to: '2026-04-30').execute

    expect(report).to include(responses: 2, average: 3.5)
    expect(report[:by_group]).to eq([{ name: 'VLE', count: 2, average: 3.5 }])
  end

  it 'ignores invalid dates' do
    expect(described_class.new(from: 'yesterday').execute[:responses]).to eq(3)
  end
end
