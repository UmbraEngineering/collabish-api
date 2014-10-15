
var models  = require('dagger.js/lib/models');
var when    = require('dagger.js/node_modules/when');

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

// 
// Get star counts for the given documents
// 
// @param {ids} a list of document ids
// @return promise
// 
ActivitySchema.static.countStarsFor = function(ids) {
	var deferred = when.defer();

	var query = [
		{$match: {
			'recentlyStarred.document': (Array.isArray(ids) ? {$in: ids} : ids)
		}},
		{$unwind: '$recentlyStarred'},
		{$match: {
			'recentlyStarred.document': (Array.isArray(ids) ? {$in: ids} : ids)
		}},
		{$group: {
			_id: '$recentlyStarred.document',
			count: {$sum: 1}
		}}
	];

	this.aggregate(query, function(err, results) {
		if (err) {
			return deferred.reject(err);
		}

		deferred.resolve(results);
	});

	return deferred.promise;
};
