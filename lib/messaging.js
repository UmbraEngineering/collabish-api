
var nodemailer  = require('nodemailer');
var templates   = require('./templates');
var Promise     = require('promise-es6').Promise;

// 
// Create an email transport
// 
var transport = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		user: '',
		pass: ''
	}
});

// 
// Send an email
// 
// @param {opts} email options
// @return promise
// 
exports.sendEmail = function(opts) {
	return new Promise(function(resolve, reject) {
		var message = {
			to: opts.to,
			from: 'Collabish <noreply@collabish.me>',
			subject: opts.subject,
			html: templates.render(opts.template, opts.data)
		};

		transport.sendMail(message, function(err, info) {
			if (err) {
				return reject(err);
			}

			resolve(info);
		});
	});
};
