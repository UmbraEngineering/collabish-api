
// Load new relic, but only in production
if (process.env.NODE_ENV === 'production') {
	require('newrelic');
}

require('dagger.js')({

	bootstrap: [
		// 
	],
	
	middleware: [
		// 
	]

});
