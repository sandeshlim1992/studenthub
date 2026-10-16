# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubMobileQuickLinks, aggregate_failures: true do
  let(:setting_name) { 'studenthub_mobile_quick_links' }
  let(:moodle)       { { 'label' => 'Moodle', 'url' => 'https://moodle.example.ac.uk/my/' } }

  it 'accepts up to 8 links with http and https addresses' do
    links = [moodle, { 'label' => 'x' * 40, 'url' => 'http://timetable.example.ac.uk' }] + Array.new(6) { moodle }

    expect { Setting.set(setting_name, links) }.not_to raise_error
    expect(Setting.get(setting_name)).to eq(links)
    expect { Setting.set(setting_name, []) }.not_to raise_error
  end

  it 'refuses addresses the mobile app should not open' do
    {
      'javascript:alert(1)'        => %r{must be a full address},
      'data:text/html,<b>hi</b>'   => %r{must be a full address},
      '/knowledge-base'            => %r{must be a full address},
      'moodle.example.ac.uk'       => %r{must be a full address},
      'ftp://files.example.ac.uk'  => %r{must be a full address},
      'https://'                   => %r{must be a full address},
      'https://exa mple.ac.uk'     => %r{must be a full address},
      "https://#{'x' * 500}.ac.uk" => %r{is too long},
    }.each do |url, message|
      expect { Setting.set(setting_name, [moodle.merge('url' => url)]) }.to raise_error(ActiveRecord::RecordInvalid, message)
    end
  end

  it 'refuses lists, links and labels of the wrong shape' do
    {
      'https://moodle.example.ac.uk'      => %r{must be a list},
      Array.new(9) { moodle }             => %r{at most 8 quick links},
      ['https://moodle.example.ac.uk']    => %r{must be a label and a web address},
      [moodle.merge('icon' => 'book')]    => %r{must be a label and a web address},
      [moodle.merge('label' => '  ')]     => %r{needs a label},
      [moodle.merge('label' => 5)]        => %r{needs a label},
      [moodle.merge('label' => 'x' * 41)] => %r{can be at most 40 characters},
    }.each do |value, message|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, message)
    end
    expect(Setting.get(setting_name)).to eq([])
  end
end
