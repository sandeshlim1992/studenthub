# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the S/MIME and PGP settings of the new UI's pages, in one shape for both: on/off,
# signing of system notifications, and per team whether new emails are signed and encrypted by
# default (Zammad's "<kind>_config" setting: { group_id: { default_sign: {}, default_encryption: {} } }).
# Certificates and keys are managed with Zammad's own API (/api/v1/integration/smime|pgp/...).
class Service::StudenthubSecureEmail::Settings < Service::Base
  KINDS = %w[smime pgp].freeze

  attr_reader :kind, :changes

  def initialize(kind:, changes: nil)
    super()
    raise ArgumentError, "unknown kind #{kind}" if KINDS.exclude?(kind.to_s)

    @kind    = kind.to_s
    @changes = changes
  end

  def execute
    apply(changes) if changes
    current
  end

  private

  def current
    defaults = Setting.get("#{kind}_config").to_h.with_indifferent_access.fetch(:group_id, {})

    {
      enabled:                   Setting.get("#{kind}_integration") == true,
      sign_system_notifications: Setting.get("#{kind}_sign_system_notifications") == true,
      recipient_alias:           kind == 'pgp' && Setting.get('pgp_recipient_alias_configuration') == true,
      groups:                    Group.where(active: true).reorder(:name).map do |group|
        {
          id:         group.id,
          name:       group.fullname,
          sign:       defaults.dig(:default_sign, group.id.to_s) == true,
          encryption: defaults.dig(:default_encryption, group.id.to_s) == true,
        }
      end,
    }
  end

  def apply(changes)
    changes = changes.to_h.with_indifferent_access
    Setting.set("#{kind}_integration", cast(changes[:enabled])) if changes.key?(:enabled)
    Setting.set("#{kind}_sign_system_notifications", cast(changes[:sign_system_notifications])) if changes.key?(:sign_system_notifications)
    apply_group_defaults(changes[:groups]) if changes.key?(:groups)
  end

  # Keeps everything else in the config as it is.
  def apply_group_defaults(groups)
    config   = Setting.get("#{kind}_config").to_h.deep_dup.with_indifferent_access
    group_id = config[:group_id] ||= {}
    group_id[:default_sign] ||= {}
    group_id[:default_encryption] ||= {}

    Array(groups).each do |group|
      group = group.to_h.with_indifferent_access
      group_id[:default_sign][group[:id].to_s]       = cast(group[:sign])
      group_id[:default_encryption][group[:id].to_s] = cast(group[:encryption])
    end

    Setting.set("#{kind}_config", config.to_hash)
  end

  def cast(value)
    ActiveModel::Type::Boolean.new.cast(value) == true
  end
end
