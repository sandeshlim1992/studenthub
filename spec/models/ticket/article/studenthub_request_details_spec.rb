# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub request forms: Request details block', aggregate_failures: true, db_strategy: :reset, type: :model do
  let(:hr)       { create(:organization, name: 'HR spec') }
  let(:hr_staff) { create(:customer, organization: hr) }
  let(:items) do
    [
      { 'type' => 'heading', 'text' => 'Employee' },
      { 'type' => 'field', 'name' => 'start_date', 'required' => true },
      { 'type' => 'note', 'text' => 'Only shown on the form.' },
      { 'type' => 'heading', 'text' => 'Equipment' },
      { 'type' => 'field', 'name' => 'laptop', 'required' => false },
      { 'type' => 'field', 'name' => 'laptop_model', 'required' => false },
      { 'type' => 'heading', 'text' => 'Access' },
      { 'type' => 'field', 'name' => 'building', 'required' => false },
    ]
  end
  let(:organization_ids) { [] }
  let(:form) do
    UserInfo.ensure_current_user_id do
      StudenthubRequestForm.create!(draft: StudenthubRequestForm.normalize_definition(
        'category' => 'People', 'sub_category' => 'Onboarding', 'items' => items, 'organization_ids' => organization_ids
      )).tap(&:publish!)
    end
  end
  let(:sub_category) { 'Onboarding' }
  let(:ticket) do
    create(:ticket, customer: hr_staff, category2: 'People', subcategory: sub_category,
                    start_date: '2026-11-03', laptop: true, laptop_model: 'standard')
  end

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding', 'Wi-Fi' => 'Wi-Fi' })
    create(:object_manager_attribute_date, name: 'start_date', display: 'Start date')
    create(:object_manager_attribute_boolean, name: 'laptop', display: 'Laptop needed')
    create(:object_manager_attribute_select, name: 'laptop_model', display: 'Model', data_option_options: { 'standard' => 'Standard laptop' })
    create(:object_manager_attribute_text, name: 'building', display: 'Building')
    ObjectManager::Attribute.migration_execute

    form
  end

  def first_article(**attributes)
    create(:ticket_article, ticket:, body: '<p>See you soon.</p>', content_type: 'text/html', **attributes)
  end

  it 'starts the first message with the answers under their headings' do
    article = first_article

    expect(article.body).to eq(
      '<p><strong>Request details · Onboarding</strong></p>' \
      '<p><strong>Employee</strong></p><table><tbody><tr><td>Start date</td><td>3 Nov 2026</td></tr></tbody></table>' \
      '<p><strong>Equipment</strong></p><table><tbody><tr><td>Laptop needed</td><td>yes</td></tr><tr><td>Model</td><td>Standard laptop</td></tr></tbody></table>' \
      '<hr><p>See you soon.</p>'
    )
    expect(article.preferences['studenthub_request_form']).to eq('id' => form.id, 'version' => form.reload.published_at.iso8601)
  end

  it 'writes plain text for a plain text message' do
    article = first_article(body: 'See you soon.', content_type: 'text/plain')

    expect(article.body).to start_with("Request details · Onboarding\n\nEMPLOYEE\nStart date: 3 Nov 2026\n\nEQUIPMENT\nLaptop needed: yes\nModel: Standard laptop\n")
    expect(article.body).to end_with("#{'-' * 40}\nSee you soon.")
  end

  it 'leaves later messages as they are' do
    first_article
    later = create(:ticket_article, ticket:, body: '<p>Any news?</p>', content_type: 'text/html')

    expect(later.body).to eq('<p>Any news?</p>')
  end

  it 'leaves emails from a mail channel as they are' do
    article = ApplicationHandleInfo.use('email_parser.postmaster') { first_article }

    expect(article.body).to eq('<p>See you soon.</p>')
  end

  context 'when the ticket is under another sub-category' do
    let(:sub_category) { 'Wi-Fi' }

    it 'leaves the message as it is' do
      expect(first_article.body).to eq('<p>See you soon.</p>')
    end
  end

  context 'when the form is meant for other customers' do
    let(:organization_ids) { [create(:organization).id] }

    it 'leaves the message as it is' do
      expect(first_article.body).to eq('<p>See you soon.</p>')
    end
  end

  context "with the form's own questions" do
    let(:items) do
      [
        { 'type' => 'heading', 'text' => 'Employee' },
        { 'type' => 'question', 'key' => 'full_name', 'label' => 'Full name', 'kind' => 'text', 'required' => true },
        { 'type' => 'field', 'name' => 'start_date', 'required' => false },
        { 'type' => 'heading', 'text' => 'Equipment' },
        { 'type' => 'question', 'key' => 'model', 'label' => 'Model', 'kind' => 'select', 'options' => %w[Standard High-spec] },
        { 'type' => 'question', 'key' => 'extras', 'label' => 'Extras', 'kind' => 'multiselect', 'options' => %w[Mouse Headset] },
        { 'type' => 'question', 'key' => 'first_day', 'label' => 'In on day one', 'kind' => 'boolean' },
      ]
    end

    def sent(answers)
      { 'studenthub_request_answers' => { 'form_id' => form.id, 'answers' => answers } }
    end

    it 'writes the answers into the block, saves them and keeps them out of the preferences' do
      article = first_article(preferences: sent(
        'full_name' => 'Jane Doe', 'model' => 'High-spec', 'extras' => %w[Headset Keyboard],
        'first_day' => true, 'unknown' => 'dropped'
      ))

      expect(article.body).to start_with(
        '<p><strong>Request details · Onboarding</strong></p>' \
        '<p><strong>Employee</strong></p><table><tbody><tr><td>Full name</td><td>Jane Doe</td></tr><tr><td>Start date</td><td>3 Nov 2026</td></tr></tbody></table>' \
        '<p><strong>Equipment</strong></p><table><tbody><tr><td>Model</td><td>High-spec</td></tr><tr><td>Extras</td><td>Headset</td></tr><tr><td>In on day one</td><td>yes</td></tr></tbody></table>' \
        '<hr>'
      )
      expect(article.preferences).not_to have_key('studenthub_request_answers')

      saved = StudenthubRequestAnswer.find_by(ticket_id: ticket.id)
      expect(saved.answers).to eq('full_name' => 'Jane Doe', 'model' => 'High-spec', 'extras' => ['Headset'], 'first_day' => true)
      expect(saved.questions.pluck('key')).to eq(%w[full_name model extras first_day])
      expect(saved).to have_attributes(ticket_article_id: article.id, request_form_id: form.id)
    end

    it 'leaves out an answer that is not one of the options' do
      article = first_article(preferences: sent('full_name' => 'Jane Doe', 'model' => 'Gaming laptop'))

      expect(article.body).not_to include('Gaming laptop')
      expect(StudenthubRequestAnswer.find_by(ticket_id: ticket.id).answers).to eq('full_name' => 'Jane Doe')
    end

    it 'refuses the message when a required question has no answer' do
      expect { first_article(preferences: sent('model' => 'Standard')) }
        .to raise_error(Exceptions::UnprocessableContent, 'Please answer: Full name')
    end

    it 'does not ask for answers the classic UI or the API cannot send' do
      article = first_article

      expect(article.body).to start_with('<p><strong>Request details · Onboarding</strong></p><p><strong>Employee</strong></p><table><tbody><tr><td>Start date</td>')
      expect(StudenthubRequestAnswer.exists?(ticket_id: ticket.id)).to be(false)
    end
  end
end
