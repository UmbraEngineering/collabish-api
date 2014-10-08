
var http        = require('http');
var nodemailer  = require('nodemailer');
var templates   = require('./templates');
var Promise     = require('promise-es6').Promise;

// 
// Create an email transport
// 
var transport = nodemailer.createTransport({
	service: 'Gmail',
	auth: {
		user: process.env.GMAIL_USER + '@gmail.com',
		pass: process.env.GMAIL_PASS
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
		opts.data = opts.data || { };

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

// 
// 
// 
exports.sendSMS = function(opts) {
	return new Promise(function(resolve, reject) {
		var req = http.request(process.env.BLOWERIO_URL + '/messages', function(res) {
			if (res.statusCode < 400) {
				return resolve();
			}

			var data = '';
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				reject(data);
			});
		});

		req.write(JSON.stringify({
			to: opts.to,
			message: opts.message
		}));

		req.on('error', function(err) {
			reject(err);
		});
	});
};
