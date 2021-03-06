'use strict'

var path = require('path')
var helper = require('../../lib/agent_helper.js')
var http = require('http')
var NAMES = require('../../../lib/metrics/names.js')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics
var assertSegments = require('../../lib/metrics_helper').assertSegments

var test = require('tap').test

var express
var agent
var app

var assertSegmentsOptions = {
  exact: true,
  // in Node 8 the http module sometimes creates a setTimeout segment
  exclude: [
    'timers.setTimeout',
    'Truncated/timers.setTimeout'
  ]
}


test('first two segments are built-in Express middlewares', function(t) {
  setup(t)

  app.all('/test', function(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    // TODO: check for different HTTP methods
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /test',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ])

    t.end()
  })
})

test('middleware with child segment gets named correctly', function(t) {
  setup(t)

  app.all('/test', function(req, res) {
    setTimeout(function() {
      res.end()
    }, 1)
  })

  runTest(t, function(segments, transaction) {
    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ])

    t.end()
  })
})

test('segments for route handler', function(t) {
  setup(t)

  app.all('/test', function(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /test',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ])

    t.end()
  })
})

test('route function names are in segment names', function(t) {
  setup(t)

  app.all('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /test',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'
    ])

    t.end()
  })
})

test('each handler in route has its own segment', function(t) {
  setup(t)

  app.all('/test', function handler1(req, res, next) {
    next()
  }, function handler2(req, res, next) {
    res.send()
  })

  runTest(t, function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /test',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'handler1',
        NAMES.EXPRESS.MIDDLEWARE + 'handler2'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'handler1//test',
      NAMES.EXPRESS.MIDDLEWARE + 'handler2//test'
    ])

    t.end()
  })
})

test('segments for routers', function(t) {
  setup(t)

  var router = express.Router()
  router.all('/test', function(req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Router: /router1',
      [
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//router1/test'
    ], '/router1/test')

    t.end()
  })
})


test('two root routers', function(t) {
  setup(t)

  var router1 = express.Router()
  router1.all('/', function(req, res) {
    res.end()
  })
  app.use('/', router1)

  var router2 = express.Router()
  router2.all('/test', function(req, res) {
    res.end()
  })
  app.use('/', router2)

  runTest(t, '/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Router: /',
      'Expressjs/Router: /',
      [
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test'
    ], '/test')

    t.end()
  })
})

test('router mounted as a route handler', function(t) {
  setup(t)

  var router1 = express.Router()
  router1.all('/test', function testHandler(req, res) {
    res.send('test')
  })

  app.get('*', router1)

  runTest(t, '/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: *',
      [
        'Expressjs/Router: /',
        [
          'Expressjs/Route Path: /test',
          [
            NAMES.EXPRESS.MIDDLEWARE + 'testHandler'
          ]
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'testHandler//*/test'
    ], '/*/test')

    t.end()
  })
})

test('segments for routers', function(t) {
  setup(t)

  var router = express.Router()
  router.all('/test', function(req, res) {
    res.end()
  })

  app.use('/router1', router)

  runTest(t, '/router1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Router: /router1',
      [
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//router1/test'
    ], '/router1/test')

    t.end()
  })
})

test('segments for sub-app', function(t) {
  setup(t)

  var subapp = express()
  subapp.all('/test', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Mounted App: /subapp1',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/test')

    t.end()
  })
})

test('segments for sub-app', function(t) {
  setup(t)

  var subapp = express()
  subapp.get('/test', function(req, res, next) {
    next()
  }, function(req, res, next) {
    next()
  })
  subapp.get('/test', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Mounted App: /subapp1',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous',
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ],
        'Expressjs/Route Path: /test',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/test')

    t.end()
  })
})

test('segments for wildcard', function(t) {
  setup(t)

  var subapp = express()
  subapp.all('/:app', function(req, res) {
    res.end()
  })

  app.use('/subapp1', subapp)

  runTest(t, '/subapp1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Mounted App: /subapp1',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'query',
        NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
        'Expressjs/Route Path: /:app',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'anonymous',
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//subapp1/:app',
      NAMES.EXPRESS.MIDDLEWARE + 'query//subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//subapp1'
    ], '/subapp1/:app')

    t.end()
  })
})

