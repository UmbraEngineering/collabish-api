
module.exports = {
	
	output: {
		errorStacks: true
	},

	http: {
		port: 3000
	},

	ws: {
		store: 'memory'
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
