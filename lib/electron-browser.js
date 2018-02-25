var chalk = require('chalk')
var spawn = require('child_process').spawn
var path = require('path')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Split = require('split2')
var AbstractBrowser = require('./abstract-browser')

function Electron (opt) {
  if (!(this instanceof Electron)) {
    return new Electron(opt)
  }

  AbstractBrowser.call(this, Object.assign({}, opt, {
    name: 'electron',
    version: null // TODO
  }))
}

inherits(Electron, AbstractBrowser)

Electron.prototype._start = function (url, callback) {
  var self = this

  var binpath
  try {
    binpath = require('electron-prebuilt')
  } catch (err) {
    binpath = require('electron')
  }

  self.debug('url %s', url)

  var reporter = new EventEmitter()

  reporter.on('console', function (msg) {
    console.log.apply(console, msg.args)
  })

  reporter.on('test', function (test) {
    console.log(chalk`starting {white ${test.name}}`)
  })

  reporter.on('test_end', function (test) {
    if (!test.passed) {
      console.log(chalk`failed {red ${test.name}}`)
      return self.stats.failed++
    }

    console.log('passed:', test.name.green)
    self.stats.passed++
  })

  reporter.on('assertion', function (assertion) {
    console.log(chalk`{red Error: ${assertion.message}}`)
    assertion.frames.forEach(function (frame) {
      console.log(chalk`{gray ${frame.func} ${frame.filename}:${frame.line}}`)
    })
    console.log()
  })

  reporter.on('done', function () {
    reporter.removeAllListeners()
  })

  self.emit('init', url)
  self.emit('start', reporter)

  var args = [path.join(__dirname, 'electron-run.js'), url]
  var cp = spawn(binpath, args)
  var split = Split()

  split.on('data', function (line) {
    if (line === '') return

    var msg
    try {
      msg = JSON.parse(line)
    } catch (err) {
      // TODO: kill child process?
      return callback(new Error('failed to parse json: ' + line))
    }

    self.debug('msg: %j', msg)
    reporter.emit(msg.type, msg)
  })

  cp.stdout.setEncoding('utf8')
  cp.stdout.pipe(split)

  cp.stderr.on('data', function (data) {
    if (/INFO:CONSOLE/.test(data)) return
    self.debug(chalk`Electron stderr: {red ${data}}`)
  })

  cp.on('close', function (code) {
    // TODO: check exit code
    callback()
  })
}

module.exports = Electron