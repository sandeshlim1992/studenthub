# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::ChecklistAssignments, aggregate_failures: true, current_user_id: 1, db_strategy: :reset do
  let(:onboarding) { create(:checklist_template, name: 'Onboarding', items: %w[Account Laptop]) }
  let(:id_card)    { create(:checklist_template, name: 'ID card', items: ['Photo']) }

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People', 'IT' => 'IT' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding', 'ID card' => 'ID card', 'Wi-Fi' => 'Wi-Fi' })
    ObjectManager::Attribute.migration_execute

    described_class.replace!(onboarding, [{ category: 'People', sub_category: 'Onboarding' }])
  end

  def raise_ticket(**fields)
    create(:ticket, **fields).reload
  end

  def move(ticket, **fields)
    ticket.update!(**fields)
    ticket.reload
  end

  it "gives a new ticket its sub-category's checklist" do
    ticket = raise_ticket(category2: 'People', subcategory: 'Onboarding')

    expect(ticket.checklist).to have_attributes(name: 'Onboarding')
    expect(ticket.checklist.sorted_items.map(&:text)).to eq(%w[Account Laptop])
  end

  it 'adds it when nobody is signed in (e.g. a ticket made in the background)' do
    UserInfo.current_user_id = nil
    ticket = create(:ticket, category2: 'People', subcategory: 'Onboarding', created_by_id: 1, updated_by_id: 1).reload

    expect(ticket.checklist).to have_attributes(name: 'Onboarding', created_by_id: 1)
  end

  it 'matches the category too' do
    expect(raise_ticket(category2: 'IT', subcategory: 'Onboarding').checklist).to be_nil
  end

  it 'gives it to a ticket moved there later, but never replaces a checklist' do
    described_class.replace!(id_card, [{ category: 'People', sub_category: 'ID card' }])
    ticket = raise_ticket(category2: 'People', subcategory: 'Wi-Fi')
    expect(ticket.checklist).to be_nil

    ticket = move(ticket, subcategory: 'Onboarding')
    expect(ticket.checklist.name).to eq('Onboarding')

    checklist = ticket.checklist
    ticket = move(ticket, subcategory: 'ID card')
    expect(ticket.checklist).to eq(checklist)
  end

  it 'skips inactive checklists, and everything while checklists are off' do
    onboarding.update!(active: false)
    expect(raise_ticket(category2: 'People', subcategory: 'Onboarding').checklist).to be_nil

    onboarding.update!(active: true)
    Setting.set('checklist', false)
    expect(raise_ticket(category2: 'People', subcategory: 'Onboarding').checklist).to be_nil
  end

  describe '.replace!' do
    it 'refuses a sub-category another checklist gets, or one that is not offered' do
      expect { described_class.replace!(id_card, [{ category: 'People', sub_category: 'Onboarding' }]) }
        .to raise_error(ActiveRecord::RecordInvalid, %r{People › Onboarding already gets the checklist "Onboarding"})
      expect { described_class.replace!(id_card, [{ category: 'People', sub_category: 'Printing' }]) }
        .to raise_error(Exceptions::UnprocessableContent, 'People › Printing is not a sub-category.')
    end

    it 'keeps a pair the fields dropped until it is taken off' do
      StudenthubChecklistAssignment.find_by(sub_category: 'Onboarding').update_columns(sub_category: 'Old')
      described_class.replace!(onboarding, [{ category: 'People', sub_category: 'Old' }, { category: 'People', sub_category: 'Wi-Fi' }])

      assignments = StudenthubChecklistAssignment.where(checklist_template: onboarding).reorder(:sub_category)
      expect(assignments.map { |assignment| [assignment.sub_category, assignment.missing?] }).to eq([['Old', true], ['Wi-Fi', false]])

      described_class.replace!(onboarding, [])
      expect(StudenthubChecklistAssignment.where(checklist_template: onboarding)).to be_empty
    end
  end

  it 'forgets the assignments of a deleted checklist' do
    onboarding.destroy!

    expect(StudenthubChecklistAssignment.count).to eq(0)
  end
end
