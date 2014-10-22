
var models     = require('dagger.js/lib/models');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var conf       = require('dagger.js/lib/conf');
var when       = require('dagger.js/node_modules/when');

var Document   = models.require('document').model;
var Commit     = models.require('commit').model;

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
						query.or([
							{owner: req.auth.user._id},
							{collaborators: req.auth.user._id},
							{public: true}
						]);
					}
				});
			})
			.then(function(docs) {
				req.respond(200, docs.map(Document.serialize.bind(Document, req.auth)));
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

				req.respond(200, Document.serialize(req.auth, doc));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// POST /documents
	// 
	"post": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				req.body.owner = req.auth.user._id;

				delete req.body.created;
				delete req.body.updated;
				delete req.body.mainRevision;
				delete req.body.starredBy;

				return Document.create(req.body);
			})
			.then(function(doc) {
				req.respond(201, Document.serialize(req.auth, doc));
			})
			.catch(
				HttpError.catch(req)
			);
	},

// --------------------------------------------------------

	// 
	// GET /documents/:id/commits/:commit
	// 
	"get /:id/commits/:commit": function(req) {
		var document;
		var commit;

		req.auth.allow(req.auth.user)
			.then(function() {
				return when.all([
					Document.findById(req.params.id).exec(),
					Commit.findById(req.params.commit).exec()
				]);
			})
			.then(function(results) {
				document = results[0];
				commit = results[1];
			})
			.then(function() {
				if (! document.permissions(req.auth.user)) {
					throw new HttpError(401, 'Not authorized');
				}

				if (! commit.document.equals(req.params.id)) {
					throw new HttpError(404, 'Could not find commit "' + req.params.commit +
						'" for document "' + req.params.id + '"');
				}

				req.respond(200, Commit.serialize(commit));
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// POST /documents/:id/commits
	// 
	"post /:id/commits": function(req) {
		var doc, commit;

		req.auth.allow(req.auth.user)
			.then(function() {
				if (req.body.delta) {
					if (! Array.isArray(req.body.delta)) {
						throw new HttpError(400, 'Delta must be an array');
					}
				}

				else if (req.body.source) {
					if (req.body.source !== 'draft') {
						throw new HttpError(400, 'If defined, source must be "draft"');
					}
				}

				else {
					throw new HttpError(400, 'No commit changeset given');
				}

				return Document.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (doc.permissions(req.auth.user) !== 'owner') {
					throw new HttpError(401, 'Not authorized');
				}

				if (req.body.delta) {
					return doc.addCommit(req.body.message, req.body.delta);
				}

				if (req.body.source === 'draft') {
					return doc.commitDraft(req.body.message);
				}
			})
			.then(function(commitId) {
				req.respond(200, {
					message: 'Committed successfully',
					commit: commitId
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /documents/:id/commits/:commit
	// 
	// Deletes all commits *after* the given commit, reverting back to that version
	// 
	"delete /:id/commits/:commit": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				return Document.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (doc.permissions(req.auth.user) !== 'owner') {
					throw new HttpError(401, 'Not authorized');
				}

				return doc.revert(req.body.commit);
			})
			.then(function(doc) {
				req.respond(200, Document.serialize(req.auth, doc));
			})
			.catch(
				HttpError.catch(req)
			);
	},

// --------------------------------------------------------

	// 
	// POST /documents/:id/draft
	// 
	"post /:id/draft": function(req) {
		var doc;
		var delta = req.body.delta;

		req.auth.allow(req.auth.user)
			.then(function() {
				if (! Array.isArray(delta)) {
					throw new HttpError(400, 'Delta must be an array');
				}

				return Document.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (doc.permissions(req.auth.user) !== 'owner') {
					throw new HttpError(401, 'Not authorized');
				}

				doc.draft = {
					created: Date.now(),
					updated: Date.now(),
					ops: delta
				};

				return when.saved(doc);
			})
			.then(function() {
				req.respond(200, {
					message: 'Draft saved successfully'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// PUT|PATCH /documents/:id/draft
	// 
	"put|patch /:id/draft": function(req) {
		var doc;
		var delta = req.body.delta;

		req.auth.allow(req.auth.user)
			.then(function() {
				if (! Array.isArray(delta)) {
					throw new HttpError(400, 'Delta must be an array');
				}

				return Document.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (doc.permissions(req.auth.user) !== 'owner') {
					throw new HttpError(401, 'Not authorized');
				}

				doc.draft = {
					created: doc.draft.created || Date.now(),
					updated: Date.now(),
					ops: delta
				};

				return when.saved(doc);
			})
			.then(function() {
				req.respond(200, {
					message: 'Draft saved successfully'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /documents/:id/draft
	// 
	"delete /:id/draft": function(req) {
		var doc;

		req.auth.allow(req.auth.user)
			.then(function() {
				return Document.findById(req.params.id).exec();
			})
			.then(function(_doc) { doc = _doc; })
			.then(function() {
				if (doc.permissions(req.auth.user) !== 'owner') {
					throw new HttpError(401, 'Not authorized');
				}

				doc.draft = {
					created: null,
					updated: null,
					ops: [ ]
				};

				return when.saved(doc);
			})
			.then(function() {
				req.respond(200, {
					message: 'success'
				});
			})
			.catch(
				HttpError.catch(req)
			);
	},

// --------------------------------------------------------

	// 
	// POST /documents/:id/star
	// 
	// Stars the document as the current user
	// 
	"post /:id/star": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				var query = {
					_id: req.params.id,
					'starredBy.user': {$ne: req.auth.user._id}
				};
				return Document.update(query, {
					$push: {
						starredBy: {user: req.auth.user._id}
					}
				}).exec();
			})
			.then(function() {
				req.respond(200, { message: 'success' });
			})
			.catch(
				HttpError.catch(req)
			);
	},

	// 
	// DELETE /documents/:id/star
	// 
	// Unstars the document as the current user
	// 
	"delete /:id/star": function(req) {
		req.auth.allow(req.auth.user)
			.then(function() {
				return Document.update({ _id: req.params.id }, {
					$pull: {
						starredBy: {user: req.auth.user._id}
					}
				}).exec();
			})
			.then(function() {
				req.respond(200, { message: 'success' });
			})
			.catch(
				HttpError.catch(req)
			);
	},

// --------------------------------------------------------

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
					req.respond(200, docs.map(Document.serialize.bind(Document, req.auth)));
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
					req.respond(200, Document.serialize(req.auth, doc));
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
