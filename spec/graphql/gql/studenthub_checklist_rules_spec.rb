# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# Student Hub: agents only tick checklist items; everything else is for checklist admins, and an
# agent adds only the checklist assigned to the ticket's sub-category (Studenthub::ChecklistRules).
RSpec.describe 'Student Hub checklist rules', :aggregate_failures, current_user_id: 1, type: :graphql do # rubocop:disable RSpec/DescribeClass
  let(:group)     { create(:group) }
  let(:agent)     { create(:agent, groups: [group]) }
  let(:admin)     { create(:admin, groups: [group]) }
  let(:ticket)    { create(:ticket, group:) }
  let(:checklist) { create(:checklist, ticket:, item_count: 2) }
  let(:item)      { checklist.items.first }

  def upsert(input, item_id: gql.id(item))
    gql.execute(<<~QUERY, variables: { checklistId: gql.id(checklist), checklistItemId: item_id, input: })
      mutation ticketChecklistItemUpsert($checklistId: ID!, $checklistItemId: ID, $input: TicketChecklistItemInput!) {
        ticketChecklistItemUpsert(checklistId: $checklistId, checklistItemId: $checklistItemId, input: $input) {
          checklistItem { id text checked }
        }
      }
    QUERY
  end

  def run(mutation, variables)
    gql.execute(mutation, variables:)
  end

  context 'with an agent', authenticated_as: :agent do
    it 'ticks and unticks an item' do
      upsert({ checked: true })
      expect(gql.result.data[:checklistItem]).to include('checked' => true)
      expect(item.reload.checked).to be(true)

      upsert({ checked: false })
      expect(item.reload.checked).to be(false)
    end

    it 'may not change an item’s text or add an item' do
      upsert({ text: 'Changed', checked: true })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)
      expect(item.reload.text).not_to eq('Changed')

      upsert({ text: 'New item' }, item_id: nil)
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)
      expect(checklist.items.count).to eq(2)
    end

    it 'may not rename, reorder or remove the checklist, or delete or bulk-add items' do
      run('mutation($checklistId: ID!) { ticketChecklistTitleUpdate(checklistId: $checklistId, title: "x") { checklist { id } } }', { checklistId: gql.id(checklist) })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)

      run('mutation($checklistId: ID!, $order: [ID!]!) { ticketChecklistItemOrderUpdate(checklistId: $checklistId, order: $order) { success } }',
          { checklistId: gql.id(checklist), order: checklist.items.reverse.map { |i| gql.id(i) } })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)

      run('mutation($checklistId: ID!, $input: [TicketChecklistItemInput!]!) { ticketChecklistItemsAdd(checklistId: $checklistId, input: $input) { success } }',
          { checklistId: gql.id(checklist), input: [{ text: 'x' }] })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)

      run('mutation($checklistId: ID!, $checklistItemId: ID!) { ticketChecklistItemDelete(checklistId: $checklistId, checklistItemId: $checklistItemId) { success } }',
          { checklistId: gql.id(checklist), checklistItemId: gql.id(item) })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)

      run('mutation($checklistId: ID!) { ticketChecklistDelete(checklistId: $checklistId) { success } }', { checklistId: gql.id(checklist) })
      expect(gql.result.error_type).to eq(Exceptions::Forbidden)

      expect(checklist.reload.items.count).to eq(2)
    end

    describe 'adding a checklist' do
      let(:ticket)   { create(:ticket, group:) }
      let(:assigned) { create(:checklist_template) }
      let(:other)    { create(:checklist_template) }
      let(:add)      { 'mutation($ticketId: ID!, $templateId: ID) { ticketChecklistAdd(ticketId: $ticketId, templateId: $templateId) { checklist { id } } }' }

      before do
        allow(Studenthub::ChecklistAssignments).to receive(:template_for_ticket).and_call_original
        allow(Studenthub::ChecklistAssignments).to receive(:template_for_ticket).with(ticket).and_return(assigned)
      end

      it 'adds only the checklist assigned to the ticket’s sub-category' do
        run(add, { ticketId: gql.id(ticket), templateId: gql.id(other) })
        expect(gql.result.error_type).to eq(Exceptions::Forbidden)

        run(add, { ticketId: gql.id(ticket) })
        expect(gql.result.error_type).to eq(Exceptions::Forbidden)
        expect(ticket.reload.checklist).to be_nil

        run(add, { ticketId: gql.id(ticket), templateId: gql.id(assigned) })
        expect(gql.result.data[:checklist]).to be_present
        expect(ticket.reload.checklist.name).to eq(assigned.name)
      end
    end
  end

  context 'with a checklist admin', authenticated_as: :admin do
    it 'edits, adds and removes' do
      upsert({ text: 'Changed' })
      expect(item.reload.text).to eq('Changed')

      upsert({ text: 'New item' }, item_id: nil)
      expect(checklist.items.count).to eq(3)

      run('mutation($checklistId: ID!) { ticketChecklistDelete(checklistId: $checklistId) { success } }', { checklistId: gql.id(checklist) })
      expect(Checklist.exists?(checklist.id)).to be(false)
    end
  end

  describe 'REST API (classic UI)', type: :request do
    let(:headers) { { 'CONTENT_TYPE' => 'application/json' } }

    context 'with an agent', authenticated_as: :agent do
      it 'ticks an item but may not change its text, add an item or rename the checklist' do
        put "/api/v1/checklist_items/#{item.id}", params: { checked: true, text: item.text }, as: :json
        expect(response).to have_http_status(:ok)
        expect(item.reload.checked).to be(true)

        put "/api/v1/checklist_items/#{item.id}", params: { text: 'Changed' }, as: :json
        expect(response).to have_http_status(:forbidden)

        post '/api/v1/checklist_items', params: { checklist_id: checklist.id, text: 'New item' }, as: :json
        expect(response).to have_http_status(:forbidden)

        put "/api/v1/checklists/#{checklist.id}", params: { name: 'Renamed' }, as: :json
        expect(response).to have_http_status(:forbidden)

        delete "/api/v1/checklists/#{checklist.id}", as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it 'may not add an empty checklist' do
        other_ticket = create(:ticket, group:)
        post '/api/v1/checklists', params: { ticket_id: other_ticket.id }, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'with a checklist admin', authenticated_as: :admin do
      it 'changes an item’s text' do
        put "/api/v1/checklist_items/#{item.id}", params: { text: 'Changed' }, as: :json
        expect(response).to have_http_status(:ok)
        expect(item.reload.text).to eq('Changed')
      end
    end
  end
end
