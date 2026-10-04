# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Service::FeedbackCollection::RenderEmail, aggregate_failures: true do
  let(:values) { { 'ticket_number' => '886835', 'customer_name' => 'Jane & <Co>', 'link_5' => 'https://x.example/feedback/abc?rating=5&a=b' } }

  it 'fills in placeholders, escaping values in the body only' do
    result = described_class.new(
      values:           values,
      subject_template: 'Ticket #{{ticket_number}} for {{ customer_name }}',
      body_template:    '<p>Hi {{customer_name}}</p><a href="{{link_5}}">5</a>',
    ).execute

    expect(result[:subject]).to eq('Ticket #886835 for Jane & <Co>')
    expect(result[:body]).to eq('<p>Hi Jane &amp; &lt;Co&gt;</p><a href="https://x.example/feedback/abc?rating=5&amp;a=b">5</a>')
  end

  it 'leaves unknown placeholders as they are' do
    result = described_class.new(values:, subject_template: 's', body_template: '{{unknown}}').execute

    expect(result[:body]).to eq('{{unknown}}')
  end

  it 'uses the built-in template while none is saved' do
    Setting.set('feedback_collection_email_template', '')

    expect(described_class.body_template).to include('{{link_1}}').and(include('{{link_5}}'))
  end

  it 'builds links from http_type and fqdn' do
    Setting.set('http_type', 'https')
    Setting.set('fqdn', 'ticket.example.com')

    expect(described_class.feedback_url('abc', 3)).to eq('https://ticket.example.com/feedback/abc?rating=3')
  end
end
