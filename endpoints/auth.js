
var auth       = require('../lib/auth');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;

var AuthEndpoint = module.exports = new Endpoint({

	route: '/auth',
	
	//
	// POST /auth
	//
	"post": function(req) {
		auth.multiAuth.startAuthentication(req.body)
			.then(function(user) {
				if (user && typeof user === 'object') {
					// Authentication was successful, use the user object to generate
					// an auth token and send it to the client
					var token = auth.createToken(user);
					return req.respond(200, {
						message: 'Authentication successful',
						token: token
					});
				}

				if (user) {
					// The first step in a two-step process was successful. Inform the
					// client that they should attempt to move forward with authentication
					return req.respond(202, {
						message: 'Authentication message sent'
					});
				}

				// Authentication has failed
				(new HttpError(401, 'Authentication failed')).send(req);
			})
			.catch(function(err) {
				err = new HttpError(err);
				err.status = 401;
				err.send(req);
			});
	},

	// 
	// POST /auth/email-confirmation/:userId
	// 
	"put|patch /email-confirmation/:userId": function(req) {
		auth.multiAuth.confirmEmailStepOne(req.params.userId)
			.then(function() {
				req.respond(202, {
					message: 'Confirmation email sent'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// PUT/PATCH /auth/email-confirmation/:key
	// 
	"put|patch /email-confirmation/:key": function(req) {
		auth.multiAuth.confirmEmailStepTwo(req.params.key)
			.then(function() {
				req.respond(200, {
					message: 'Email confirmed'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	}
	
});
