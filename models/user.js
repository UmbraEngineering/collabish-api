
var crypto   = require('crypto');
var conf     = require('dagger.js/lib/conf');
var models   = require('dagger.js/lib/models');
var Promise  = require('promise-es6').Promise;


// 
// Define the User schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('User', UserSchema)`)
// as that is handled automatically by dagger's model module.
// 
var UserSchema = module.exports = new models.Schema({
	username: { type: String },
	email: { type: String },
	phone: { type: String },
	password: {
		hash: { type: String },
		salt: { type: String },
		iterations: { type: Number }
	},
	authMethod: { type: String, enum: [ 'password', 'email', 'twostep-email', 'twostep-sms' ] }
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

	return getSalt()
		.then(function(salt) {
			return doHash(password, salt, iterations);
		})
		.then(function(hash) {
			return {
				iterations: iterations,
				salt: salt.toString('hex'),
				hash: hash.toString('hex')
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
