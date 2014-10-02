
var pkg        = require('pkg');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;

var VERSION = pkg.read(__dirname + '/../package.json').version();

var IndexEndpoint = module.exports = new Endpoint({

	route: '/',
	
	//
	// GET /index
	//
	"get": function(req) {
		req.respond(200, {
			name: 'Collabish API',
			version: VERSION,
			endpoints: {
				'/': {
					'get': {
						description: 'Displays the root API index'
					}
				},
				'/auth': {
					'post': {
						description: 'Starts the authentication process',
						body: {
							username: 'The username of the user to authenticate',
							password: 'The password for the account, if one is needed'
						}
					}
				}
			}
		});
	}
	
});
