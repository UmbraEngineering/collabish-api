
var validate  = require('mongoose-validator');
var models    = require('dagger.js/lib/models');

var ObjectId  = models.types.ObjectId;

// var Document  = models.require('document').model;
models.require('document');


// 
// Define the Revision schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Revision', RevisionSchema)`)
// as that is handled automatically by dagger's model module.
// 
var RevisionSchema = module.exports = new models.Schema({
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
	content: { type: String },
	public: { type: Boolean, default: false },
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now },
	document: { type: ObjectId, ref: 'document' }
});

// 
// Update the {updated} field anytime the model is changed
// 
RevisionSchema.pre('save', function(done) {
	this.updated = Date.now();
	Document.findByIdAndUpdate(this.document, {$set: {updated: Date.now()}}, function() {
		done();
	});
});
