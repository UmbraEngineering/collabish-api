
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;

var EmailEndpoint = module.exports = new Endpoint({

	route: '/email',
	
	//
	// GET /email
	//
	"get": function(req) {
		var templates = require('../lib/templates');

		req.setHeader('content-type', 'text/html');
		req.respond(200, templates.render(req.query.t, JSON.parse(req.query.d || '{}')));
	}
	
});
