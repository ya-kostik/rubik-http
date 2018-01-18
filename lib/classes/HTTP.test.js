/*global test expect */

const { createApp, createKubik } = require('rubik-main/tests/helpers/creators');
const { Kubiks } = require('rubik-main');
const HTTP = require('./HTTP');

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
