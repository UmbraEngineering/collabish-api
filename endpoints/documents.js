
var models     = require('dagger.js/lib/models');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var conf       = require('dagger.js/lib/conf');
var when       = require('dagger.js/node_modules/when');

var Document   = models.require('document').model;
var Revision   = models.require('revision').model;

var DocumentsEndpoint = module.exports = new Endpoint({

	route: '/documents',

	// 
	// GET /documents/schema
	// 
	"get /schema": function(req) {
		if (! conf.output.schemaEndpoints) {
			return (new HttpError(404, 'Cannot get ' + req.pathname)).send(req);
		}
		req.respond(200, Document.schemaDescription());
	},

	// 
	// GET /documents
	// 
	"get": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				return Document.findByQuery(req.query, function(query) {
					if (! req.auth.isAdmin) {
						query.$or([
							{owner: req.auth.user._id},
							{collaborators: req.auth.user._id},
							{public: true}
						]);
					}
				});
			})
			.then(function(docs) {
				req.respond(200, docs.map(Document.serialize));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// GET /documents/:id
	// 
	"get /:id": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				var query = Document.findById(req.params.id);
				if (req.query.populate) {
					query.populate(req.query.populate);
				}

				return query.exec()
			})
			.then(function(doc) {
				if (! doc) {
					throw new HttpError(404, 'Document not found');
				}

				if (! doc.permissions(req.auth.user)) {
					throw new HttpError(401, 'Not authorized');
				}

				req.respond(200, Document.serialize(doc));
			})
			.catch(
				HttpError.catch(req)
			);

	},

	// 
	// GET /documents/:id/revisions
	// 
	"get /:id/revisions": function(req) {
		var doc;
		var perms;

		// First, fetch the document so we can be sure it exists and so
		// we can check permissions
		Document.findById(req.params.id).exec()
			.then(function() {
				if (! doc) {
					throw new HttpError(404, 'No such document');
				}

				doc = _doc;
				perms = doc.permissions(req.auth.user._id);

				return req.auth.allow(req.auth.isAdmin || (req.auth.user && perms));
			})
			.then(function() {
				var query = {
					document: doc._id
				};

				// If the only reason the user has permission to the document is
				// because it is public, than the revision must also be public
				if (perms === 'public') {
					query.public = true;
				}

				return Revision.find(query).exec();
			})
			.then(function(revisions) {
				req.respond(200, revisions.map(Revision.serialize));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// POST /documents
	// 
	"post": function(req) {
		// 
		// NOTE: Authorization should be done here
		// 

		Document.create(req.body)
			.then(
				function(doc) {
					req.respond(201, Document.serialize(doc));
				},
				HttpError.catch(req)
			);
	},

	// 
	// PUT/PATCH /documents
	// 
	"put|patch": function(req) {
		var objs = req.body;

		if (! Array.isArray(objs)) {
			return (new HttpError(400, 'Expected an array of objects to update in the body')).send(req);
		}

		// Get only the doc ids
		var ids = objs.map(function(obj) {
			return obj._id;
		});

		// Fetch all of the needed docs
		Document.find({ _id: {$in: ids} }).exec()
			.then(function(docs) {
				if (! docs || docs.length < objs.length) {
					throw new HttpError(404, 'Some documents could not be found');
				}

				// 
				// NOTE: Authorization should be done here
				// 

				objs.forEach(function(obj) {
					var doc = docs.find(function(doc) {
						return doc.id === obj._id;
					});

					doc.set(obj);
				});

				return when.saved(docs);
			})
			.then(
				function(docs) {
					req.respond(200, docs.map(Document.serialize));
				},
				HttpError.catch(req)
			);
	},

	// 
	// PUT/PATCH /documents/:id
	// 
	"put|patch /:id": function(req) {
		Document.findById(req.params.id).exec()
			.then(function(doc) {
				if (! doc) {
					throw new HttpError(404, 'Document not found');
				}

				// 
				// NOTE: Authorization should be done here
				// 

				doc.set(req.body);
				return when.saved(doc);
			})
			.then(
				function(doc) {
					req.respond(200, Document.serialize(doc));
				},
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /documents
	// 
	"delete": function(req) {
		var ids = req.body;
		var ignoreMissing = req.query.ignoreMissing;

		if (! Array.isArray(ids)) {
			return (new HttpError(400, 'Expected an array of ObjectIds')).send(req);
		}

		Document.find({ _id: {$in: ids} }).exec()
			.then(function(docs) {
				if (! ignoreMissing && (! docs || docs.length < ids.length)) {
					throw new HttpError(404, 'Some documents could not be found');
				}

				if (! docs) {
					return when.resolve();
				}

				// 
				// NOTE: Authorization should be done here
				// 

				docs.forEach(function(doc) {
					doc.remove();
				});

				return when.resolve();
			})
			.then(
				function() {
					req.respond(200);
				},
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /documents/:id
	// 
	"delete /:id": function(req) {
		var ignoreMissing = req.query.ignoreMissing;

		Document.findById(req.params.id).exec()
			.then(function(doc) {
				if (! doc) {
					if (ignoreMissing) {
						return when.resolve();
					} else {
						throw new HttpError(404, 'Document not found');
					}
				}

				// 
				// NOTE: Authorization should be done here
				// 

				doc.remove();

				return when.resolve();
			})
			.then(
				function() {
					req.respond(200);
				},
				HttpError.catch(req)
			);
	}

});
