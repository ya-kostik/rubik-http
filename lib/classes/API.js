const express = require('express');
const HTTP = require('./HTTP');

/**
 * HTTP API kubik
 * Add some easy methods to make api for singlepages
 * @namespace Rubik.HTTP
 * @class API
 * @extends Rubik.HTTP
 * @prop {Rubik.HTTP} http kubik that needs an api
 */
class API extends HTTP {
  constructor(defaultVolume) {
    super(defaultVolume);
    this.name = 'http/api';
    this.httpApp = express.Router();
    this.dependencies = ['http'];
    this.http = null;
  }

  /**
   * init api kubik
   * @return {Promise}
   */
  async _init() {
    this.http.httpApp.use('/api', this.httpApp);
    this.httpApp.use(express.json());
    this.httpApp.use(express.urlencoded());
    await this._applyHooks('before');
    this._applyExtensions();
    await this._scan();
    const extension = this.apiResponseExtension === undefined
                        ? undefined
                        : this.apiResponseExtension;
    this.httpApp.get('/', (req, res) => res.json({ api: 'ok', extension }));
  }

  /**
   * up api kubik
   * @param  {Object}  dependencies
   * @return {Promise}
   */
  async up({ http }) {
    this.http   = http;
    this.config = http.config;
    this.log    = http.log;
    await this._init();
  }

  /**
   * replace listen with throw
   */
  listen() {
    throw new TypeError('You can\'t listen API');
  }

  /**
   * after all kubiks up
   * @return {Promise}
   */
  after() {
    return this._applyHooks('after');
  }
}

API.prototype.applyMiddlewares = HTTP.prototype.applyMiddlewares;
API.prototype.CREATE_HTTP_APP = false;
module.exports = API;
