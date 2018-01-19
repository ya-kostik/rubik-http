const express = require('express');
const HTTP = require('./HTTP');
const { helpers } = require('rubik-main');

/**
 * HTTP API kubik
 * Add some easy methods to make api for singlepages
 * @namespace Rubik.HTTP
 * @class API
 * @extends Rubik.HTTP
 * @prop {Rubik.HTTP} http kubik that needs an api
 */
class API extends HTTP {
  constructor(defaultVolume, parserOptions = {}) {
    super(defaultVolume);
    this.name = 'http/api';
    this.httpApp = express.Router();
    this.dependencies = ['http'];
    this.http = null;
    this.parserOptions = helpers.assignDeep({
      json: { limit: '500kb' },
      urlencoded: { limit: '500kb', extended: true }
    }, parserOptions);
  }

  /**
   * init api kubik
   * @return {Promise}
   */
  async _init() {
    this.httpApp.use(express.json(this.parserOptions.json));
    this.httpApp.use(express.urlencoded(this.parserOptions.urlencoded));
    await this._applyHooks('before');
    this._applyExtensions();
    await this._scan();
    const extension = this.apiResponseExtension === undefined
                        ? undefined
                        : this.apiResponseExtension;
    this.httpApp.get('/', (req, res) => res.json({ api: 'ok', extension }));
    this.http.httpApp.use('/api', this.httpApp);
  }

  /**
   * up api kubik
   * @param  {Object}  dependencies
   * @return {Promise}
   */
  async up({ http }) {
    this.http   = http;
    this.log    = http.log;
    this.config = http.config.api || {};
    if (this.config.parser) {
      helpers.assignDeep(this.parserOptions, this.config.parser);
    }
    await this._init();
  }

  use(extension) {
    if (extension && extension.apiResponseExtension) {
      if (!this.apiResponseExtension) this.apiResponseExtension = {};
      helpers.assignDeep(this.apiResponseExtension, extension.apiResponseExtension);
      return;
    }
    super.use(extension);
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
