
var sanitizeHtml  = require('sanitize-html');
var validate      = require('mongoose-validator');
var models        = require('dagger.js/lib/models');

var ObjectId = models.types.ObjectId;

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
	content: {
		type: String,
		required: true,
		validate: [
			validate({
				validator: 'isLength',
				arguments: [ 1, 4000 ],
				message: 'Must be between 1 and 4000 characters in length'
			})
		]
	},
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now }
});

// 
// Make sure comment contents are clean before storing
// 
CommentSchema.pre('save', function(next) {
	this.content = sanitizeHtml(this.content, {
		allowTags: ['b', 'i', 's', 'u', 'a', 'span', 'div'],
		allowedAttributes: {
			'div': ['class', 'style', 'id'],
			'span': ['style'],
			'a': ['href']
		}
	});

	this.updated = Date.now();

	next();
});
