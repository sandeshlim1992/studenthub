# Student Hub: shows the customer's feedback rating on closed tickets (Feedback Collection), to admins.
class SidebarStudenthubFeedback extends App.Controller
  constructor: ->
    super
    @controllerBind('ui::ticket::load', (data) =>
      return if data.ticket_id.toString() isnt @ticket.id.toString()
      return if !@el
      @showObjects(@el)
    )

  sidebarItem: =>
    return if !@permissionCheck('admin.feedback_collection')
    return if !@ticketClosed()
    @item = {
      name: 'studenthub-feedback'
      badgeIcon: 'mood-good'
      sidebarHead: __('Customer feedback')
      sidebarCallback: @showObjects
      sidebarActions: []
    }
    @item

  ticketClosed: =>
    state = App.TicketState.find(@ticket.state_id)
    return false if !state
    stateType = App.TicketStateType.find(state.state_type_id)
    stateType?.name is 'closed'

  showObjects: (el) =>
    @el = el
    @el.html(App.view('ticket_zoom/sidebar_studenthub_feedback')(loading: true, items: []))

    @ajax(
      id:    "studenthub_feedback_#{@ticket.id}"
      type:  'GET'
      url:   "#{@apiPath}/feedback_collection/tickets/#{@ticket.id}"
      success: (data) =>
        @el.html(App.view('ticket_zoom/sidebar_studenthub_feedback')(loading: false, items: data.items || []))
      error: =>
        @el.html(App.view('ticket_zoom/sidebar_studenthub_feedback')(loading: false, items: [], failed: true))
    )

App.Config.set('950-StudenthubFeedback', SidebarStudenthubFeedback, 'TicketZoomSidebar')
