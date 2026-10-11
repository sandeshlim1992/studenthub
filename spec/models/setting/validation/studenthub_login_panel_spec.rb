# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubLoginPanel, aggregate_failures: true do
  let(:setting_name) { 'studenthub_login_panel' }
  let(:defaults)     { Studenthub::Theme::LoginPanelSetup::DEFAULTS }

  it 'starts with the Student Hub texts' do
    expect(Setting.get(setting_name)).to eq(defaults)
  end

  it 'accepts new texts and empty ones' do
    texts = { 'heading' => 'IT Service Desk', 'tagline' => '', 'description' => 'x' * 300 }

    expect { Setting.set(setting_name, texts) }.not_to raise_error
    expect(Setting.get(setting_name)).to eq(texts)
  end

  it 'refuses texts that are too long, not text or unknown' do
    {
      defaults.merge('heading' => 'x' * 61)      => %r{heading can be at most 60 characters},
      defaults.merge('tagline' => 'x' * 121)     => %r{tagline can be at most 120 characters},
      defaults.merge('description' => 'x' * 301) => %r{description can be at most 300 characters},
      defaults.merge('heading' => 5)             => %r{heading must be text},
      defaults.merge('footer' => 'Hello')        => %r{"footer" is not a sign-in page text},
      'Student Hub'                              => %r{must be a heading, a tagline and a description},
    }.each do |value, message|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, message)
    end
    expect(Setting.get(setting_name)).to eq(defaults)
  end
end
