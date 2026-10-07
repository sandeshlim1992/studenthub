# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# The new UI's Public Links page saves through Zammad's API; this is what it sends.
RSpec.describe 'Student Hub Public Links (new UI)', aggregate_failures: true, authenticated_as: :admin, type: :request do
  let(:admin) { create(:admin) }

  it 'adds a link for the sign-in and password reset pages, reorders and deletes links' do
    first = create(:public_link, title: 'IT help', link: 'https://it.example.ac.uk', screen: %w[login], prio: 1)

    post '/api/v1/public_links', params: {
      title: 'Student portal', link: 'https://portal.example.ac.uk', description: nil, screen: %w[login password_reset], new_tab: true,
    }, as: :json

    expect(response).to have_http_status(:created)
    created = PublicLink.find(json_response['id'])
    expect(created).to have_attributes(screen: %w[login password_reset], new_tab: true)

    post '/api/v1/public_links_prio', params: { prios: [[created.id, 1], [first.id, 2]] }, as: :json
    expect(PublicLink.reorder(:prio).pluck(:id)).to eq([created.id, first.id])

    delete "/api/v1/public_links/#{first.id}", as: :json
    expect(PublicLink).not_to exist(first.id)
  end

  it 'refuses a link without any page' do
    post '/api/v1/public_links', params: { title: 'Nowhere', link: 'https://example.ac.uk', screen: [] }, as: :json

    expect(response).to have_http_status(:unprocessable_content)
  end
end
