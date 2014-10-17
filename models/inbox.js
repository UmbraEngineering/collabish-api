
var models = require('dagger.js/lib/models');

var ObjectId = models.types.ObjectId;

models.require('user');
models.require('notification');


// 
// Define the Inbox schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Inbox', InboxSchema)`)
// as that is handled automatically by dagger's model module.
// 
var InboxSchema = module.exports = new models.Schema({
	user: { type: ObjectId, ref: 'user' },
	notifications: [{ type: ObjectId, ref: 'notification' }]
});

// 
// Fetch a user's inbox
// 
// @param {userId} the user to find
// @return promise
// 
InboxSchema.statics.findByUser = function(userId) {
	return Inbox.findOne({ user: userId }).exec();
};
