
var models = require('dagger.js/lib/models');

var ObjectId = models.types.ObjectId;

models.require('user');
models.require('document');


// 
// Define the Activity schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Activity', ActivitySchema)`)
// as that is handled automatically by dagger's model module.
// 
var ActivitySchema = module.exports = new models.Schema({
	user: {
		type: ObjectId,
		ref: 'user',
		required: true,
		index: {unique: true}
	},
	starred: [{ type: ObjectId, ref: 'document' }],
	recentlyStarred: [{
		document: { type: ObjectId, ref: 'document' },
		datetime: { type: Date, default: Date.now }
	}]
});
