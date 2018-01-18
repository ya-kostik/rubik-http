/*global test expect */

const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const HTTP = require('./HTTP');
const request = require('supertest');

const startPort = 1992;

function initApp(port) {
  const app = createApp();
  const config = createKubik(Kubiks.Config, app);
  config.configs.http = { port };
  createKubik(Kubiks.Log, app);
  return app;
}

test('Create HTTP kubik, and up it with app', async () => {
  const app = initApp(startPort + 1);
  const http = createKubik(HTTP, app);
  await app.up();
  expect(http.servers.size).toBe(1);
  await http.stop();
});

test('Apply HTTP middlewares by app extension', async () => {
  const app = initApp(startPort + 2);
  createKubik(HTTP, app);
  const testValue = 'There is no spoon';
  let isMiddle = 0;
  // empty
  app.use({ http: {} });
  // as function
  app.use({ http: (req, res, next) => { isMiddle += 1; next(); } });
  // as middlewares
  app.use({
    http: {
      middlewares: [(req, res, next) => {
        req.__testValue__ = testValue;
        next();
      }, (req, res) => {
        expect(req.__testValue__).toBe(testValue);
        isMiddle += 1;
        res.send({ ok: true });
      }]
    }
  });
  const http = app.kubiks.get('http');
  // directly use undefined extension
  http.use(undefined);
  await app.up();
  const res = await request(http.httpApp).get('/').expect(200).then(res => res);
  expect(res.body.ok).toBe(true);
  expect(isMiddle).toBe(2);
  await http.stop();
});

test('up without config should throw error', async () => {
  const app = initApp();
  const log = app.kubiks.get('log');
  const http = createKubik(HTTP, app);
  try {
    await http.up({ config: { get() { return null } }, log });
  } catch(err) {
    expect(err).toEqual(new TypeError('Config field http is not defined'));
    return;
  }
  throw new Error('Not thrown')
});

test('after and before for HTTP', async () => {
  const app = initApp(startPort + 3);
  const http = createKubik(HTTP, app);
  const values = {
    before: false,
    after: false
  }
  const extension = {
    before() { values.before = true; },
    after() { values.before = true; }
  };
  app.use({ http: extension });
  expect(http._before[0]).toEqual(extension.before);
  expect(http._after[0]).toEqual(extension.after);
  await app.up();
  await http.stop();
});

test('create HTTP instance with default volume', () => {
  const http1 = new HTTP('/');
  const http2 = new HTTP(['A', 'B']);
  expect(http1.volumes).toEqual(['/']);
  expect(http2.volumes).toEqual(['A', 'B']);
});

test('catch request\'s errors in instance of HTTP', async () => {
  const app = initApp(startPort + 4);
  const http = createKubik(HTTP, app);
  const err = new Error('Testy error');
  http.use((req, res, next) => {
    next(err);
  });
  http.autoStart = false;
  await app.up();

  let res = await request(http.httpApp).get('/').expect(500).then(res => res);
  expect(res.body).toEqual({
    error: err.message,
    code: 500,
    message: 'Internal server error'
  });
  let innerErr;
  http.catch((err, req, res, next) => {
    innerErr = err;
    next.justForLinter;
    res.send({ text: 'Custom error' });
  });
  res = await request(http.httpApp).get('/').expect(200).then(res => res);
  expect(innerErr).toBe(err);
  expect(res.body.text).toBe('Custom error');
});
