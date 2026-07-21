class App.ControllerDashboardStatsBase extends App.Controller
  constructor: ->
    super
    App.StatsStore.bind('refresh change create update', @load)
    @load()

  load: =>
    stats_store = App.StatsStore.first()
    if stats_store
      @render(stats_store.data)
    else
      @render()
