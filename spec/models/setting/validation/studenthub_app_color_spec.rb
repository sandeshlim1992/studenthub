# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubAppColor, aggregate_failures: true do
  let(:setting_name) { 'studenthub_app_color' }

  it 'starts as the Student Hub navy' do
    expect(Setting.get(setting_name)).to eq('#14234b')
  end

  it 'accepts dark colours that keep white text readable' do
    %w[#14234b #296374 #7e0707 #4B2A7A #2b313b].each do |colour|
      expect { Setting.set(setting_name, colour) }.not_to raise_error
      expect(Setting.get(setting_name)).to eq(colour)
    end
  end

  it 'refuses values that are not #rrggbb colours' do
    ['14234b', '#123', 'navy', '#14234g', ''].each do |value|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, %r{#rrggbb})
    end
  end

  it 'refuses colours too light for white text' do
    expect { Setting.set(setting_name, '#ffca08') }.to raise_error(ActiveRecord::RecordInvalid, %r{too light})
    expect(Setting.get(setting_name)).to eq('#14234b')
  end

  it 'computes WCAG contrast with white' do
    expect(described_class.contrast_with_white('#000000')).to be_within(0.01).of(21.0)
    expect(described_class.contrast_with_white('#ffffff')).to be_within(0.01).of(1.0)
    expect(described_class.contrast_with_white('#14234b')).to be > 13
  end
end
