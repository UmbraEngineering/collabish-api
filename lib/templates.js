
var fs          = require('fs');
var handlebars  = require('handlebars');

var cache = { };

exports.render = function(template, data) {
	return compileTemplate(template)(data);
};

function compileTemplate(template) {
	if (! cache[template]) {
		cache[template] = fs.readFileSync(__dirname + '/../templates/' + template + '.hbs', 'utf8');
		cache[template] = handlebars.compile(cache[template]);
	}

	return cache[template];
}
