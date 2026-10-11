# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::ChecklistAssignments::WebhookTriggers, aggregate_failures: true, current_user_id: 1 do
  let(:template) { create(:checklist_template, name: 'Onboarding') }
  let(:webhook) do
    create(:webhook, name: 'Onboarding Checklist API Loopback', endpoint: 'https://example.com/api/v1/checklists',
                     customized_payload: true, custom_payload: %({ "ticket_id": "\#{ticket.id}", "template_id": #{template.id} }))
  end

  def checklist_trigger(sub_categories, hook = webhook, tag: true)
    perform = { 'notification.webhook' => { 'webhook_id' => hook.id.to_s } }
    perform['ticket.tags'] = { 'operator' => 'add', 'value' => 'checklist-checd' } if tag

    create(:trigger, activator: 'action', execution_condition_mode: 'always', perform:,
                     condition: { 'ticket.subcategory' => { 'operator' => 'is', 'value' => sub_categories }, 'ticket.action' => { 'operator' => 'is', 'value' => 'create' } })
  end

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'Service Request' => 'Service Request', 'IT' => 'IT' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding (New Starter)' => 'Onboarding (New Starter)', 'Others' => 'Others' })
    # Others is under both categories, Onboarding only under Service Request
    create(:core_workflow, object:             'Ticket',
                           condition_selected: { 'ticket.category2' => { 'operator' => 'is', 'value' => ['IT'] } },
                           perform:            { 'ticket.subcategory' => { 'operator' => 'remove_option', 'remove_option' => ['Onboarding (New Starter)'] } })
  end

  it 'makes assignments of the checklist triggers, which keep their tag, and switches their webhooks off' do
    trigger = checklist_trigger(['Onboarding (New Starter)'])
    other   = create(:trigger)

    expect(described_class.convert!).to eq(["#{trigger.name}: Service Request › Onboarding (New Starter) now get \"Onboarding\" from the Checklists page"])

    expect(StudenthubChecklistAssignment.sole).to have_attributes(category: 'Service Request', sub_category: 'Onboarding (New Starter)', checklist_template: template)
    expect(trigger.reload).to have_attributes(active: true, perform: { 'ticket.tags' => { 'operator' => 'add', 'value' => 'checklist-checd' } })
    expect(webhook.reload.active).to be(false)
    expect(other.reload).to have_attributes(active: true, perform: { 'ticket.state_id' => { 'value' => 4 } })
  end

  it 'switches a trigger off when the webhook was all it did' do
    trigger = checklist_trigger(['Onboarding (New Starter)'], tag: false)
    described_class.convert!

    expect(trigger.reload.active).to be(false)
  end

  it 'leaves a trigger whose sub-category is under several categories' do
    trigger = checklist_trigger(['Others'])

    expect(described_class.convert!.sole).to include('no single category')
    expect(StudenthubChecklistAssignment.count).to eq(0)
    expect(trigger.reload.perform).to include('notification.webhook')
    expect(webhook.reload.active).to be(true)
  end

  it 'ignores webhooks that go elsewhere' do
    elsewhere = create(:webhook, endpoint: 'https://example.com/hook', custom_payload: %({ "template_id": #{template.id} }))
    trigger   = checklist_trigger(['Onboarding (New Starter)'], elsewhere)

    expect(described_class.convert!).to eq([])
    expect(trigger.reload.perform).to include('notification.webhook')
  end
end
