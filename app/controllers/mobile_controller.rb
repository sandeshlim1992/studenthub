# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class MobileController < ApplicationController
  def index
    render(layout: 'layouts/mobile', locals: { locale: current_user&.preferences&.dig(:locale) })
  end

  def service_worker
    render(file: Rails.root.join("public/#{ViteRuby.config.public_output_dir}/sw.js"), layout: false)
  end

  def manifest
    # Student Hub: named Student Hub, not Zammad, when no name is set and on the home screen.
    name = Setting.get('organization').presence || Setting.get('product_name').presence || __('Student Hub')

    render(
      layout:       false,
      json:         {
        id:               '/mobile/',
        short_name:       __('Student Hub'),
        name:             name,
        # TODO
        # dir: "ltr",
        # lang: "en-US",
        orientation:      'portrait',
        # Student Hub: the light theme's page colour (apps/mobile/styles/studenthub-light.css).
        background_color: '#f4f5f8',
        theme_color:      '#f4f5f8',
        display:          'standalone',
        start_url:        '/mobile/',
        icons:            [
          # files are relative to manifest.webmanifest and are stored in public/assets/frontend
          { src: '../assets/frontend/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '../assets/frontend/app-icon-192.png', sizes: '192x192', type: 'image/png' },
        ]
      },
      content_type: 'application/manifest+json'
    )
  end
end
