
var crypto    = require('crypto');
var conf      = require('dagger.js/lib/conf');
var models    = require('dagger.js/lib/models');
var Promise   = require('promise-es6').Promise;
var validate  = require('mongoose-validator');

var ObjectId  = models.types.ObjectId;

// 
// Define the User schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('User', UserSchema)`)
// as that is handled automatically by dagger's model module.
// 
var UserSchema = module.exports = new models.Schema({
	username: {
		type: String,
		required: true,
		index: {unique: true},
		validate:[
			validate({
				validator: 'matches',
				arguments: /^[a-zA-Z0-9_\-]+$/,
				message: 'Can only contain letters, numbers, hyphens (-) and underscores (_)'
			}),
			validate({
				validator: 'isLength',
				arguments: [1, 30],
				message: 'Must be between 1 and 30 characters in length'
			})
		]
	},
	email: {
		type: String,
		required: true,
		index: {unique: true},
		validate: [
			validate({
				validator: 'isEmail',
				message: 'Must be a valid email address'
			})
		]
	},
	phone: {
		type: String,
		validate: [
			validate({
				validator: 'matches',
				arguments: /^\+1[0-9]{7,11}$/, ///^\+[1-9]{1}[0-9]{7,11}$/,
				message: 'Must be a valid mobile phone number'
			})
		]
	},
	password: {
		hash: { type: Buffer },
		salt: { type: Buffer },
		iterations: { type: Number }
	},
	emailConfirmed: { type: Boolean, default: false },
	authMethod: {
		type: String,
		required: true,
		enum: [ 'password', 'email', 'twostep-email' ]
	},
	// Completely optional public profile
	profile: {
		name: {type: String},
		url: {type: String},
		location: {type: String}
	}
});

// 
// When a user is deleted, clean up the database, removing all related documents
// 
UserSchema.post('remove', function(doc) {
	Inbox.findByUser(doc._id)
		.then(function() {
			// 
		});
});

// 
// Hashes the given password. If no salt/iterations values are given, new ones
// will be generated
// 
// @param {password} the plaintext password to be hashed
// @param {salt} optional, the salt to use in hashing
// @param {iterations} optional, the number of hashing iterations
// @return object
// 
UserSchema.statics.hashPassword = function(password, salt, iterations) {
	iterations = iterations || conf.auth.iterations || 10000;

	var salt;

	return getSalt()
		.then(function(_salt) { salt = _salt })
		.then(function() {
			return doHash(password, salt, iterations);
		})
		.then(function(hash) {
			return {
				hash: hash,
				salt: salt,
				iterations: iterations
			};
		});

	// 
	// If a salt value was given, return it, otherwise generate a new,
	// random, 64-byte salt
	// 
	function getSalt() {
		if (salt) {
			return Promise.resolve(salt);
		}

		return new Promise(function(resolve, reject) {
			crypto.randomBytes(64, function(err, bytes) {
				if (err) {
					return reject(err);
				}

				resolve(bytes);
			});
		});
	}

	// 
	// Actually hashes the password string using the given/generated salt and
	// iterations values
	// 
	function doHash(password, salt, iterations) {
		return new Promise(function(resolve, reject) {
			crypto.pbkdf2(password, salt, iterations, 64, function(err, hash) {
				if (err) {
					return reject(err);
				}

				resolve(hash);
			});
		});
	}
};

// 
// Vaidate a plaintext password as being "secure" enough. If invalid,
// returns a message string. Otherwise, returns undefined.
// 
// @param {password} the password
// @return string
// 
UserSchema.statics.validatePassword = function(password) {
	if (password.length < 8) {
		return 'Password must be at least 8 characters long';
	}
};

// 
// Serializes a user object, readying it to be sent to the client
// 
// @param {obj} the user object
// @return object
// 
UserSchema.statics.serialize = function(obj) {
	if (obj.toObject) {
		obj = obj.toObject();
	}

	// Never send down passwords
	delete obj.password;

	return obj;
};

// 
// Updates the user's password
// 
// @param {password} the new password
// @return promise
// 
UserSchema.methods.setPassword = function(password) {
	var user = this;

	return UserSchema.statics.hashPassword(password)
		.then(function(password) {
			user.password.hash = pass.hash;
			user.password.salt = pass.salt;
			user.password.iterations = pass.iterations;
		});
};


