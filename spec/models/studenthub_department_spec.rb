# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe StudenthubDepartment, aggregate_failures: true, type: :model do
  before do
    create(:object_manager_attribute_select, name: 'campus', data_option_options: { 'LSST Wembley' => 'LSST Wembley', 'FSB Sheffield' => 'FSB Sheffield' })
  end

  def build_department(**attributes)
    described_class.new({ name: 'Registry', email: 'registry@studenthub.example', locations: ['LSST Wembley'] }.merge(attributes))
  end

  def save(department)
    UserInfo.ensure_current_user_id { department.save }
  end

  it 'tidies the name, email and locations' do
    department = build_department(name: '  Student   Finance ', email: ' Finance@StudentHub.example ', locations: ['FSB Sheffield', ' FSB Sheffield', ''])

    expect(save(department)).to be(true)
    expect(department.reload).to have_attributes(name: 'Student Finance', email: 'finance@studenthub.example', locations: ['FSB Sheffield'])
  end

  it 'needs a name, a valid email address and at least one location' do
    department = build_department(name: ' ', email: 'not an address', locations: [])

    expect(save(department)).to be(false)
    expect(department.errors.full_messages).to contain_exactly(
      'Enter a name.', 'not an address is not a valid email address.', 'Choose at least one location.'
    )
  end

  it 'refuses a name that is taken, whatever its case' do
    save(build_department)

    department = build_department(name: 'REGISTRY')

    expect(save(department)).to be(false)
    expect(department.errors.full_messages).to eq(['REGISTRY already exists.'])
  end

  it 'refuses locations that are not campuses' do
    department = build_department(locations: ['LSST Wembley', 'Mars'])

    expect(save(department)).to be(false)
    expect(department.errors.full_messages).to eq(['Mars is not a campus.'])
  end

  it 'keeps a campus that was later removed from the field, and names it' do
    department = build_department(locations: ['LSST Wembley', 'FSB Sheffield'])
    save(department)
    ObjectManager::Attribute.get(object: 'Ticket', name: 'campus').update!(data_option: { options: { 'LSST Wembley' => 'LSST Wembley' }, default: '' })

    department.name = 'Registry office'

    expect(save(department)).to be(true)
    expect(department.missing_locations).to eq(['FSB Sheffield'])
  end
end
