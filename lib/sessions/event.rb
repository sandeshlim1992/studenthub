# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Sessions::Event
  include ApplicationLib

  def self.run(params)
    begin
      backend = "Sessions::Event::#{params[:event].to_classname}".constantize
      # Student Hub: only session events, not any class the name resolves to.
      raise NameError, "#{backend} is not a session event" if !(backend.is_a?(Class) && backend < Sessions::Event::Base)
    rescue => e
      Rails.logger.error e.inspect
      Rails.logger.error e.backtrace
      return { event: 'error', data: { error: "No such event #{params[:event]}: #{e.inspect}", payload: params[:payload] } }
    end

    begin
      instance = backend.new(params)
      result = instance.run
      instance.destroy
      result
    rescue => e
      Rails.logger.error e.inspect
      Rails.logger.error e.backtrace
      { event: 'error', data: { error: e.message, payload: params[:payload] } }
    end
  ensure
    UserInfo.current_user_id = nil
    ActiveSupport::CurrentAttributes.clear_all
  end
end
