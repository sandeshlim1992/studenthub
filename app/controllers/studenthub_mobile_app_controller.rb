# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the mobile app's popular answers (Studenthub::MobileApp::PopularAnswers). Admins
# choose them through Zammad's settings API; these list what can be chosen and what Home shows.
class StudenthubMobileAppController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/mobile_app/answer_choices
  def answer_choices
    render json: Studenthub::MobileApp::PopularAnswers.choices
  end

  # GET /api/v1/studenthub/mobile_app/popular_answers
  def popular_answers
    render json: Studenthub::MobileApp::PopularAnswers.for(current_user)
  end
end
