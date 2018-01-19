/*global test expect */
const express = require('express');
const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const HTTP = require('./HTTP');
const HttpError = require('../Errors/HttpError');
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
      middlewares: [
        (req, res, next) => {
          req.__testValue__ = testValue;
          next();
        },
        (req, res) => {
          expect(req.__testValue__).toBe(testValue);
          isMiddle += 1;
          res.send({ok: true});
        }
      ]
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

test('add route with middlewares', async () => {
  const app = initApp(startPort + 5);
  const http = createKubik(HTTP, app);
  http.autoStart = false;
  app.use({
    http: {
      middlewares: [
        {
          name: '/ping',
          router: express.Router().get('/', (req, res) => res.json({text: 'Testy'}))
        }
      ]
    }
  });
  await app.up();
  const res = await request(http.httpApp).get('/ping/');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({text: 'Testy'});
});

test('catch is not a function', () => {
  const http = createKubik(HTTP);
  expect(() => {
    http.catch({});
  }).toThrow('catcher is not a function');
});

test('get some binds', () => {
  const http = createKubik(HTTP);
  const localhost = 'localhost';
  const zero = '0.0.0.0';
  const zeroValues = [0, '0', zero, true];
  zeroValues.forEach((value) => expect(http.getBind(value)).toBe(zero));
  const localValues = [null, false, undefined, 'localhost', {}]
  localValues.forEach((value) => expect(http.getBind(value)).toBe(localhost));
  expect(http.getBind('1.1.1.1')).toBe('1.1.1.1');
});

test('up port server and servers servers', async () => {
  const app = initApp(startPort + 6);
  const config = app.kubiks.get('config');
  console.info('Warnings below is a normal part of test');
  config.configs.http.servers = [
    {
      port: startPort + 7
    }, {
      port: startPort + 8
    }, {
      port: startPort + 9
    },
    // undefined server
    undefined,
    // server without port
    {},
    // server as string
    'this is not server, it could never starts'
  ];
  const http = createKubik(HTTP, app);
  await app.up();
  expect(http.servers.size).toBe(4);
  await http.stop();
});

test('up without ports should fail', async () => {
  const app = initApp(0);
  const config = app.kubiks.get('config');
  config.configs.http = {};
  const http = createKubik(HTTP, app);
  const upPromise = app.up();
  await expect(upPromise).rejects.toThrow('Server not started, because http config does not contain any port or server with port 💥');
  expect(http.servers.size).toBe(0);
});

test('scan mock volume end exec routers', async () => {
  const app = initApp(startPort + 10);
  const path = require('path');
  const http = new HTTP(path.join(__dirname, '../../test/mocks/routes/'));
  http.autoStart = false;
  app.add(http);
  await app.up();
  const resps = await Promise.all([
    request(http.httpApp).get('/a'),
    request(http.httpApp).get('/b')
  ]);
  expect(resps[0].statusCode).toBe(200);
  expect(resps[1].statusCode).toBe(200);
  expect(resps[0].body).toEqual({ text: 'a' });
  expect(resps[1].body).toEqual({ text: 'b' });
});

test('throw HttpError', async () => {
  const app = initApp(startPort + 11);
  const http = createKubik(HTTP, app);
  http.autoStart = false;
  const err = new HttpError(401, 'Testy error message');
  http.use((req, res, next) => {
    next(err);
  });
  await app.up();
  const res = await request(http.httpApp).get('/');
  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({
    error: err.message,
    code: err.code,
    message: err.statusMessage
  });
});
