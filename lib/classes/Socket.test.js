/*global test expect */
const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const Socket = require('./Socket');
const HTTP = require('./HTTP');
const clientIO = require('socket.io-client');

const startPort = 2050;

function initApp(port, autoStart = true) {
  const app = createApp();
  const config = createKubik(Kubiks.Config, app);
  config.configs.http = { port };
  createKubik(Kubiks.Log, app);
  const http = createKubik(HTTP, app);
  http.autoStart = autoStart;
  return app;
}

test('create and up Socket instance', async () => {
  const app = initApp(startPort);
  const socket = createKubik(Socket, app);
  await app.up();
  const http = app.kubiks.get('http');
  await http.stop();
  expect(socket.io).toBeDefined();
});

test('add event listener to an instance of the Socket', async (done) => {
  const app = initApp(startPort + 1);
  const http = app.kubiks.get('http');
  const socket = createKubik(Socket, app);
  socket.on('connection', async (inSocket) => {
    expect(inSocket.rubik).toBe(app);
    await http.stop();
    done();
  });
  await app.up();
  clientIO('http://localhost:' + (startPort + 1));
});

test('add and remove event listener to an instance of the Socket', () => {
  const socket = createKubik(Socket);
  const cb = () => {};
  const event = 'abracadabra';
  socket.on(event, cb);
  // It is strange changes in the socket.io
  // expect(socket.io.listenerCount(event)).toBe(1);
  expect(socket.io.sockets.listenerCount(event)).toBe(1);
  socket.on(event, cb);
  socket.on(event, cb);
  // expect(socket.io.listenerCount(event)).toBe(3);
  expect(socket.io.sockets.listenerCount(event)).toBe(3);
  socket.off(event, cb);
  // expect(socket.io.listenerCount(event)).toBe(2);
  expect(socket.io.sockets.listenerCount(event)).toBe(2);
  socket.off(event);
  // expect(socket.io.listenerCount(event)).toBe(0);
  expect(socket.io.sockets.listenerCount(event)).toBe(0);
});

test('up without upped http should fail', async () => {
  const app = createApp();
  const config = createKubik(Kubiks.Config, app);
  config.configs.http = { port: startPort + 2 };
  createKubik(Kubiks.Log, app);
  const socket = createKubik(Socket, app);
  createKubik(HTTP, app);
  await expect(app.up()).rejects.toThrow(socket.serverIndex + ' server of http is not defined. Up http first.')
});
