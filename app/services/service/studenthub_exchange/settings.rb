# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Exchange page of the new UI. What is set up (on/off, the import settings in
# "exchange_config", the Microsoft 365 app and the connected account) without passwords or tokens,
# and saving on/off and the import settings. The wizard's steps use Zammad's own API
# (/api/v1/integration/exchange/..., /api/v1/external_credentials/...).
class Service::StudenthubExchange::Settings < Service::Base
  PASSWORD_MASK = '**********'.freeze
  CONFIG_KEYS   = %w[auth_type endpoint user password disable_ssl_verify folders attributes].freeze

  attr_reader :changes

  def initialize(changes: nil)
    super()
    @changes = changes
  end

  def execute
    apply(changes) if changes
    current
  end

  private

  def current
    config = Setting.get('exchange_config').to_h.with_indifferent_access
    oauth  = Setting.get('exchange_oauth').to_h.with_indifferent_access
    app    = ExternalCredential.find_by(name: 'exchange')

    {
      enabled:         Setting.get('exchange_integration') == true,
      config:          config.slice(*CONFIG_KEYS).merge(password: config[:password].present? ? PASSWORD_MASK : ''),
      app:             app && { id: app.id, client_id: app.credentials['client_id'], client_tenant: app.credentials['client_tenant'] },
      account:         oauth[:access_token].present? ? { user: oauth[:user], connected_at: oauth[:created_at] } : nil,
      callback_url:    ExternalCredential.callback_url('exchange'),
      user_attributes: Service::StudenthubLdap::Options.user_attributes,
    }
  end

  def apply(changes)
    changes = changes.to_h.with_indifferent_access
    Setting.set('exchange_integration', ActiveModel::Type::Boolean.new.cast(changes[:enabled]) == true) if changes.key?(:enabled)
    return if !changes.key?(:config)

    stored = Setting.get('exchange_config').to_h.with_indifferent_access
    config = changes[:config].to_h.with_indifferent_access.slice(*CONFIG_KEYS)
    config[:password] = stored[:password] if config[:password] == PASSWORD_MASK

    Setting.set('exchange_config', stored.merge(config).to_hash)
  end
end
