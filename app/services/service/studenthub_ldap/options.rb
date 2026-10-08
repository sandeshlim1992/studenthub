# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what the new UI's LDAP page needs besides Zammad's own LDAP API: whether the
# integration is on, the roles LDAP groups can map to, and the user fields LDAP attributes can fill
# (text fields, as in the classic wizard; never the password).
class Service::StudenthubLdap::Options < Service::Base
  TEXT_TYPES = %w[input textarea richtext].freeze

  def execute
    {
      enabled:         Setting.get('ldap_integration') == true,
      roles:           Role.where(active: true).reorder(:name).map { |role| { id: role.id, name: role.name } },
      user_attributes: self.class.user_attributes,
    }
  end

  # Text fields of users, also used by the Exchange page.
  def self.user_attributes
    ObjectManager::Attribute.list_full
      .map(&:with_indifferent_access)
      .select { |attribute| attribute[:object].to_s == 'User' && attribute[:active] && TEXT_TYPES.include?(attribute[:data_type]) }
      .reject { |attribute| attribute[:name] == 'password' || attribute.dig(:data_option, :type) == 'password' }
      .sort_by { |attribute| attribute[:position].to_i }
      .map { |attribute| { name: attribute[:name], display: attribute[:display] } }
  end
end
