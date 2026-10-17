# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the mobile app's popular answers (Studenthub::MobileApp::PopularAnswers) and its
# Knowledge Base (Studenthub::MobileApp::KnowledgeBase). Admins choose the popular answers through
# Zammad's settings API; these list what can be chosen and what Home shows.
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

  # GET /api/v1/studenthub/mobile_app/knowledge_base
  # GET /api/v1/studenthub/mobile_app/knowledge_base/categories/:id
  def knowledge_base_topic
    category = params[:id] && published_category
    topic    = Studenthub::MobileApp::KnowledgeBase.topic(current_user, category)
    raise ActiveRecord::RecordNotFound if !topic

    render json: topic
  end

  # GET /api/v1/studenthub/mobile_app/knowledge_base/answers/:id
  def knowledge_base_answer
    render json: Studenthub::MobileApp::KnowledgeBase.answer(current_user, published_answer)
  end

  # GET /api/v1/studenthub/mobile_app/knowledge_base/search?query=...
  def knowledge_base_search
    render json: Studenthub::MobileApp::KnowledgeBase.search(current_user, params[:query])
  end

  # PUT /api/v1/studenthub/mobile_app/knowledge_base/answers/:id/feedback, { helpful: true | false }
  def knowledge_base_feedback
    helpful = params[:helpful]
    raise Exceptions::UnprocessableContent, __('Say whether the answer helped.') if [true, false].exclude?(helpful)

    feedback = StudenthubAnswerFeedback.vote!(answer: published_answer, user: current_user, helpful:)
    render json: { helpful: feedback.helpful }
  end

  private

  def published_answer
    Studenthub::MobileApp::KnowledgeBase.published_answers.find(params[:id]).tap { |answer| authorize!(answer, :show?) }
  end

  def published_category
    KnowledgeBase::Category.find(params[:id]).tap { |category| authorize!(category, :show_public?) }
  end
end
