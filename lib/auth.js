
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

var User        = models.require('user');

// 
// Create a JWT for the given user data
// 
// @param {user} the user object
// @return string
// 
exports.createToken = function(user) {
	var ttl = conf.auth.tokenTTL;
	var data = {
		userId: user.userId,
		username: user.username,
		email: user.email,
		expires: moment().add(ttl[0], ttl[1]).valueOf()
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

		// Make sure the token is not expired
		if (data.expires <= Date.now()) {
			return reject(new HttpError(401, 'Authentication token expired'));
		}

		// Find the user in the database
		User.findById(token.userId, function(err, user) {
			if (err) {
				return reject(new HttpError(err));
			}

			// Make sure the user exists
			if (! user) {
				return reject(new HttpError(401, 'User does not exist'));
			}

			// Check to make sure all of the data lines up correctly
			if (data.username !== user.username || data.email !== user.email) {
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

		console.log('SEND EMAIL', email);

		messaging.sendEmail(email)
			.then(promise.resolve, promise.reject);
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
		console.log('SEND SMS');
		promise.resolve();
	},

	// 
	// Fetch an object with user data by the user's ID
	// 
	// @param {userId} the user's ID
	// @param {promise} a promise to resolve/reject
	// @result {id,authMethod,[email],[password],[phone]}
	// 
	fetchUserById: function(userId, promise) {
		console.log('FETCH USER BY ID')
		promise.resolve({
			id: '1234',
			authMethod: 'twostep-email',
			name: 'testuser1234',
			email: 'test@example.com',
			phone: '+15555555555',
			password: "somepass"
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
		console.log('FETCH USER BY NAME');
		promise.resolve({
			id: '1234',
			authMethod: 'twostep-email',
			name: 'testuser1234',
			email: 'test@example.com',
			phone: '+15555555555',
			password: "somepass"
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
		console.log('CHECK PASSWORD');
		promise.resolve(user.password === password);
	},

	// 
	// Mark a user's email address as valid and confirmed
	// 
	// @param {userId} a user ID value
	// @param {promise} a promise to resolve/reject
	// @result void
	// 
	confirmEmail: function(userId, promise) {
		console.log('CONFIRM EMAIL');
		promise.resolve();
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
		console.log('UPDATE PASSWORD');
		promise.resolve();
	}
});
