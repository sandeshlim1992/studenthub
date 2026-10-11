# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: turns the old way of adding checklists into checklist assignments
# (Studenthub::ChecklistAssignments). That was an active trigger on "Sub-category is …" calling a
# webhook that posts { ticket_id, template_id } to Zammad's own checklists API. Each such trigger
# gives an assignment per sub-category and loses its webhook action, keeping the others (e.g. a tag
# that other triggers react to; without any left it is switched off). A webhook no active trigger
# calls any more is switched off. Used once by the 20261011140000 migration; returns a line per
# trigger for its output.
module Studenthub::ChecklistAssignments::WebhookTriggers
  ENDPOINT = %r{/api/v1/checklists/?\z}

  def self.convert!
    UserInfo.ensure_current_user_id do
      offered = Studenthub::ChecklistAssignments.sub_categories_by_category
      Trigger.where(active: true).reorder(:id).filter_map { |trigger| convert(trigger, offered) }
    end
  end

  def self.convert(trigger, offered)
    webhook = checklist_webhook(trigger)
    return if !webhook

    template = ChecklistTemplate.find_by(id: payload(webhook)['template_id'])
    return "#{trigger.name}: its checklist template doesn't exist, left as it is" if !template

    pairs = sub_categories(trigger).map { |sub_category| [category_of(sub_category, offered), sub_category] }
    if pairs.empty? || pairs.any? { |category, _| category.nil? }
      return "#{trigger.name}: no single category for its sub-categories, left as it is"
    end

    taken = pairs.any? do |category, sub_category|
      StudenthubChecklistAssignment.where(category:, sub_category:).where.not(checklist_template: template).exists?
    end
    return "#{trigger.name}: a sub-category already gets another checklist, left as it is" if taken

    pairs.each do |category, sub_category|
      StudenthubChecklistAssignment.find_or_create_by!(category:, sub_category:, checklist_template: template)
    end
    remove_webhook_action(trigger, webhook)

    "#{trigger.name}: #{pairs.map { |pair| pair.join(' › ') }.join(', ')} now get \"#{template.name}\" from the Checklists page"
  end

  def self.checklist_webhook(trigger)
    webhook = Webhook.find_by(id: trigger.perform.to_h.dig('notification.webhook', 'webhook_id'))
    webhook if webhook && webhook.endpoint.to_s.match?(ENDPOINT) && payload(webhook)['template_id'].present?
  end

  def self.payload(webhook)
    JSON.parse(webhook.custom_payload.to_s).then { |data| data.is_a?(Hash) ? data : {} }
  rescue JSON::ParserError
    {}
  end

  # The sub-categories of a trigger on "Sub-category is …".
  def self.sub_categories(trigger)
    rule = trigger.condition.to_h["ticket.#{Studenthub::ChecklistAssignments::SUB_CATEGORY_FIELD}"]
    return [] if !rule.is_a?(Hash) || rule['operator'] != 'is'

    Array(rule['value']).compact_blank.map(&:to_s)
  end

  # The category a sub-category is offered under, if exactly one.
  def self.category_of(sub_category, offered)
    categories = offered.select { |_category, options| options.any? { |option| option[:value] == sub_category } }.keys
    categories.first if categories.one?
  end

  def self.remove_webhook_action(trigger, webhook)
    perform = trigger.perform.except('notification.webhook')
    if perform.present?
      trigger.update!(perform:)
    else
      trigger.update!(active: false)
    end

    still_called = Trigger.where(active: true).any? do |other|
      other.perform.to_h.dig('notification.webhook', 'webhook_id').to_s == webhook.id.to_s
    end
    return if still_called

    # Not validated: Zammad checks the endpoint's address on every save, which a webhook being
    # switched off shouldn't depend on.
    webhook.active = false
    webhook.save!(validate: false)
  end
end
