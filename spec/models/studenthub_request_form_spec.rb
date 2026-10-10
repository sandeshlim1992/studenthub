# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe StudenthubRequestForm, aggregate_failures: true, type: :model do
  describe '.normalize_definition' do
    it 'keeps questions, headings and notes in order and lists the questions as fields' do
      definition = described_class.normalize_definition(
        'category' => 'People', 'sub_category' => 'Onboarding',
        'items'    => [
          { 'type' => 'heading', 'text' => ' Employee ' },
          { 'type' => 'field', 'name' => 'start_date', 'required' => 'true' },
          { 'type' => 'note', 'text' => 'The first day in the office.' },
          { 'type' => 'heading', 'text' => '  ' },
          { 'type' => 'field', 'name' => 'laptop' },
          { 'type' => 'field', 'name' => 'start_date', 'required' => false },
          { 'type' => 'unknown', 'text' => 'dropped' },
        ]
      )

      expect(definition['items']).to eq([
                                          { 'type' => 'heading', 'text' => 'Employee' },
                                          { 'type' => 'field', 'name' => 'start_date', 'required' => true },
                                          { 'type' => 'note', 'text' => 'The first day in the office.' },
                                          { 'type' => 'field', 'name' => 'laptop', 'required' => false },
                                        ])
      expect(definition['fields']).to eq([
                                           { 'name' => 'start_date', 'required' => true },
                                           { 'name' => 'laptop', 'required' => false },
                                         ])
    end

    it 'turns a definition from before items (fields only) into the same questions' do
      definition = described_class.normalize_definition(
        'category' => 'People', 'sub_category' => 'Onboarding',
        'fields'   => [{ 'name' => 'start_date', 'required' => true }, { 'name' => 'laptop', 'required' => false }]
      )

      expect(definition['items']).to eq([
                                          { 'type' => 'field', 'name' => 'start_date', 'required' => true },
                                          { 'type' => 'field', 'name' => 'laptop', 'required' => false },
                                        ])
      expect(definition['fields']).to eq([
                                           { 'name' => 'start_date', 'required' => true },
                                           { 'name' => 'laptop', 'required' => false },
                                         ])
    end

    it "keeps a form's own questions, with a key from the label that never changes" do
      definition = described_class.normalize_definition(
        'category' => 'People', 'sub_category' => 'Onboarding',
        'items'    => [
          { 'type' => 'question', 'label' => 'Start date', 'kind' => 'date', 'required' => true, 'options' => ['ignored'] },
          { 'type' => 'question', 'label' => 'Laptop model', 'kind' => 'select', 'options' => ['Standard', ' High-spec ', 'Standard', ''] },
          { 'type' => 'question', 'key' => 'start_date', 'label' => 'First day', 'kind' => 'date' },
          { 'type' => 'question', 'label' => '  ', 'kind' => 'text' },
          { 'type' => 'question', 'label' => 'Notes', 'kind' => 'unknown' },
        ]
      )

      expect(definition['items']).to eq([
                                          { 'type' => 'question', 'key' => 'start_date_2', 'label' => 'Start date', 'kind' => 'date', 'help' => '', 'required' => true },
                                          { 'type' => 'question', 'key' => 'laptop_model', 'label' => 'Laptop model', 'kind' => 'select', 'help' => '', 'required' => false, 'options' => %w[Standard High-spec] },
                                          { 'type' => 'question', 'key' => 'start_date', 'label' => 'First day', 'kind' => 'date', 'help' => '', 'required' => false },
                                          { 'type' => 'question', 'key' => 'notes', 'label' => 'Notes', 'kind' => 'text', 'help' => '', 'required' => false },
                                        ])
      expect(definition['fields']).to eq([])
    end
  end

  describe 'questions' do
    let(:definition) do
      described_class.normalize_definition(
        'category' => 'People', 'sub_category' => 'Onboarding',
        'items'    => [{ 'type' => 'question', 'key' => 'start', 'label' => 'Start', 'kind' => 'date' }]
      )
    end

    before do
      create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People' })
      create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding' })
    end

    it 'publishes a form that has only questions' do
      form = UserInfo.ensure_current_user_id { described_class.create!(draft: definition) }

      expect(form.problems).to eq([])
    end

    it "refuses to change a published question's type" do
      form = UserInfo.ensure_current_user_id { described_class.create!(draft: definition).tap(&:publish!) }
      changed = definition.merge('items' => [definition['items'].first.merge('kind' => 'text')])

      expect { UserInfo.ensure_current_user_id { form.update!(draft: changed) } }
        .to raise_error(ActiveRecord::RecordInvalid, %r{type of a published question can't change})
    end

    it 'counts questions and fields together against the limit' do
      items = Array.new(Studenthub::RequestForms::MAX_FIELDS + 1) { |index| { 'type' => 'question', 'label' => "Question #{index}" } }
      form  = described_class.new(draft: described_class.normalize_definition(definition.merge('items' => items)))

      expect(form).not_to be_valid
    end
  end
end
