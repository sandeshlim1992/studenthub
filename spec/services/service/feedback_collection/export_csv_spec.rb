# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::ExportCsv, aggregate_failures: true do
  it 'exports submitted feedback with the old column layout, newest first' do
    create(:feedback_request, :submitted, ticket_number: '1001', rated_at: 2.days.ago)
    create(:feedback_request, :submitted, ticket_number: '1002', rated_at: 1.day.ago, comments: 'Thanks, "great"')
    create(:feedback_request, ticket_number: '1003')

    rows = CSV.parse(described_class.new.execute)

    expect(rows.first).to eq(['Date', 'Ticket Number', 'Agent', 'Customer Name', 'Customer Email', 'Rating', 'Comments'])
    expect(rows.drop(1).pluck(1)).to eq(%w[1002 1001])
    expect(rows[1].last).to eq('Thanks, "great"')
  end

  it 'stops comments from running as spreadsheet formulas' do
    create(:feedback_request, :submitted, comments: '=HYPERLINK("http://evil")')

    expect(CSV.parse(described_class.new.execute).last.last).to eq(%q('=HYPERLINK("http://evil")))
  end

  it 'names the file with the date' do
    travel_to Time.zone.parse('2026-10-03 10:00')

    expect(described_class.filename).to eq('StudentHub_Feedback_2026-10-03.csv')
  end
end
