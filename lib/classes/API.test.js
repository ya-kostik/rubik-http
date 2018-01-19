/*global test expect */
const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const API = require('./API');
const HTTP = require('./HTTP');
const request = require('supertest');

const startPort = 2030;

function initApp(port, autoStart = false) {
  const app = createApp();
  const config = createKubik(Kubiks.Config, app);
  config.configs.http = { port };
  createKubik(Kubiks.Log, app);
  const http = createKubik(HTTP, app);
  http.autoStart = autoStart;
  return app;
}

test('Create API', async () => {
  const app = initApp(startPort);
  createKubik(API, app);
  const http = app.kubiks.get('http');
  await app.up();
  const res = await request(http.httpApp).get('/api');
  expect(res.statusCode).toBe(200);
  expect(res.body.api).toBe('ok');
});

test('Can\'t listen API', () => {
  const api = createKubik(API);
  expect(() => api.listen()).toThrow('You can\'t listen API');
});


test('extend parser options', async () => {
  const app = initApp(0);
  const config = app.kubiks.get('config');
  config.configs.http.api = { parser: { json: { limit: '1024kb' } } };
  const api = createKubik(API, app);
  await app.up();
  expect(api.parserOptions.json.limit).toBe('1024kb');
});

test('add apiResponseExtension to an instance of API', async () => {
  const app = initApp(startPort);
  createKubik(API, app);
  app.use({
    'http/api': { apiResponseExtension: { text: 'Hello, I am testy string' } }
  });
  const http = app.kubiks.get('http');
  await app.up();
  const res = await request(http.httpApp).get('/api');
  expect(res.statusCode).toBe(200);
  expect(res.body.extension).toEqual({ text: 'Hello, I am testy string' });
});
