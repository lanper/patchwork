var combine = require('depject')
var Modules = require('patchbay/modules')
var SbotApi = require('./api')
var extend = require('xtend')
var h = require('./lib/h')
var plugs = require('patchbay/plugs')
var Value = require('@mmckegg/mutant/value')
var when = require('@mmckegg/mutant/when')
var computed = require('@mmckegg/mutant/computed')
var toCollection = require('@mmckegg/mutant/dict-to-collection')
var MutantDict = require('@mmckegg/mutant/dict')
var MutantMap = require('@mmckegg/mutant/map')
var watch = require('@mmckegg/mutant/watch')

module.exports = function (config, ssbClient) {
  var api = SbotApi(ssbClient, config)
  var modules = combine(extend(Modules, {
    'sbot-api.js': api,
    'public.js': require('./views/public-feed.js'),
    'blob-url.js': {
      blob_url: function (link) {
        var prefix = config.blobsPrefix != null ? config.blobsPrefix : `http://localhost:${config.blobsPort}`
        if (typeof link.link === 'string') {
          link = link.link
        }
        return `${prefix}/${encodeURIComponent(link)}`
      }
    }
  }))

  var screenView = plugs.first(modules.plugs.screen_view)
  var forwardHistory = []
  var backHistory = []
  var views = MutantDict({
    '/public': screenView('/public')
  })

  var canGoForward = Value(false)
  var canGoBack = Value(false)
  var currentView = Value('/public')

  watch(currentView, (view) => {
    window.location.hash = `#${view}`
  })

  window.onhashchange = function (ev) {
    var path = window.location.hash.substring(1)
    if (path) {
      setView(path)
    }
  }

  var mainElement = h('div.main', MutantMap(toCollection(views), (item) => {
    return h('div.view', {
      hidden: computed([item.key, currentView], (a, b) => a !== b)
    }, [ item.value ])
  }))

  return h('MainWindow', {
    classList: [ '-' + process.platform ]
  }, [
    h('div.top', [
      h('span.history', [
        h('a', {
          'ev-click': goBack,
          classList: [ when(canGoBack, '-active') ]
        }, '<'),
        h('a', {
          'ev-click': goForward,
          classList: [ when(canGoForward, '-active') ]
        }, '>')
      ]),
      h('span.nav', [
        h('a', {
          href: '#/public',
          classList: [
            when(selected('/public'), '-selected')
          ]
        }, 'Feed'),
        h('a', {
          href: '#/private',
          classList: [
            when(selected('/private'), '-selected')
          ]
        }, 'Private')
      ]),
      h('span.appTitle', ['Patchwork']),
      h('span.nav', [
        h('a', {
          href: `#${ssbClient.id}`,
          classList: [
            when(selected(`${ssbClient.id}`), '-selected')
          ]
        }, 'Profile')
      ])
    ]),
    mainElement
  ])

  // scoped

  function goBack () {
    if (backHistory.length) {
      canGoForward.set(true)
      forwardHistory.push(currentView())
      currentView.set(backHistory.pop())
      canGoBack.set(backHistory.length > 0)
    }
  }

  function goForward () {
    if (forwardHistory.length) {
      backHistory.push(currentView())
      currentView.set(forwardHistory.pop())
      canGoForward.set(forwardHistory.length > 0)
      canGoBack.set(true)
    }
  }

  function setView (view) {
    if (!views.has(view)) {
      views.put(view, screenView(view))
    }
    if (view !== currentView()) {
      canGoForward.set(false)
      canGoBack.set(true)
      forwardHistory.length = 0
      backHistory.push(currentView())
      currentView.set(view)
    }
  }

  function selected (view) {
    return computed([currentView, view], (currentView, view) => {
      return currentView === view
    })
  }
}

function isSame (a, b) {
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false
      }
    }
    return true
  } else if (a === b) {
    return true
  }
}