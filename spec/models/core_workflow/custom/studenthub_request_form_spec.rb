# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'
require 'models/core_workflow/base'

RSpec.describe CoreWorkflow::Custom::StudenthubRequestForm, aggregate_failures: true, db_strategy: :reset, type: :model do
  include_context 'with core workflow base'

  let(:hr)               { create(:organization, name: 'HR spec') }
  let(:hr_staff)         { create(:customer, organization: hr) }
  let(:student)          { create(:customer) }
  let(:organization_ids) { [hr.id] }
  let(:shown_screens) do
    {
      create_middle: { 'ticket.customer' => { shown: true }, 'ticket.agent' => { shown: true } },
      edit:          { 'ticket.customer' => { shown: true }, 'ticket.agent' => { shown: true } },
    }
  end

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People', 'IT' => 'IT' }, screens: shown_screens)
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding', 'Wi-Fi' => 'Wi-Fi' }, screens: shown_screens)
    create(:object_manager_attribute_date, name: 'start_date', display: 'Start date', screens: {
             create_middle: { 'ticket.customer' => { shown: false }, 'ticket.agent' => { shown: false } },
             edit:          { 'ticket.agent' => { shown: true } },
           })
    ObjectManager::Attribute.migration_execute

    UserInfo.ensure_current_user_id do
      StudenthubRequestForm.create!(draft: {
                                      'category' => 'People', 'sub_category' => 'Onboarding', 'title' => '', 'help_text' => '',
                                      'fields' => [{ 'name' => 'start_date', 'required' => true }],
                                      'organization_ids' => organization_ids, 'role_ids' => []
                                    }).publish!
    end
  end

  def create_payload(params)
    base_payload.merge('params' => params)
  end

  context 'when someone the form is meant for raises a ticket' do
    let(:action_user) { hr_staff }
    let(:payload) { create_payload('category2' => 'People', 'subcategory' => 'Onboarding') }

    it 'shows the form\'s fields and requires them' do
      expect(result[:visibility]['start_date']).to eq('show')
      expect(result[:mandatory]['start_date']).to be(true)
    end
  end

  context 'when the ticket is under another sub-category' do
    let(:action_user) { hr_staff }
    let(:payload) { create_payload('category2' => 'People', 'subcategory' => 'Wi-Fi') }

    it 'leaves the fields out' do
      expect(result[:visibility]['start_date']).to eq('remove')
    end
  end

  context 'when another customer raises a ticket' do
    let(:action_user) { student }
    let(:payload)      { create_payload('category2' => 'People') }

    it 'does not offer the sub-category' do
      expect(result[:restrict_values]['subcategory']).not_to include('Onboarding')
      expect(result[:restrict_values]['subcategory']).to include('Wi-Fi')
    end
  end

  context 'when the form is for everyone' do
    let(:organization_ids) { [] }
    let(:action_user) { student }
    let(:payload)     { create_payload('category2' => 'People', 'subcategory' => 'Onboarding') }

    it 'shows the fields to any customer' do
      expect(result[:visibility]['start_date']).to eq('show')
    end
  end

  context 'when an agent raises a ticket for someone the form is meant for' do
    let(:payload) { create_payload('category2' => 'People', 'subcategory' => 'Onboarding', 'customer_id' => hr_staff.id.to_s) }

    it 'shows the fields and keeps every sub-category' do
      expect(result[:visibility]['start_date']).to eq('show')
      expect(result[:restrict_values]['subcategory']).to be_nil
    end
  end

  context 'when looking at a ticket' do
    let(:payload) { base_payload.merge('screen' => 'edit', 'params' => { 'id' => ticket.id }) }

    it 'leaves the empty field out of tickets under other sub-categories' do
      Ticket.find(ticket.id).update!(category2: 'People', subcategory: 'Wi-Fi')

      expect(result[:visibility]['start_date']).to eq('remove')
    end

    it 'shows the field on tickets under the form\'s sub-category' do
      Ticket.find(ticket.id).update!(category2: 'People', subcategory: 'Onboarding')

      expect(result[:visibility]['start_date']).to eq('show')
    end
  end
end
