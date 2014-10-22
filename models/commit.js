
var models = require('dagger.js/lib/models');

var Mixed     = models.types.Mixed;
var ObjectId  = models.types.ObjectId;

models.require('document');

// 
// Define the Commit schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Commit', CommitSchema)`)
// as that is handled automatically by dagger's model module.
// 
var CommitSchema = module.exports = new models.Schema({
	document: { type: ObjectId, ref: 'document' },
	message: { type: String, required: true },
	created: { type: Date, default: Date.now },
	ops: [{ type: Mixed }]
});
