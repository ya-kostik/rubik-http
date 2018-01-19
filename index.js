const HTTP = require('./lib/classes/HTTP');

HTTP.API = require('./lib/classes/API');
HTTP.Socket = require('./lib/classes/Socket');
HTTP.Errors = { HttpError: require('./lib/Errors/HttpError') }
module.exports = HTTP;
