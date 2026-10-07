# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: reading the Knowledge Base in the new UI. Creating, editing, publishing and deleting
# use Zammad's Knowledge Base API (/api/v1/knowledge_bases/...), like the classic UI.
class StudenthubKnowledgeBaseController < ApplicationController
  prepend_before_action :authenticate_and_authorize!

  # GET /api/v1/studenthub/knowledge_base
  def index
    render json: Service::StudenthubKnowledgeBase::Tree.execute(user: current_user)
  end

  # GET /api/v1/studenthub/knowledge_base/search?query=...&limit=10
  def search
    render json: Service::StudenthubKnowledgeBase::Search.execute(user: current_user, query: params[:query], limit: params[:limit] || 10)
  end

  # GET /api/v1/studenthub/knowledge_base/answers/:id
  def answer
    answer = KnowledgeBase::Answer.find(params[:id])
    raise Exceptions::Forbidden, __('Not authorized') if !KnowledgeBase::AnswerPolicy.new(current_user, answer).show?

    render json: Service::StudenthubKnowledgeBase::AnswerDetail.execute(user: current_user, answer:)
  end
end
