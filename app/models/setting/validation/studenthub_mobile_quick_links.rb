# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the mobile app's quick links are a list of at most Studenthub::MobileApp::MAX_QUICK_LINKS,
# each only a label (text) and a web address. The mobile app opens the addresses, so only
# http and https with a host are allowed: no javascript:, data: or relative addresses.
class Setting::Validation::StudenthubMobileQuickLinks < Setting::Validation::Base
  def run
    return result_failed(__('The quick links must be a list.')) if !value.is_a?(Array)
    if value.size > Studenthub::MobileApp::MAX_QUICK_LINKS
      return result_failed(format(__('There can be at most %s quick links.'), Studenthub::MobileApp::MAX_QUICK_LINKS))
    end

    error = value.lazy.filter_map { |link| link_error(link) }.first
    return result_failed(error) if error

    result_success
  end

  private

  def link_error(link)
    return __('Each quick link must be a label and a web address.') if !link.is_a?(Hash) || link.keys.map(&:to_s).sort != %w[label url]

    label = link.stringify_keys['label']
    url   = link.stringify_keys['url']

    label_error(label) || url_error(label, url)
  end

  def label_error(label)
    return __('Each quick link needs a label.') if !label.is_a?(String) || label.strip.empty?
    return if label.length <= Studenthub::MobileApp::MAX_LABEL_LENGTH

    format(__('The label "%1$s" can be at most %2$s characters long.'), label, Studenthub::MobileApp::MAX_LABEL_LENGTH)
  end

  def url_error(label, url)
    return format(__('The web address of "%s" is too long.'), label) if url.is_a?(String) && url.length > Studenthub::MobileApp::MAX_URL_LENGTH
    return if web_address?(url)

    format(__('The web address of "%s" must be a full address starting with https:// or http://.'), label)
  end

  def web_address?(url)
    return false if !url.is_a?(String)

    uri = URI.parse(url)
    %w[http https].include?(uri.scheme) && uri.host.present?
  rescue URI::InvalidURIError
    false
  end
end
