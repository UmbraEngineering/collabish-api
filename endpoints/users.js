
var models     = require('dagger.js/lib/models');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var conf       = require('dagger.js/lib/conf');
var when       = require('dagger.js/node_modules/when');

var User = models.require('user').model;

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
						delete doc.emailConfirmed;
						delete doc.authMethod;
					}

					req.respond(200, doc);
				},
				HttpError.catch(req)
			);
	},

	// 
	// POST /users
	// 
	"post": function(req) {
		req.auth
			.allow(req.auth.isAdmin || ! req.auth.user)
			.then(function() {
				return User.hashPassword(req.body.password);
			})
			.then(function(hash) {
				req.body.password = hash;
				return User.create(req.body);
			})
			.then(function(doc) {
				req.respond(201, User.serialize(doc));
			})
			.catch(HttpError.catch(req));
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
			.catch(HttpError.catch(req));

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
			.catch(HttpError.catch(req));
	}

});
