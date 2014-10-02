
module.exports = {
	
	output: {
		errorStacks: true
	},

	http: {
		port: 3000
	},
	
	redis: {
		enabled: false,
		url: 'redis://localhost',
		channel: 'dagger',
	},

	mongodb: {
		url: 'mongodb://localhost'
	}

};
