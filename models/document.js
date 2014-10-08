
var validate  = require('mongoose-validator');
var models    = require('dagger.js/lib/models');

var ObjectId  = models.types.ObjectId;
var Revision  = models.require('revision').model;


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
	public: { type: Boolean, default: false },
	owner: { type: ObjectId, ref: 'user' },
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now },
	collaborators: [{ type: ObjectId, ref: 'user' }],
	mainRevision: { type: ObjectId, ref: 'revision' }
});

// 
// Get a list of all revisions for this document
// 
// @return promise
// 
DocumentSchema.methods.findRevisions = function() {
	return Revision.find({ document: this._id }).exec();
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

	if (this.owner.equals(user)) {
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


