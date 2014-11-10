
var sanitizeHtml  = require('sanitize-html');
var validate      = require('mongoose-validator');
var models        = require('dagger.js/lib/models');

var Mixed     = models.types.Mixed;
var ObjectId  = models.types.ObjectId;

models.require('user');
models.require('document');


// 
// Define the Comment schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Comment', CommentSchema)`)
// as that is handled automatically by dagger's model module.
// 
var CommentSchema = module.exports = new models.Schema({
	document: { type: ObjectId, ref: 'document' },
	author: { type: ObjectId, ref: 'user' },
	content: [{
		_id: false,
		insert: { type: String },
		attributes: { type: Mixed }
	}],
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now }
});
