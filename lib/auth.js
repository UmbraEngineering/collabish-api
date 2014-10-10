
var moment      = require('moment');
var jwt         = require('jwt-simple');
var messaging   = require('./messaging');
var Auth        = require('multi-auth');
var RedisStore  = require('multi-auth/lib/key-stores/redis');
var conf        = require('dagger.js/lib/conf');
var redis       = require('dagger.js/lib/redis');
var Promise     = require('promise-es6').Promise;
var HttpError   = require('dagger.js/lib/http-meta').HttpError;
var models      = require('dagger.js/lib/models');
var when        = require('dagger.js/node_modules/when');

var User        = models.require('user').model;

// 
// Create a JWT for the given user data
// 
// @param {user} the user object
// @return string
// 
exports.createToken = function(user) {
	var ttl = conf.auth.tokenTTL;
	var now = moment().valueOf();
	var then = moment().add(ttl[0], ttl[1]).valueOf();

	var data = {
		iss: 'http://collabish.me',
		aud: 'http://collabish.me',
		iat: now,
		nbf: now,
		exp: then,
		sub: user.id,
		jti: user.id + '.' + now
	};

	return jwt.encode(data, process.env.JWT_SECRET);
};

// 
// Decode a JWT
// 
// @param {token} the jwt string
// @return object
// 
exports.validateToken = function(token) {
	return new Promise(function(resolve, reject) {
		// Decode the token
		try {
			var data = jwt.decode(token, process.env.JWT_SECRET);
		} catch (err) {
			return reject(new HttpError(401, 'Authentication token invalid'));
		}

		// Check that we issued it
		if (data.iss !== 'http://collabish.me') {
			return reject(new HttpError(401, 'Authentication token invalid'));
		}

		var now = moment().valueOf();

		// Make sure the token is not expired
		if (data.nbf > now || data.iat > now) {
			return reject(new HttpError(401, 'Authentication token not active'));
		}

		// Make sure the token is not expired
		if (data.exp <= now) {
			return reject(new HttpError(401, 'Authentication token expired'));
		}

		// Find the user in the database
		User.findById(data.sub, function(err, user) {
			if (err) {
				return reject(new HttpError(err));
			}

			// Make sure the user exists
			if (! user) {
				return reject(new HttpError(401, 'Authentication token invalid'));
			}

			resolve(user);
		});
	});
};

// 
// Create the multi-auth controller object
// 
exports.multiAuth = new Auth({
	keyStore: new RedisStore({
		client: redis.createClient({ selectDB: false }),
		keyName: 'authkey'
	}),
	authMethods: conf.auth.authMethods,

	// 
	// Send an email to a user
	// 
	// @param {user} a user object {id,authMethod,[email],[password],[phone]}
	// @param {template} the type of email to send (will be one of "emailAuth", "twoStepAuth", "passwordReset", "emailConfirm")
	// @param {data} data relavent to the message, eg. {user,token}
	// @param {promise} a promise to resolve/reject
	// @result void
	// 
	sendEmail: function(user, template, data, promise) {
		var subject = ({
			emailAuth: 'Collabish - Login Request',
			twoStepAuth: 'Collabish - Two Step Login',
			passwordReset: 'Collabish - Password Reset',
			emailConfirm: 'Collabish - Email Confirmation'
		})[template];
		
		template = ({
			emailAuth: 'emails/auth/email-auth',
			twoStepAuth: 'emails/auth/two-step-auth',
			passwordReset: 'emails/auth/password-reset',
			emailConfirm: 'emails/auth/email-confirm'
		})[template];

		data.user = user;

		var email = {
			to: user.email,
			subject: subject,
			template: template,
			data: data
		};

		messaging.sendEmail(email)
			.then(function() {
				promise.resolve();
			})
			.catch(function(err) {
				promise.reject(err);
			});
	},

	// 
	// Semd am SMS message to a user
	// 
	// @param {user} a user object containing auth-related properties
	// @param {template} the type of message to send (will be one of "twoStepAuth")
	// @param {data} data relavent to the message, eg. {user,token}
	// @param {promise} a promise to resolve/reject
	// @result void
	// 
	sendSMS: function(user, template, data, promise) {
		promise.reject('SMS not supported');
	},

	// 
	// Fetch an object with user data by the user's ID
	// 
	// @param {userId} the user's ID
	// @param {promise} a promise to resolve/reject
	// @result {id,authMethod,[email],[password],[phone]}
	// 
	fetchUserById: function(userId, promise) {
		User.findById(userId, function(err, user) {
			if (err) {
				return promise.reject(err);
			}

			if (! user) {
				return promise.reject(new HttpError(401, 'No such user'));
			}

			promise.resolve({
				id: user._id,
				authMethod: user.authMethod,
				name: user.username,
				email: user.email,
				phone: user.phone,
				password: user.password
			});
		});
	},

	// 
	// Fetch an object with user data by a name value (username or email)
	// 
	// @param {name} the user name value
	// @param {promise} a promise to resolve/reject
	// @result {id,name,email,authMethod}
	// 
	fetchUserByName: function(name, promise) {
		var query = { };
		if (name.indexOf('@') >= 0) {
			query.email = name;
		} else {
			query.username = name;
		}

		User.findOne(query, function(err, user) {
			if (err) {
				return promise.reject(err);
			}

			if (! user) {
				return promise.reject(new HttpError(401, 'No such user'));
			}

			promise.resolve({
				id: user._id,
				authMethod: user.authMethod,
				name: user.username,
				email: user.email,
				phone: user.phone,
				password: user.password
			});
		});
	},

	// 
	// Check if the given password is valid for the given user
	// 
	// @param {user} a user object {id,authMethod,[email],[password],[phone]}
	// @param {password} the password value to check
	// @param {promise} a promise to resolve/reject
	// @result boolean
	// 
	checkPassword: function(user, password, promise) {
		User.hashPassword(password, user.password.salt, user.password.iterations)
			.then(function(result) {
				promise.resolve(user.password.hash.toString('hex') === result.hash.toString('hex'));
			})
			.catch(function(err) {
				promise.reject(err);
			});
	},

	// 
	// Mark a user's email address as valid and confirmed
	// 
	// @param {userId} a user ID value
	// @param {promise} a promise to resolve/reject
	// @result void
	// 
	confirmEmail: function(userId, promise) {
		User.findByIdAndUpdate(userId, {$set: {emailConfirmed: true}})
			.exec()
			.then(
				promise.resolve,
				promise.reject
			);
	},

	// 
	// Update a user's password to the given value
	// 
	// @param {userId} a user ID value
	// @param {password} the new password to use
	// @param {promise}
	// @result void
	// 
	updatePassword: function(userId, password, promise) {
		User.findById(userId, function(err, user) {
			if (err) {
				return promise.reject(err);
			}

			if (! user) {
				return promise.reject(new HttpError(401, 'No such user'));
			}

			user.setPassword(password)
				.then(function() {
					return when.saved(user);
				})
				.then(function() {
					promise.resolve();
				})
				.catch(function(err) {
					promise.reject(err);
				});
		});
	}
});
