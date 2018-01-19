# rubik-http
HTTP Kubik for Rubik

## Install

### npm
```bash
npm i rubik-http
```

### yarn
```bash
yarn add rubik-http
```

## Use
```javascript
const { App, Kubiks } = require('rubik-main');
const HTTP = require('rubik-http');
const path = require('path');

// create rubik app
const app = new App();
// config need for most modules
const config = new Kubiks.Config(path.join(__dirname, './config/'));
// you can use any logger you want, just create kubik with it
// default Kubiks.Log use console for logging
const log = new Kubiks.Log();
// first param is a directory with routes or middlewares
// route: module.exports = { name: '/files', router: express.Router() };
// middleware: module.exports = function(req, res, next) { next() };
const http = new HTTP(path.join(__dirname, './routes/'));
// use is extension method for Kubik instances
http.use(async function(req, res, next) {
  req.user = await User.find(req.query.token);
  next();
});
http.use({
  middlewares: [
    (req, res, next) => {
      if (!req.user) {
        return next(new HTTP.Errors.HttpError(404, 'User not found'));
      }
      res.json(req.user);
    },
    { name: '/profiles', router: require('./profileRouter') }
  ]
});


app.add([ config, log, http ]);

app.up().
then(() => console.info('App started')).
catch(err => console.error(err));
```

## Config
`http.js` config in configs volume should contain port or servers field, or both.

For example:
`config/http.js`
```javascript
module.exports = {
  // http will create http server and will listen 1993 port
  port: 1993,
  bind: 'localhost',
  // http will create 3 http servers with 1994, 1995, 1996 ports
  // localhost:1994, 1.1.1.1:1995, 0.0.0.0:1996
  servers: [
    { port: 1994 },
    { port: 1995, bind: '1.1.1.1' },
    { port: 1996, bind: 0 }
  ]
};
```

## Extensions
When you add an instance of HTTP to app, you can use standart extensions interface,
with other extensions
```javascript
app.use({
  config: {
    volumes: [
      path.join(__dirname, './config'),
      path.join(__dirname, '../config')
    ]
  },
  http: {
    middlewares: [
      require('./whitelist.js'),
      require('./cacheControl.js')
    ]
  }
});
```

Also you can use `use` directly
```javascript
http.use({
  middlewares: [
    require('./whitelist.js'),
    require('./cacheControl.js')
  ]
});
```

HTTP's instance has the following extensions
1. function — just add as middleware
```javascript
app.use({
  http: function(req, res, next) {
    console.info('Request starts at', new Date());
    next();
  }
});

http.use(async function(req, res) {
  const users = await User.findAll();
  res.json({ list: users });
  console.info('Request ends at', new Date());
});
```
2. middlewares — array of middlewares
3. routes volumes — directories with .js modules: `module.exports = { name: '/files', router: express.Router() };`

```javascript
app.use({
  http: {
    volumes: [
      path.join(__dirname, './routes'),
      path.join(__dirname, '../filesRoutes')
    ]
  }
});
```
4. before and after hooks
```javascript
app.use({
  http: {
    before(http) {
      // before all middlewares, routes or other
    },
    after(http) {
      // after all middlewares, routes or other, but before create servers and listen
    }
  }
})
```

## API
`HTTP.API` kubik add to HTTP `/api` route. It is completely the same as a HTTP, with their hooks, extensions and volumes of route's.

Add only one extension — `apiResponseExtension`
```javascript
app.use({
  api: {
    apiResponseExtension: {
      text: 'Hi! This is api!'
    }
  }
});
// HTTP GET /api
// { api: 'ok', extension: { text: 'Hi! This is api!' } }
```

You need add `HTTP.API` kubik after `HTTP` kubik:
```javascript
// ...
const api = new HTTP.API();
app.add([http, api]);
// or:
// app.add(http);
// app.add(api);
// ...
```
