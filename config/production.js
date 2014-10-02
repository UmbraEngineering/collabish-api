
module.exports = {
	
	output: {
		errorStacks: false
	},

	http: {
		port: process.env.PORT
	},
	
	redis: {
		enabled: false,
		url: process.env.REDISCLOUD_URL,
		channel: 'dagger',
	},

	mongodb: {
		url: process.env.MONGOHQ_URL
	}

};
