
var auth       = require('../lib/auth');
var models     = require('dagger.js/lib/models');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var conf       = require('dagger.js/lib/conf');
var when       = require('dagger.js/node_modules/when');
var Promise    = require('promise-es6').Promise;

var User      = models.require('user').model;
var Activity  = models.require('activity').model;

var UsersEndpoint = module.exports = new Endpoint({

	route: '/users',

	// 
	// GET /users/schema
	// 
	"get /schema": function(req) {
		if (! conf.output.schemaEndpoints) {
			return (new HttpError(404, 'Cannot get ' + req.pathname)).send(req);
		}
		req.respond(200, User.schemaDescription({
			exclude: ['passwordData.hash', 'passwordData.salt', 'passwordData.iterations']
		}));
	},

	// 
	// GET /users
	// 
	"get": function(req) {
		User.findByQuery(req.query)
			.then(
				function(docs) {
					req.respond(200, docs.map(function(doc) {
						doc = User.serialize(doc);

						if (! req.auth.isAdmin && ! req.auth.is(doc._id)) {
							delete doc.email;
							delete doc.phone;
							delete doc.emailConfirmed;
							delete doc.authMethod;
						}

						return doc;
					}));
				},
				HttpError.catch(req)
			);
	},

	// 
	// GET /users/:id
	// 
	"get /:id": function(req) {
		if (req.params.id === 'me' && req.auth.user) {
			req.params.id = req.auth.user._id;
		}

		var query = User.findById(req.params.id);
		if (req.query.populate) {
			query.populate(req.query.populate);
		}

		query.exec()
			.then(
				function(doc) {
					if (! doc) {
						return (new HttpError(404, 'Document not found')).send(req);
					}

					doc = User.serialize(doc);

					// If the user requested is not the user currently authenticated, strip out
					// any sensitive user data (excluding admins, who can see all data for anyone)
					if (! req.auth.isAdmin && ! req.auth.is(doc._id)) {
						delete doc.email;
						delete doc.phone;
						delete doc.emailConfirmed;
						delete doc.authMethod;
					}

					req.respond(200, doc);
				},
				HttpError.catch(req)
			);
	},

	// 
	// GET /users/exists/:name
	// 
	// Checks if a username/email is already taken; for use as a signup aid
	// 
	"get /exists/:name": function(req) {
		var query = { };
		if (req.params.name.indexOf('@') >= 0) {
			query.email = req.params.name;
		} else {
			query.username = req.params.name;
		}

		User.findOne(query).exec()
			.then(
				function(user) {
					req.respond(200, {
						exists: !! user
					});
				},
				HttpError.catch(req)
			);
	},

	// 
	// GET /users/:id/activity
	// 
	"get /:id/activity": function(req) {
		if (req.params.id === 'me' && req.auth.user) {
			req.params.id = req.auth.user._id;
		}

		req.auth.allow(req.auth.isAdmin || req.auth.is(req.params.id))
			.then(function() {
				return Activity.findOne({ user: req.params.id }).exec();
			})
			.then(function(doc) {
				if (! doc) {
					throw new HttpError(404, 'Document not found');
				}

				req.respond(200, Activity.serialize(doc));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// PATCH /users/:id/activity
	// 
	"patch /:id/activity": function(req) {
		if (req.params.id === 'me' && req.auth.user) {
			req.params.id = req.auth.user._id;
		}

		var query = { user: req.params.id };

		var starUpdate;
		if (req.body.star) {
			var starArray = Array.isArray(req.body.star) ? req.body.star : [req.body.star];
			starUpdate = {
				$addToSet: {
					starred: {$each: starArray},
					recentlyStarred: {
						$each: starArray.map(function(doc) {
							return {document: doc};
						}),
						$sort: {datetime: -1},
						$slice: 5
					}
				}
			};
		}

		var unstarUpdate;
		if (req.body.unstar) {
			unstarUpdate = {
				$pull: {
					starred: Array.isArray(req.body.unstar)
						? { $each: req.body.unstar }
						: req.body.unstar
				}
			};
		}

		req.auth.allow(req.auth.isAdmin || req.auth.is(req.params.id))
			.then(function() {
				if (! starUpdate) {
					return Promise.resolve();
				}

				return new Promise(function(resolve, reject) {
					Activity.update(query, starUpdate, function(err) {
						if (err) {
							return reject(err);
						}

						resolve();
					});
				});
			})
			.then(function() {
				if (! unstarUpdate) {
					return Promise.resolve();
				}

				return new Promise(function(resolve, reject) {
					Activity.update(query, unstarUpdate, function(err) {
						if (err) {
							return reject(err);
						}

						resolve();
					});
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// POST /users
	// 
	"post": function(req) {
		var user;

		req.auth.allow(req.auth.isAdmin || ! req.auth.user)
			.then(function() {
				return User.hashPassword(req.body.password);
			})
			.then(function(hash) {
				req.body.password = hash;

				// Remove things that should not be able to be manually set
				delete req.body.activity;
				delete req.body.emailConfirmed;

				return User.create(req.body);
			})
			.then(function(_user) { user = _user; })
			.then(function() {
				// Create the new user's activity log
				return Activity.create({ user: user._id });
			})
			.then(function(activity) {
				user.activity = activity;
				return when.saved(user);
			})
			.then(function() {
				return auth.multiAuth.confirmEmailStepOne(user._id.toString());
			})
			.then(function() {
				req.respond(201, User.serialize(user));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// PUT/PATCH /users
	// 
	"put|patch": function(req) {
		var data;
		var ignoreMissing = req.query.ignoreMissing;

		req.auth
			.allow(req.auth.isAdmin)
			.then(function() {
				if (! Array.isArray(req.body)) {
					throw new HttpError(400, 'Request body must be an array');
				}

				var ids = [ ];
				
				data = req.body.reduce(function(memo, obj) {
					var id = obj._id;
					delete obj._id;
					ids.push(id);
					memo[id] = obj;

					return memo;
				});

				return User.find({ _id: ids }).exec();
			})
			.then(function(users) {
				if (! ignoreMissing && users.length < req.body.length) {
					throw new HttpError(404, 'Could not find all documents to update; No action taken');
				}

				users.forEach(function(user) {
					user.set(data[user._id.toString()]);
				});

				return when.saved(users);
			})
			.then(function() {
				req.respond(200);
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// PUT/PATCH /users/:id
	// 
	"put|patch /:id": function(req) {
		var doc;
		if (req.params.id === 'me' && req.auth.user) {
			req.params.id = req.auth.user._id;
		}

		req.auth
			.allow(req.auth.isAdmin || req.auth.is(req.params.id))
			.then(function() {
				return User.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (! doc) {
					throw new HttpError(404, 'Document not found');
				}

				if (req.body.password) {
					return doc.setPassword(req.body.password);
				}
			})
			.then(function() {
				delete req.body.password;
				doc.set(req.body);
				return when.saved(doc);
			})
			.then(function(doc) {
				req.respond(200, User.serialize(doc));
			})
			.catch(
				HttpError.catch(req)
			);

	},

	// 
	// DELETE /users
	// 
	"delete": function(req) {
		var ignoreMissing = req.query.ignoreMissing;

		req.auth
			.allow(req.auth.isAdmin)
			.then(function() {
				if (! Array.isArray(req.body)) {
					throw new HttpError(400, 'Request body must be an array');
				}

				return User.find({ _id: req.body }).exec();
			})
			.then(function(users) {
				if (! ignoreMissing && users.length < req.body.length) {
					throw new HttpError(404, 'Could not find all documents to delete; No action taken');
				}

				users.forEach(function(user) {
					user.remove();
				});

				req.respond(200);
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /users/:id
	// 
	"delete /:id": function(req) {
		if (req.params.id === 'me' && req.auth.user) {
			req.params.id = req.auth.user._id;
		}

		var ignoreMissing = req.query.ignoreMissing;

		req.auth
			.allow(req.auth.isAdmin || req.auth.is(req.params.id))
			.then(function() {
				return User.findById(req.params.id).exec()
			})
			.then(function(doc) {
				if (! doc) {
					if (ignoreMissing) {
						return req.respond(200);
					} else {
						throw new HttpError(404, 'Document not found');
					}
				}

				doc.remove();
				req.respond(200);
			})
			.catch(
				HttpError.catch(req)
			);
	}

});
