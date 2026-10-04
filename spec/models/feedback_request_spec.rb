# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe FeedbackRequest, aggregate_failures: true, type: :model do
  describe 'tokens' do
    it 'stores only a SHA-256 digest of the token' do
      token   = described_class.generate_token
      request = create(:feedback_request, token:)

      expect(request.token_digest).to eq(Digest::SHA256.hexdigest(token))
      expect(request.attributes.values).not_to include(token)
    end

    it 'generates 64 character tokens' do
      expect(described_class.generate_token).to match(%r{\A[a-f0-9]{64}\z})
    end

    it 'finds a request by its token' do
      token   = described_class.generate_token
      request = create(:feedback_request, token:)

      expect(described_class.lookup_by_token(token)).to eq(request)
    end

    it 'finds nothing for an unknown, blank or overlong token' do
      create(:feedback_request)

      expect(described_class.lookup_by_token('nope')).to be_nil
      expect(described_class.lookup_by_token('')).to be_nil
      expect(described_class.lookup_by_token('a' * 200)).to be_nil
    end

    it 'replaces the digest when the token is regenerated' do
      old_token = described_class.generate_token
      request   = create(:feedback_request, token: old_token)
      new_token = request.regenerate_token!

      expect(described_class.lookup_by_token(old_token)).to be_nil
      expect(described_class.lookup_by_token(new_token)).to eq(request)
    end

    it 'fills in a digest when none is given' do
      request = create(:feedback_request, token_digest: nil)

      expect(request.token_digest).to match(%r{\A[a-f0-9]{64}\z})
    end
  end

  describe 'validations' do
    it 'accepts ratings from 1 to 5 only' do
      expect(build(:feedback_request, rating: 5)).to be_valid
      expect(build(:feedback_request, rating: 0)).not_to be_valid
      expect(build(:feedback_request, rating: 6)).not_to be_valid
    end

    it 'rejects unknown states' do
      expect(build(:feedback_request, state: 'opened')).not_to be_valid
    end
  end

  describe '.condition' do
    it 'combines group, owner and tag rules' do
      condition = described_class.condition({ group_ids: [3, 4], require_owner: true, skip_tags: ['spam', ' test '] })

      expect(condition).to eq(
        operator:   'AND',
        conditions: [
          { name: 'ticket.group_id', operator: 'is', value: %w[3 4] },
          { name: 'ticket.owner_id', operator: 'is not', pre_condition: 'not_set', value: [] },
          { name: 'ticket.tags', operator: 'contains one not', value: 'spam, test' },
        ]
      )
    end

    it 'is empty when no rules are set' do
      expect(described_class.condition({ group_ids: [], require_owner: false, skip_tags: [] })).to be_nil
    end
  end

  describe '.config' do
    it 'fills in defaults for missing keys' do
      Setting.set('feedback_collection_config', { from_email: 'feedback@example.com' })

      expect(described_class.config).to include(from_email: 'feedback@example.com', require_owner: true, skip_tags: ['spam'])
    end
  end
end
