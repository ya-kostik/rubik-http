const { Kubik, helpers } = require('rubik-main');
const io = require('socket.io');

/**
 * WebSocket HTTP kubik for Rubik
 * Use socket.io for process ws connections
 * @namespace Rubik.HTTP
 * @class Socket
 * @prop {Nubmber} serverIndex index of http.servers server, defaults — 0
 * @prop {Object}  options     options for attach connections, can be changed across http.socket config
 * @param {Object} options     default options
 */
class Socket extends Kubik {
  constructor(options = {}) {
    super();
    this.name = 'http/socket';
    this.dependencies = ['http'];
    this.serverIndex = 0;
    this.options = options || {};
    this.io = io();
  }

  /**
   * up socket kubik
   * @param  {HTTP} http kubik
   */
  up({ http }) {
    this.http = http;
    this.config = this.http.config && this.http.config.socket || {};
    this.log = this.http.log;
    helpers.assignDeep(this.options, this.config);
    this.io.use((socket, next) => {
      socket.rubik = this.app;
      next();
    });
    this.applyHooks('before');
  }

  /**
   * add listener to io
   * @param {String} name of listener
   * @param {Function} cb callback of listener
   * @return {Rubik.HTTP.Socket} this
   */
  on(/* arguments */) {
    this.io.on(...arguments);
    return this;
  }

  /**
   * remove listener from io
   * @return {Rubik.HTTP.Socket} this
   */
  off(event, cb) {
    if (!cb) this.io.removeAllListeners(event);
    else this.io.removeListener(event, cb);
    return this;
  }

  /**
   * after all kubiks up hook
   */
  after() {
    this.applyHooks('after');
    const server = Array.from(this.http.servers)[this.serverIndex];
    if (!server) {
      throw new TypeError(
        this.serverIndex + ' server of http is not defined. Up http first.'
      );
    }
    this.io.attach(server, this.options);
    const addText = this.http.servers.size > 1 ? ' ' + (this.serverIndex + 1) : '';
    this.log.info('Socket attached to the server' + addText + ' 🏓');
  }
}

module.exports = Socket;
