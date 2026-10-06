# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::SlaPreview, aggregate_failures: true do
  let(:high)   { Ticket::Priority.find_by(name: '3 high') }
  let(:low)    { Ticket::Priority.find_by(name: '1 low') }
  let(:closed) { Ticket::State.find_by(name: 'closed') }

  before do
    Sla.destroy_all
    create(:sla, name: 'SLA: High', solution_time: 180, condition: {
             'ticket.priority_id' => { operator: 'is', value: [high.id.to_s] },
             'ticket.state_id'    => { operator: 'is not', value: [closed.id.to_s] },
           })
  end

  it 'finds the SLA whose simple conditions match the form values' do
    result = described_class.for('priority_id' => high.id, 'state_id' => Ticket::State.find_by(name: 'new').id)

    expect(result).to include(status: 'match')
    expect(result[:sla].name).to eq('SLA: High')
  end

  it 'finds none when nothing matches' do
    expect(described_class.for('priority_id' => low.id, 'state_id' => 1)).to eq(status: 'none', sla: nil)
  end

  it 'is unknown when a condition needs a field the form does not send' do
    expect(described_class.for('priority_id' => high.id)).to eq(status: 'unknown', sla: nil)
  end

  it 'uses an SLA without conditions as the fallback' do
    create(:sla, name: 'SLA: Everything else', condition: {})

    expect(described_class.for('priority_id' => low.id, 'state_id' => 1)[:sla].name).to eq('SLA: Everything else')
  end
end
