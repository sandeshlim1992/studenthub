# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubEscalationWarningMinutes, aggregate_failures: true do
  let(:setting_name) { 'studenthub_escalation_warning_minutes' }

  it 'starts at one hour' do
    expect(Setting.get(setting_name)).to eq(60)
  end

  it 'accepts whole minutes up to 48 hours' do
    [1, 15, 60, 480, 2880].each do |minutes|
      expect { Setting.set(setting_name, minutes) }.not_to raise_error
      expect(Setting.get(setting_name)).to eq(minutes)
    end
  end

  it 'refuses anything else' do
    [0, -5, 2881, 1.5, '60'].each do |value|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, %r{between 1 and 2880})
    end
    expect(Setting.get(setting_name)).to eq(60)
  end
end
