const express = require('express');
const path = require('path');
const isFunction = require('lodash/isFunction');
const codes = require('http').STATUS_CODES;
const { Kubik, helpers } = require('rubik-main');

/**
 * HTTP server for Rubik
 * @namespace Rubik
 * @class HTTP
 * @extends Kubik
 * @prop {Express}           server    server
 * @prop {Array}             volumes   for search routes and middlewares
 * @prop {Rubik.Log|null}    log       logger — sets when up
 * @prop {Rubik.Config|null} config    config — with get('http') sets when up
 * @prop {Boolean}           autoStart start or not
 */
class HTTP extends Kubik {
  constructor(defaultVolume) {
    super();
    this.name = 'http';
    this.dependencies = ['config', 'log'];
    if (this.CREATE_HTTP_APP) this.httpApp = express();
    else this.httpApp = null;
    this.volumes = [];
    this.autoStart = true;
    // for other kubiks
    this.log = null;
    this.config = null;

    if (typeof defaultVolume === 'string') {
      this.volumes = [defaultVolume];
    } else if (Array.isArray(defaultVolume)) {
      this.volumes = defaultVolume;
    }

    this.servers = new Set();
    // binds
    this._catch = this._catch.bind(this);
  }

  /**
   * apply a middleware
   * @param  {Function|Object} middleware
   * @return {Rubik.HTTP}      this
   */
  applyMiddleware(middleware) {
    if (middleware.name && middleware.router) {
      this.httpApp.use(middleware.name, middleware.router);
    }
    if (!isFunction(middleware)) return this;
    this.httpApp.use(middleware);
    return this;
  }

  /**
   * apply list of middlewares or routes
   * @param  {Array<Function|Object>} middlewares
   * @return {Rubik.HTTP}             this
   */
  applyMiddlewares(middlewares) {
    for (const middleware of middlewares) {
      this.applyMiddleware(middleware);
    }
    return this;
  }

  /**
   * scan volumes and apply middlewares
   * @return {Promise}
   */
  async _scan() {
    if (!this.volumes.length) return;
    for (const volume of this.volumes) {
      await helpers.readdir(volume, (file) => {
        const filePath = path.join(volume, file);
        this.applyMiddleware(require(filePath));
      });
    }
  }


  /**
   * apply extensions to HTTP
   * @return {Rubik.HTTP} this
   */
  _applyExtensions() {
    if (!this.extensions.length)  return;
    for (const extension of this.extensions) {
      if (isFunction(extension)){
        this.httpApp.use(extension);
        continue;
      }
      if (Array.isArray(extension.middlewares)) {
        this.applyMiddlewares(extension.middlewares);
      }
      if (Array.isArray(extension.volumes)) {
        this.volumes = this.volumes.concat(extension.volumes);
      }
    }
    this.extensions = [];
    return this;
  }

  /**
   * up HTTP kubik, set extension middlewares and init routes
   * @param  {Rubik.Config}  config
   * @param  {Rubik.Log}     log
   * @return {Promise}
   */
  async up({ config, log }) {
    this.config = config.get('http');
    this.log = log;
    if (!this.config) throw new TypeError('Config field http is not defined');
    this.httpApp.use((req, res, next) => {
      req.rubik = this.app;
      next();
    });
    await this.applyHooks('before');
    this._applyExtensions();
    await this._scan();
  }

  /**
   * catch error as default — middleware
   * @param  {Error}            err  error
   * @param  {express.Request}  req  request
   * @param  {express.Response} res  response
   * @param  {Function}         next what is next?
   */
  _defaultCatcher(err, req, res, next) {
    if (err.constructor.name === 'HttpError') {
      res.status(err.code);
      return res.json({
        error: err.message,
        code: err.code,
        message: err.statusMessage
      });
    } else if (err.constructor.name === 'SystemError') {
      res.status(err.code);
      return res.json({
        error: err.message,
        code: err.code,
        message: codes[err.code] || 'Strange code'
      });
    } else {
      res.status(500);
      res.json({
        error: err.message,
        code: 500,
        message: 'Internal server error'
      });
    }
    next(err);
  }

  /**
   * catch error — middleware
   * @param  {Error}            err  error
   * @param  {express.Request}  req  request
   * @param  {express.Response} res  response
   * @param  {Function}         next what is next?
   */
  _catch(err, req, res, next) {
    if (this._catcher) return this._catcher(err, req, res, next);
    this._defaultCatcher(err, req, res, next);
  }

  /**
   * add catcher middleware
   * @param  {Function} catcher middleware
   * @return {Rubik.HTTP}       this
   */
  catch(catcher) {
    if (!isFunction(catcher)) {
      throw new TypeError('catcher is not a function');
    }
    this._catcher = catcher;
    return this;
  }

  /**
   * convert input value into bind string
   * @param  {Mixed} bind value to convert
   * @return {String}     bind string
   */
  getBind(bind) {
    const zero = new Set([0, true, '0.0.0.0', '0']);
    if (zero.has(bind)) return '0.0.0.0';
    if (!bind) return 'localhost';
    if (typeof bind === 'string') return bind;
    return 'localhost';
  }

  /**
   * listen HTTP in bind or port
   * @param  {Number} port              server port
   * @param  {String} bind              bind string
   * @param  {String} [protocol='http'] protocol (http|https)
   * @return {Promise}
   */
  listen(port, bind, protocol = 'http') {
    if (protocol === 'https') {
      const https = require('https');
      return new Promise((resolve, reject) => {
        const server = https.createServer(this.httpApp).listen(+port, bind, (err) => {
          if (err) return reject(err);
          this.servers.add(server);
          resolve();
        });
      });
    }
    return new Promise((resolve, reject) => {
      const server = this.httpApp.listen(+port, bind, (err) => {
        if (err) return reject(err);
        this.servers.add(server);
        resolve();
      });
    });
  }

  /**
   * start server with config ports and servers
   * @return {Promise}
   */
  async start() {
    // listening
    const ports = [];
    if (!isNaN(+this.config.port)) {
      const bind = this.getBind(this.config.bind);
      await this.listen(+this.config.port, bind);
      ports.push(`${bind}:${this.config.port}`);
    }
    if (Array.isArray(this.config.servers)) {
      for (const server of this.config.servers) {
        if (!server) {
          this.log.warn('One of the config\'s servers is undefined');
          continue;
        }
        if (!(server.port && !isNaN(+server.port))) {
          this.log.warn('One of the config\'s servers has invalid port');
          continue;
        }
        const bind = this.getBind(server.bind);
        await this.listen(server.port, server.bind, server.protocol);
        ports.push(`${bind}:${server.port}`);
      }
    }
    if (!ports.length) {
      throw new TypeError('Server not started, because http config does not contain any port or server with port 💥');
    }
    this.log.info(`HTTP ${ports.length === 1 ? 'Server' : 'Servers'} started — ${ports.join(', ')} 🚀`);
    return this;
  }


  _stopServer(server) {
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    })
  }
  /**
   * stop all started servers
   * @return {Promise}
   */
  stop() {
    const promisses = [];
    this.servers.forEach(server => promisses.push(this._stopServer(server)));
    return Promise.all(promisses);
  }

  /**
   * hook after all kubiks up
   * add _catch middleware and listen servers
   */
  async after() {
    this.httpApp.use(this._catch);
    await this.applyHooks('after');
    if (this.autoStart) {
      await this.start();
    }
  }
}

HTTP.prototype.CREATE_HTTP_APP = true;
module.exports = HTTP;
