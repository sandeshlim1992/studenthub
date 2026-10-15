# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# Student Hub: the new UI is served at / (Studenthub::NewUiAtRoot), so the links in sign-in emails
# point to its pages. The classic UI's #password_reset_verify/… addresses opened the new UI's home
# page instead, so an invited person couldn't set a password.
RSpec.describe 'Student Hub links in sign-in emails', :aggregate_failures, type: :request do
  let(:mails) { [] }

  before do
    allow(NotificationFactory::Mailer).to receive(:deliver) { |params| mails << params[:body] }
  end

  context 'when an admin invites someone', authenticated_as: :admin do
    let(:admin) { create(:admin) }

    it 'links to the page where they set their password' do
      post '/api/v1/users', params: { firstname: 'Ann', email: 'ann.invited@example.com', role_ids: [Role.find_by(name: 'Agent').id], invite: true }, as: :json

      expect(response).to have_http_status(:created)
      token = Token.find_by(action: 'PasswordReset', user_id: json_response['id'])
      expect(mails.last).to include("http://zammad.example.com/reset-password/verify/#{token.token}")
    end
  end

  it 'links the classic forgot-password form to the page where a new password is set' do
    user = create(:agent)

    post '/api/v1/users/password_reset', params: { username: user.login }, as: :json

    expect(mails.last).to include("http://zammad.example.com/reset-password/verify/#{Token.find_by(action: 'PasswordReset', user_id: user.id).token}")
  end

  it 'links the classic signup to the page where the email address is confirmed' do
    Service::User::Deprecated::Signup.execute(user_data: { firstname: 'Bo', email: 'bo.signup@example.com', password: 'Zammad123!Zammad' })

    expect(mails.last).to match(%r{http://zammad\.example\.com/signup/verify/\w+})
  end

  it 'has no mail template that links to a classic sign-in address' do
    templates = Rails.root.glob('app/views/mailer/**/*.erb').select { |path| path.read.match?(%r{/#(password_reset_verify|email_verify|login/admin)}) }

    expect(templates).to be_empty
  end
end
