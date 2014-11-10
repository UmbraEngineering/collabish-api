
var Delta      = require('rich-text').Delta;
var validate   = require('mongoose-validator');
var models     = require('dagger.js/lib/models');
var Promise    = require('promise-es6').Promise;
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var when       = require('dagger.js/node_modules/when');

var Mixed      = models.types.Mixed;
var ObjectId   = models.types.ObjectId;
var User       = models.require('user').model;
var Commit     = models.require('commit').model;


// 
// Define the Document schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Document', DocumentSchema)`)
// as that is handled automatically by dagger's model module.
// 
var DocumentSchema = module.exports = new models.Schema({
	name: {
		type: String,
		required: true,
		validate: [
			validate({
				validator: 'isLength',
				arguments: [ 1, 80 ],
				message: 'Must be between 1 and 80 characters in length'
			})
		]
	},
	description: {
		type: String,
		validate: [
			validate({
				validator: 'isLength',
				arguments: [ 0, 200 ],
				message: 'Cannot exceed 200 characters in length'
			})
		]
	},
	public: { type: Boolean, default: false },
	owner: { type: ObjectId, ref: 'user' },
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now },
	collaborators: [{ type: ObjectId, ref: 'user' }],
	adultContent: { type: Boolean, default: false },
	allowComments: { type: Boolean, default: true },
	tags: [{ type: String }],
	starredBy: [{
		user: { type: ObjectId, ref: 'user', index: {unique: true} },
		datetime: { type: Date, default: Date.now }
	}],
	history: [{ type: ObjectId, ref: 'commit' }],
	current: {
		commit: { type: ObjectId, ref: 'commit' },
		composed: { type: Mixed }
	},
	draft: {
		created: { type: Date },
		updated: { type: Date },
		ops: [{ type: Mixed }]
	}
});

// 
// Update the {updated} field anytime the model is changed
// 
DocumentSchema.pre('save', function(done) {
	this.updated = Date.now();
	done();
});

// 
// Add a new commit to the end of the document history
// 
// @param {message} the commit message
// @param {delta} the delta ops
// @return promise
// 
DocumentSchema.methods.addCommit = function(message, delta) {
	var doc = this;

	var commitId, current;
	var commit = {
		document: doc._id,
		message: message,
		ops: delta,
		created: Date.now()
	};

	try {
		if (doc.current) {
			current = new Delta(doc.current.composed);
			current.compose(new Delta(delta));
		} else {
			current = new Delta(delta);
			doc.current = {
				composed: delta
			};
		}
	} catch (err) {
		return Promise.reject(err);
	}
	
	return Commit.create(commit)
		.then(function(commit) {
			commitId = commit._id;

			doc.history.push(commitId);
			doc.current.commit = commitId;
			doc.current.composed = current.ops;

			return when.saved(doc);
		})
		.then(function() {
			return commitId;
		});
};

// 
// Commit the contents of the draft
// 
// @param {message} commit message
// @return promise
// 
DocumentSchema.methods.commitDraft = function(message) {
	var doc = this;
	var delta = doc.draft.ops;

	doc.draft.ops = [ ];
	doc.draft.created = null;
	doc.draft.updated = null;

	return doc.addCommit(message, delta);
};

// 
// Remove all commits after a given point, reverting the state of the document
// 
// @param {commit} the commit to revert to
// 
DocumentSchema.methods.revert = function(commit) {
	var doc = this;
	var index;

	var found = doc.history.some(function(id, i) {
		if (id.equals(commit)) {
			index = i;
			return true;
		}
	});

	if (! found) {
		return when.reject('Commit not found');
	}

	// Remove the history from the doc
	var toRemove = doc.history.slice(found + 1);
	toRemove.forEach(function(commit) {
		doc.history.remove(commit);
	});

	var saveDoc = when.saved(doc);
	var deferred = when.defer();

	// Delete the commits from the database
	Commit.remove({ _id: {$in: toRemove} }, function(err) {
		if (err) {
			return deferred.reject(err);
		}

		deferred.resolve();
	});

	return when.all([ saveDoc, deferred.promise ])
		.then(function(results) {
			var doc = results[0];
			var deferred = when.defer();

			doc.populate('history', function(err, doc) {
				if (err) {
					return deferred.reject(err);
				}

				deferred.resolve(doc);
			});

			return deferred.promise;
		})
		.then(function(doc) {
			// Recompose the current document
			var delta;

			doc.history.forEach(function(commit) {
				if (! delta) {
					delta = new Delta(commit);
				} else {
					delta.compose(new Delta(commit));
				}
			});

			doc.current.commit = doc.history[doc.history.length - 1]._id;
			doc.current.composed = delta.ops;

			return when.saved(doc);
		});
};

// 
// Determine the permissions a given user has for this document
// 
// @param {user} a user object or objectid
// @return string
// 
DocumentSchema.methods.permissions = function(user) {
	if (typeof user === 'object') {
		if (user._id) {
			user = user._id;
		}
		user = user.toString();
	}

	var owner = this.owner && this.owner._id;
	if (owner.equals(user)) {
		return 'owner';
	}

	var isCollaborator = this.collaborators.some(function(collabId) {
		return collabId.equals(user);
	});

	if (isCollaborator) {
		return 'collaborator';
	}

	if (this.public) {
		return 'public';
	}

	return null;
};

// 
// Serialize a document for sending to the client
// 
DocumentSchema.statics.serialize = function(auth, obj) {
	if (obj.toObject) {
		obj = obj.toObject();
	}

	// Determine if the authed user has starred this document
	var userId = auth.user._id;
	obj.isStarred =!! obj.starredBy.filter(function(star) {
		return userId.equals(star.user);
	}).length;

	// Replace the list of stars with a count
	obj.starredBy = (obj.starredBy && obj.starredBy.length) || 0;

	// Serialize the owner/collaborators
	if (typeof obj.owner === 'object') {
		obj.owner = User.serialize(obj.owner);
	}
	if (Array.isArray(obj.collaborators)) {
		obj.collaborators = obj.collaborators.map(function(obj) {
			if (typeof obj === 'object') {
				return User.serialize(obj);
			}
			return obj;
		});
	}

	return obj;
};


