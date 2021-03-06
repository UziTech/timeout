/*!
 * connect-timeout
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var createError = require('http-errors')
var ms = require('ms')
var onFinished = require('on-finished')
var onHeaders = require('on-headers')

/**
 * Module exports.
 * @public
 */

module.exports = timeout

/**
 * Create a new timeout middleware.
 *
 * @param {number|string} [time=5000] The timeout as a number of milliseconds or a string for `ms`
 * @param {object} [options] Additional options for middleware
 * @param {boolean} [options.respond=true] Automatically emit error when timeout reached
 * @return {function} middleware
 * @public
 */

function timeout (time, options) {
  var opts = options || {}

  var defaultDelay = typeof time === 'string'
    ? ms(time)
    : Number(time || 5000)

  var respond = opts.respond === undefined || opts.respond === true

  return function (req, res, next) {
    var requestDelay = defaultDelay
    var started = Date.now()
    var id = createTimeout(req, requestDelay)

    if (respond) {
      req.on('timeout', function () {
        next(createError(503, 'Response timeout', {
          code: 'ETIMEDOUT',
          timeout: requestDelay
        }))
      })
    }

    req.clearTimeout = function () {
      requestDelay = 0
      clearTimeout(id)
    }

    req.resetTimeout = function (newDelay) {
      newDelay = typeof newDelay === 'string'
        ? ms(newDelay)
        : Number(newDelay || 5000)
      started = Date.now()
      requestDelay = newDelay
      clearTimeout(id)
      id = createTimeout(req, requestDelay)
    }

    req.addTimeout = function (moreDelay) {
      moreDelay = typeof moreDelay === 'string'
        ? ms(moreDelay)
        : Number(moreDelay || 5000)
      var timeLeft = req.getTimeout()
      var actualDelay = timeLeft + moreDelay
      requestDelay = requestDelay + moreDelay
      if (timeLeft === 0) {
        started = Date.now() + actualDelay - requestDelay
      }
      clearTimeout(id)
      id = createTimeout(req, actualDelay)
    }

    req.getTimeout = function () {
      var time = requestDelay - (Date.now() - started)
      return (time > 0 ? time : 0)
    }

    req.timedout = false

    onFinished(res, function () {
      clearTimeout(id)
    })

    onHeaders(res, function () {
      clearTimeout(id)
    })

    next()
  }
}

/**
 * Create timeout.
 *
 * @param {stream} req
 * @param {number} requestDelay
 * @private
 */
function createTimeout (req, requestDelay) {
  return setTimeout(function () {
    req.timedout = true
    req.emit('timeout', requestDelay)
  }, requestDelay)
}
