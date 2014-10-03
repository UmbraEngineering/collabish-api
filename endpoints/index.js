
var pkg        = require('pkg');
var Endpoint   = require('dagger.js/lib/endpoint');
var HttpError  = require('dagger.js/lib/http-meta').HttpError;
var models     = require('dagger.js/lib/models');

var User       = models.require('user').model;

var VERSION = pkg.read(__dirname + '/../package.json').version();

var IndexEndpoint = module.exports = new Endpoint({

	route: '/',
	
	//
	// GET /index
	//
	"get": function(req) {
		req.respond(200, {
			name: 'Collabish API',
			version: VERSION,
			authorization: (req.auth.user && User.serialize(req.auth.user)),
			endpoints: {
				'/': {
					'get': {
						description: 'Displays the root API index'
					}
				},
				'/auth': {
					'post': {
						description: 'Starts the authentication process',
						body: {
							username: 'The username of the user to authenticate',
							password: 'The password for the account, if one is needed'
						}
					}
				},
				'/users': {
					'get /schema': {
						description: 'Displays the schema for the users endpoint'
					},
					'get': {
						description: 'Queries for users in the database',
						queryParams: {
							fields: 'A list of fields to fetch',
							populate: 'A list of fields to be populated',
							filter: 'A mongo query object',
							sort: 'The field(s) to sort the results by',
							offset: 'Number of documents to skip',
							limit: 'Number of documents to return'
						}
					},
					'get /:id': {
						description: 'Fetches a user from the database by the given ID'
					},
					'post': {
						description: 'Creates a new user',
						body: {
							username: 'The new user\'s username',
							email: 'An email address to connect to the account',
							authMethod: 'The auth method to select for the user',
							password: 'The password to assign to the account, if one is needed'
						}
					},
					'put|patch /:id': {
						description: 'Edits a user',
						body: {
							username: 'A new username for the user',
							email: 'A new email address for the user (will require confirmation)',
							authMethod: 'Changes the authMethod for the user. If the method is \'password\' or ' +
								'\'twostep-email\', a password value must be set',
							password: 'A new password for the user (will require confirmation by email)'
						}
					},
					'delete /:id': {
						description: 'Permanantly deletes a user and all related documents'
					}
				}
			}
		});
	}
	
});
