
var auth       = require('../lib/auth');
var Promise    = require('promise-es6').Promise;
var HttpError  = require('dagger.js/lib/http-meta').HttpError;

exports = module.exports = function(req, next) {
	req.auth = createAuthObject(req);
	var token = req.requestHeaders.authorization;

	// If the user did not send an auth token, just continue on with the request
	if (! token) {
		return next();
	}

	// Validate the auth token from the user
	auth.validateToken(token)
		.then(function(user) {
			// If the token was valid and we got a user, store the data on the
			// request object for later use
			req.auth.user = user;
			req.auth.token = token;
			next();
		})
		.catch(function(err) {
			// If the token failed to validate for some reason, we just continue
			// on with the request as if the user did not give one
			next();
		});
};

// 
// Creates a {req.auth} object
// 
// @param {req} the request object
// @return object
// 
function createAuthObject(req) {
	return {
		isAdmin: false,
		is: function(id) {
			return req.auth.user && req.auth.user._id.equals(id);
		},
		allow: function(rule) {
			return new Promise(function(resolve, reject) {
				if (typeof rule !== 'function') {
					rule ? resolve() : reject(new HttpError(401, 'Not Authorized'));
					return;
				}

				var result = rule();

				if (isThenable(result)) {
					result.then(
						function(result) {
							result ? resolve() : reject(new HttpError(401, 'Not Authorized'));
						},
						reject
					);
					return;
				}

				result ? resolve() : reject(new HttpError(401, 'Not Authorized'));
			});
		},
		deny: function(rule) {
			return new Promise(function(resolve, reject) {
				if (typeof rule !== 'function') {
					rule ? reject(new HttpError(401, 'Not Authorized')) : resolve();
					return;
				}

				var result = rule();

				if (isThenable(result)) {
					result.then(
						function(result) {
							result ? reject(new HttpError(401, 'Not Authorized')) : resolve();
						},
						reject
					);
					return;
				}

				result ? reject(new HttpError(401, 'Not Authorized')) : resolve();
			});
		}
	};
}

function isThenable(obj) {
	return (obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function');
}
