# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the mobile app's popular answers are a list of at most
# Studenthub::MobileApp::MAX_POPULAR_ANSWERS Knowledge Base answers (their IDs, each once) that are
# published in the help center when they are chosen. Answers unpublished later are left out on Home.
class Setting::Validation::StudenthubMobilePopularAnswers < Setting::Validation::Base
  def run
    return result_failed(__('The popular answers must be a list of answers.')) if !value.is_a?(Array) || !value.all?(Integer)
    if value.size > Studenthub::MobileApp::MAX_POPULAR_ANSWERS
      return result_failed(format(__('There can be at most %s popular answers.'), Studenthub::MobileApp::MAX_POPULAR_ANSWERS))
    end
    return result_failed(__('Each popular answer can be chosen only once.')) if value.uniq.size != value.size
    return result_failed(__('Only answers published in the help center can be chosen.')) if !all_published?

    result_success
  end

  private

  def all_published?
    published = Studenthub::MobileApp::PopularAnswers.choices.pluck(:id)
    (value - published).empty?
  end
end
