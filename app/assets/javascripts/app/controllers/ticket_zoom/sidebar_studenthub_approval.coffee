# Student Hub: "Approval" tab in the ticket sidebar (Ticket Approvals).
# Agents send the ticket to a manager; the manager approves or denies it here.
class SidebarStudenthubApproval extends App.Controller
  constructor: ->
    super
    @controllerBind('ui::ticket::load', (data) =>
      return if data.ticket_id.toString() isnt @ticket.id.toString()
      return if !@el
      @load()
    )

  sidebarItem: =>
    return if !@Config.get('ticket_approval')
    return if !@permissionCheck('ticket.agent')
    @item = {
      name: 'studenthub-approval'
      badgeIcon: 'checkmark'
      sidebarHead: __('Approval')
      sidebarCallback: @showObjects
      sidebarActions: []
    }
    @item

  showObjects: (el) =>
    @el = el
    @render(loading: true)
    @load()

  url: =>
    "#{@apiPath}/tickets/#{@ticket.id}/approval"

  load: =>
    @ajax(
      id:      "studenthub_approval_#{@ticket.id}"
      type:    'GET'
      url:     @url()
      success: (data) => @render(status: data)
      error:   (xhr) => @render(error: @errorText(xhr))
    )

  render: (params = {}) =>
    @status = params.status if params.status
    @el.html(App.view('ticket_zoom/sidebar_studenthub_approval')(
      loading:  params.loading
      status:   @status
      error:    params.error
      ticketId: @ticket.id
    ))
    @el.find('.js-approvalRequest').on('submit', @request)
    @el.find('.js-approvalApprove').on('click', @approve)
    @el.find('.js-approvalDeny').on('click', @deny)
    @el.find('.js-approvalCancel').on('click', @cancel)

  send: (type, path, data) =>
    @el.find('button').prop('disabled', true)
    @ajax(
      id:          "studenthub_approval_#{@ticket.id}_#{type}"
      type:        type
      url:         "#{@url()}#{path}"
      data:        JSON.stringify(data || {})
      processData: true
      success:     (data) => @render(status: data)
      error:       (xhr) =>
        @render(error: @errorText(xhr))
    )

  request: (e) =>
    e.preventDefault()
    params = @formParam(e.target)
    @send('POST', '', approver_id: params.approver_id, reason: params.reason)

  approve: (e) =>
    e.preventDefault()
    @send('POST', '/approve', comment: @el.find('[name=comment]').val())

  deny: (e) =>
    e.preventDefault()
    @send('POST', '/deny', comment: @el.find('[name=comment]').val())

  cancel: (e) =>
    e.preventDefault()
    new App.ControllerConfirm(
      message:     __('Withdraw this approval request?')
      buttonClass: 'btn--danger'
      buttonSubmit: __('Withdraw')
      callback:    => @send('DELETE', '')
      container:   @el.closest('.content')
    )

  errorText: (xhr) ->
    try
      JSON.parse(xhr.responseText).error || __('Something went wrong.')
    catch
      __('Something went wrong.')

App.Config.set('960-StudenthubApproval', SidebarStudenthubApproval, 'TicketZoomSidebar')
