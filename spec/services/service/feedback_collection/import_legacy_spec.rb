# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::ImportLegacy, aggregate_failures: true do
  subject(:result) { described_class.new(json:).execute }

  let(:ticket) { create(:ticket) }
  let(:json) do
    {
      'b787eb276b9c07f78a4a' => {
        'ticket' => ticket.number, 'title' => 'Outlook issue', 'email' => 'x@example.com', 'owner' => 'Michael',
        'customer_name' => 'Suraiya', 'used' => true, 'rating' => '5', 'comments' => 'Great &amp; quick help',
        'rated_at' => '2026-03-18 12:29'
      },
      'c0ffee0000000000aaaa' => {
        'ticket' => '999999', 'title' => 'Wi-Fi', 'email' => 'y@example.com', 'owner' => 'Borice',
        'customer_name' => 'Jane', 'used' => true, 'rating' => '3', 'comments' => 'No comments.', 'rated_at' => '2026-04-01 09:05'
      },
      'deadbeef000000000000' => {
        'ticket' => '999998', 'title' => 'Printer', 'email' => 'z@example.com', 'owner' => 'Borice',
        'customer_name' => 'Kwame', 'used' => false
      },
    }.to_json
  end

  before { Setting.set('timezone_default', 'Europe/London') }

  it 'imports every record and reports the counts' do
    expect(result).to include(imported: 3, submitted: 2, unused: 1, matched_tickets: 1, skipped_existing: 0, errors: [])
  end

  it 'links matching tickets and keeps the raw values' do
    result
    row = FeedbackRequest.lookup_by_token('b787eb276b9c07f78a4a')

    expect(row).to have_attributes(
      ticket_id: ticket.id, ticket_number: ticket.number, owner_name: 'Michael', customer_name: 'Suraiya',
      state: 'submitted', source: 'import', rating: 5, comments: 'Great & quick help'
    )
    expect(row.rated_at).to eq(Time.find_zone('Europe/London').local(2026, 3, 18, 12, 29))
  end

  it 'keeps records whose ticket does not exist and drops the default comment' do
    result

    expect(FeedbackRequest.lookup_by_token('c0ffee0000000000aaaa')).to have_attributes(ticket_id: nil, ticket_number: '999999', rating: 3, comments: nil)
  end

  it 'imports unused links as open requests so old emails keep working' do
    result

    expect(FeedbackRequest.lookup_by_token('deadbeef000000000000')).to have_attributes(state: 'sent', rating: nil)
  end

  it 'skips records already imported' do
    described_class.new(json:).execute

    expect(described_class.new(json:).execute).to include(imported: 0, skipped_existing: 3)
  end

  context 'with a JSON list instead of an object' do
    let(:json) { '[]' }

    it 'refuses the file' do
      expect { result }.to raise_error(ArgumentError)
    end
  end
end
