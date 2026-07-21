class App.Dashboard extends App.Controller
  clueAccess: true
  events:
    'click .ad-tab': 'toggle'
    'click .tabs .tab': 'toggle'
    'click .js-intro': 'clues'
    'mouseenter .ad-bar-group': 'showBarTooltip'
    'mouseleave .ad-bar-group': 'hideBarTooltip'
    'mouseenter .js-point': 'showLineTooltip'
    'mouseleave .js-point': 'hideLineTooltip'
    'click .ad-chart-pill': 'togglePeriod'
    'click .ad-legend-item': 'toggleLegendSeries'
    'click .js-toggle-activity-stream': 'toggleActivityStream'

  constructor: ->
    super

    if !@permissionCheck('ticket.agent')
      @clueAccess = false
      return

    # render page
    @render()

    # rerender view, e. g. on language change
    @controllerBind('ui:rerender', =>
      return if !@authenticateCheck()
      @render()
    )

    @mayBeClues()

  render: ->

    localEl = $( App.view('dashboard')(
      head:    __('Dashboard')
      isAdmin: @permissionCheck('admin')
    ) )

    new App.DashboardStats(
      el: localEl.find('.ad-grid')
    )

    new App.DashboardActivityStream(
      el:    localEl.find('.js-activityContent')
      limit: 25
    )

    new App.DashboardFirstSteps(
      el: localEl.find('.first-steps-widgets')
    )

    @html localEl

  mayBeClues: =>
    return if @Config.get('after_auth')
    return if !@clueAccess
    return if !@shown
    return if @Config.get('switch_back_to_possible')
    preferences = @Session.get('preferences')
    @clueAccess = false

    # If the initial clue has been already completed by the user, show the rest of the clues.
    if preferences['intro']
      for clue in _.sortBy(App.Config.get('Clues'), 'prio')
        continue if preferences[clue.preference_key] # skip already completed clues
        continue if clue.config_key and not App.Config.get(clue.config_key) # skip clues about inactive features
        continue if clue.permission and not _.every(clue.permission, (permission) -> App.User.current()?.permission(permission)) # skip clues without required permissions

        new clue.controller(
          appEl: @appEl
          onComplete: =>
            App.Ajax.request(
              id:          'preferences'
              type:        'PUT'
              url:         "#{@apiPath}/users/preferences"
              data:        JSON.stringify("#{clue.preference_key}": true)
              processData: true
            )
        )

        return # show only one clue at a time

      return

    @clues()

  clues: (e) =>
    @clueAccess = false
    if e
      e.preventDefault()

    # Initial clue has its own controller, so it can be triggered via a route change later.
    @navigate '#clues'

  active: (state) =>
    return @shown if state is undefined
    @shown = state
    if state
      @mayBeClues()

  url: ->
    '#dashboard'

  show: (params) =>
    if @permissionCheck('ticket.agent')
      @title __('Dashboard')
      @navupdate '#dashboard'
    # in case of being only customer, redirect to default router
    else if @permissionCheck('ticket.customer')
      @navigate '#ticket/view', { hideCurrentLocationFromHistory: true }
    # in case of being only admin, redirect to admin interface (show no empty white content page)
    else if @permissionCheck('admin')
      @navigate '#manage', { hideCurrentLocationFromHistory: true }
    # fallback for user who is neither admin nor customer
    else
      @navigate '#welcome', { hideCurrentLocationFromHistory: true }

  changed: ->
    false

  toggle: (e) =>
    $tab = $(e.currentTarget)
    @$('.ad-tab, .tabs .tab').removeClass('active')
    $tab.addClass('active')
    target = $tab.data('area')
    if target is 'stat-widgets'
      @$('.stat-widgets, .ad-grid, .ad-charts-row').removeClass('hidden')
      @$('.first-steps-widgets').addClass('hidden')
    else
      @$('.stat-widgets, .ad-grid, .ad-charts-row').addClass('hidden')
      @$('.first-steps-widgets').removeClass('hidden')

  showBarTooltip: (e) ->
    $bar = $(e.currentTarget)
    $card = $bar.closest('.ad-chart-card')
    $tooltip = $card.find('.js-bar-tooltip')
    date = $bar.data('date')
    high = $bar.data('high') || $bar.data('rev')
    normal = $bar.data('normal') || $bar.data('exp')
    $card.find('.js-bar-date').text(date)
    $card.find('.js-bar-val-high').text(high)
    $card.find('.js-bar-val-normal').text(normal)

    pos = $bar.position()
    $tooltip.css(left: "#{pos.left - 35}px", top: "#{pos.top - 65}px").removeClass('hidden')

  hideBarTooltip: (e) =>
    @$('.js-bar-tooltip').addClass('hidden')

  showLineTooltip: (e) ->
    $point = $(e.currentTarget)
    $card = $point.closest('.ad-chart-card')
    $tooltip = $card.find('.js-line-tooltip')
    $line = $card.find('.js-hover-line')

    date = $point.data('date')
    opened = $point.data('opened') || $point.data('growth')
    closed = $point.data('closed') || $point.data('active')
    cx = parseFloat($point.attr('cx'))
    cy = parseFloat($point.attr('cy'))

    $card.find('.ad-tooltip-date').text(date)
    $card.find('.js-val-opened').text(opened)
    $card.find('.js-val-closed').text(closed)

    $card.find('.js-point').removeClass('active')
    $point.addClass('active')

    $line.attr('x1', cx).attr('x2', cx).removeClass('hidden')

    svgWidth = 500
    leftPct = (cx / svgWidth) * 100
    $tooltip.css(left: "#{leftPct}%", top: "#{cy - 55}px").removeClass('hidden')

  hideLineTooltip: (e) =>
    @$('.js-line-tooltip').addClass('hidden')
    @$('.js-hover-line').addClass('hidden')

  togglePeriod: (e) ->
    $pill = $(e.currentTarget)
    $pill.siblings().removeClass('active')
    $pill.addClass('active')
    period = $pill.data('period')

    $card = $pill.closest('.ad-chart-card')
    # coffeelint: disable=detect_translatable_string
    # SVG path geometry, not user-facing text.
    if period is '90d'
      $card.find('.js-path-growth').attr('d', 'M0,160 Q60,140 120,110 T240,75 T360,50 T480,20')
      $card.find('.js-path-growth-area').attr('d', 'M0,160 Q60,140 120,110 T240,75 T360,50 T480,20 L480,180 L0,180 Z')
    else
      $card.find('.js-path-growth').attr('d', 'M0,150 Q60,110 120,80 T240,45 T360,20 T480,30')
      $card.find('.js-path-growth-area').attr('d', 'M0,150 Q60,110 120,80 T240,45 T360,20 T480,30 L480,180 L0,180 Z')
    # coffeelint: enable=detect_translatable_string

  toggleLegendSeries: (e) ->
    $item = $(e.currentTarget)
    $item.toggleClass('is-dimmed')
    series = $item.data('series')
    $card = $item.closest('.ad-chart-card')
    if series is 'opened' or series is 'growth'
      $card.find('.js-path-growth, .js-path-growth-area').toggleClass('ad-dimmed')
    else if series is 'closed' or series is 'active'
      $card.find('.js-path-active').toggleClass('ad-dimmed')
    else if series is 'high' or series is 'revenue'
      $card.find('.ad-bar-top').toggleClass('ad-dimmed')
    else if series is 'normal' or series is 'expense'
      $card.find('.ad-bar-bottom').toggleClass('ad-dimmed')

  toggleActivityStream: (e) =>
    e?.preventDefault()
    $btn = @$('.js-toggle-activity-stream.ad-bell-toggle-btn')
    $sidebar = $('.sidebar.optional, .js-activity-sidebar')
    $sidebar.toggleClass('is-collapsed')
    $btn.toggleClass('active')
    if $sidebar.hasClass('is-collapsed')
      $btn.find('.ad-bell-label').text(__('Feed Closed'))
    else
      $btn.find('.ad-bell-label').text(__('Activity Feed'))

class DashboardRouter extends App.ControllerPermanent
  @requiredPermission: ['*']

  constructor: (params) ->
    super

    # check authentication
    @authenticateCheckRedirect()

    App.TaskManager.execute(
      key:        'Dashboard'
      controller: 'Dashboard'
      params:     {}
      show:       true
      persistent: true
    )

App.Config.set('dashboard', DashboardRouter, 'Routes')
App.Config.set('Dashboard', { controller: 'Dashboard', permission: ['*'] }, 'permanentTask')
App.Config.set('Dashboard', { prio: 100, parent: '', name: __('Dashboard'), target: '#dashboard', key: 'Dashboard', permission: ['ticket.agent'], class: 'dashboard' }, 'NavBar')
