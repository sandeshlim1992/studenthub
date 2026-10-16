# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# Student Hub: the mobile app has a light theme (app/frontend/apps/mobile/styles/studenthub-light.css),
# so the page behind it and the browser and home-screen colours are light too, and it installs as
# Student Hub.
RSpec.describe 'Student Hub mobile app', type: :request do
  describe 'the installed app' do
    # Served as application/manifest+json, which parsed_body leaves as a string.
    let(:manifest) { JSON.parse(response.body) } # rubocop:disable Rails/ResponseParsedBody

    before { get '/mobile/manifest.webmanifest' }

    it 'has a light background and bar colour' do
      expect(manifest).to include('background_color' => '#f4f5f8', 'theme_color' => '#f4f5f8')
    end

    it 'is named Student Hub on the home screen' do
      expect(manifest).to include('short_name' => 'Student Hub')
    end
  end

  it 'serves the mobile page on a light background' do
    get '/mobile'

    expect(response.body).to include('<meta name="theme-color" content="#f4f5f8">', '--background-primary: #f4f5f8;')
  end
end
