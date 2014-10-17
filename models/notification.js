
var models = require('dagger.js/lib/models');


// 
// Define the Notification schema
// 
// There is no need to create the actual model here (eg. `mongoose.model('Notification', NotificationSchema)`)
// as that is handled automatically by dagger's model module.
// 
var NotificationSchema = module.exports = new models.Schema({
	subject: { type: String },
	message: { type: String },
	link: { type: String },
	read: { type: Boolean }
});