test('router with subapp', function(t) {
  setup(t)

  var router = express.Router()
  var subapp = express()
  subapp.all('/test', function(req, res) {
    res.end()
  })
  router.use('/subapp1', subapp)
  app.use('/router1', router)

  runTest(t, '/router1/subapp1/test', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Router: /router1',
      [
        'Expressjs/Mounted App: /subapp1',
        [
          NAMES.EXPRESS.MIDDLEWARE + 'query',
          NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
          'Expressjs/Route Path: /test',
          [
            NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
          ]
        ]
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//router1/subapp1/test',
      NAMES.EXPRESS.MIDDLEWARE + 'query//router1/subapp1',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit//router1/subapp1'
    ], '/router1/subapp1/test')

    t.end()
  })
})

test('mounted middleware', function(t) {
  setup(t)

  app.use('/test', function myHandler(req, res) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      // TODO: should have the path?
      // NAMES.EXPRESS.MIDDLEWARE + 'myHandler /test',
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler',
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//test'
    ])

    t.end()
  })
})

test('error middleware', function(t) {
  setup(t)

  app.get('/test', function(req, res) {
    throw new Error('some error')
  })

  app.use(function myErrorHandler(err, req, res, next) {
    res.end()
  })

  runTest(t, function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /test',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'anonymous'
      ],
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'anonymous//test',
      NAMES.EXPRESS.MIDDLEWARE + 'myErrorHandler'
    ])

    t.end()
  })
})

test('when using a route variable', function(t) {
  setup(t)

  app.get('/:foo/:bar', function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a/b', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /:foo/:bar',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//:foo/:bar'
    ], '/:foo/:bar')

    t.end()
  })
})

test('when using a string pattern in path', function(t) {
  setup(t)

  app.get('/ab?cd', function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/abcd', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /ab?cd',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//ab?cd'
    ], '/ab?cd')

    t.end()
  })
})

test('when using a regular expression in path', function(t) {
  setup(t)

  app.get(/a/, function myHandler(req, res) {
    res.end()
  })

  runTest(t, '/a', function(segments, transaction) {
    assertSegments(transaction.trace.root.children[0], [
      NAMES.EXPRESS.MIDDLEWARE + 'query',
      NAMES.EXPRESS.MIDDLEWARE + 'expressInit',
      'Expressjs/Route Path: /a/',
      [
        NAMES.EXPRESS.MIDDLEWARE + 'myHandler'
      ]
    ], assertSegmentsOptions)

    checkMetrics(t, transaction.metrics, [
      NAMES.EXPRESS.MIDDLEWARE + 'myHandler//a/'
    ], '/a/')

    t.end()
  })
})

function setup(t) {
  agent = helper.instrumentMockedAgent({
    express_segments: true
  })
  express = require('express')
  app = express()
  t.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })
}

function runTest(t, endpoint, callback) {
  var statusCode
  var errors

  if (endpoint instanceof Function) {
    callback = endpoint
    endpoint = '/test'
  }

  agent.on('transactionFinished', function(tx) {
    var webSegment = tx.trace.root.children[0]
    t.equal(0, agent.errors.getTotalErrorCount(), 'there were no errors')
    callback(webSegment.children, tx)
  })

  var server = app.listen(function(){
    makeRequest(server, endpoint, function(response) {
      response.resume()
    })
  })

  t.tearDown(function cb_tearDown() {
    server.close()
  })
}

function makeRequest(server, path, callback) {
  var port = server.address().port
  http.request({port: port, path: path}, callback).end()
}

function checkMetrics(test, metrics, expected, path) {
  if (path === undefined) {
    path = '/test'
  }
  var expectedAll = [
    [{name  : 'WebTransaction'}],
    [{name  : 'WebTransactionTotalTime'}],
    [{name  : 'HttpDispatcher'}],
    [{name  : 'WebTransaction/Expressjs/GET/' + path}],
    [{name  : 'WebTransactionTotalTime/Expressjs/GET/' + path}],
    [{name  : 'Apdex/Expressjs/GET/' + path}],
    [{name  : 'Apdex'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'query//'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'expressInit//'}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'query//',
      scope: 'WebTransaction/Expressjs/GET/' + path}],
    [{name  : NAMES.EXPRESS.MIDDLEWARE + 'expressInit//',
      scope: 'WebTransaction/Expressjs/GET/' + path}],
  ]

  for (var i = 0; i < expected.length; i++) {
    var metric = expected[i]
    expectedAll.push([{name: metric}])
    expectedAll.push([{name: metric, scope: 'WebTransaction/Expressjs/GET/' + path}])
  }

  assertMetrics(metrics, expectedAll, true, false)
}
