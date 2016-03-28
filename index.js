/**
 * Preprocess in C-preprocessor fashion
 * @module  prepr
 */

var paren = require('parenthesis');


/**
 * Main processing function
 */
function preprocess (what, how) {
	var result = '';
	var source = what + '';

	//defined macros
	//FIXME: provide real values here
	var macros = {
		// __LINE__: 0,
		// __FILE__: '',
		// __VERSION__: 100
	};


	var chunk, nextDirective;

	//process everything which is before the next directive
	while (nextDirective = /#([A-Za-z0-9_$]+)\s*(.*)/ig.exec(source)) {
		chunk = source.slice(0, nextDirective.index);
		result += process(chunk);

		//shorten source
		source = source.slice(nextDirective.index + nextDirective[0].length);

		//process directive
		var directiveName = nextDirective[1];
		if (/^def/.test(directiveName)) {
			define(nextDirective[2]);
		}
		else if (/^undef/.test(directiveName)) {
			undefine(nextDirective[2]);
		}
	}

	//process the remainder
	result += process(source);

	return result;


	//process chunk of a string by finding out macros and replacing them
	function process (str) {
		var arr = [];

		str = escape(str, arr);

		//for each registered macro do it’s call
		for (var name in macros) {
			//fn macro
			if (macros[name] instanceof Function) {
				str = processFunction(str, name, macros[name]);
			}
		}

		str = escape(str, arr);

		//for each defined var do replacement
		for (var name in macros) {
			//value replacement
			if (!(macros[name] instanceof Function)) {
				str = processDefinition(str, name, macros[name]);
			}
		}

		str = unescape(str, arr);

		return str;
	}

	//replace defined macros from a string
	function processFunction (str, name, fn) {
		var arr = [];
		str = escape(str, arr);

		var parts = paren(str, {
			flat: true,
			brackets: '()',
			escape: '___'
		});

		var re = new RegExp(name + '\\s*\\(___([0-9]+)\\)', 'g');

		//replace each macro call with result
		parts = parts.map(function (part) {
			return part.replace(re, function (match, argsPartIdx) {
				//parse arguments
				var args = parts[argsPartIdx];
				args = args.split(/\s*,\s*/);
				args = args.map(function (arg) {
					var argParts = parts.slice();
					argParts[0] = arg;
					return paren.stringify(argParts, {flat: true, escape: '___'});
				}).map(function (arg) {
					return arg;
				});

				//apply macro call with args
				return fn(args);
			});
		});

		str = paren.stringify(parts, {flat: true, escape: '___'});

		str = unescape(str, arr);

		return str;
	}

	//replace defined variables from a string
	function processDefinition (str, name, value) {
		var arr = [];
		str = escape(str, arr);

		//apply concatenation ENTRY ## something → valueSomething
		str = str.replace(new RegExp(`([^#A-Za-z0-9_$]|^)${name}\\s*##\\s*([A-Za-z0-9_$]*)`, 'g'), function (match, pre, post) {
			return pre + value + post;
		});
		str = str.replace(new RegExp(`([A-Za-z0-9_$]*)\\s*##\\s*${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, pre, post) {
			return pre + value + post;
		});

		//replace definition entries
		str = str.replace(new RegExp(`([^#A-Za-z0-9_$]|^)${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, pre, post) {

			//insert definition
			if (macros[value] != null && !(macros[value] instanceof Function)) value = macros[value];

			return pre + value + post;
		});
		//replace stringifications
		str = str.replace(new RegExp(`#${name}([^A-Za-z0-9_$]|$)`, 'g'), function (match, post) {
			return  '"' + value + '"' + post;
		});

		str = unescape(str, arr);

		return str;
	}

	//helpers to escape unfoldable things in strings
	function escape (str, arr) {
		//hide comments
		str = str.replace(/\/\/[^\n]*$/mg, function (match) {
			return '___comment' + arr.push(match);
		});
		str = str.replace(/\/\*([^\*]|[\r\n]|(\*+([^\*\/]|[\r\n])))*\*+\//g, function (match) {
			return '___comment' + arr.push(match);
		});
		//Escape strings
		str = str.replace(/\'[^']*\'/g, function (match) {
			return '___string' + arr.push(match);
		});
		str = str.replace(/\"[^"]*\"/g, function (match) {
			return '___string' + arr.push(match);
		});
		str = str.replace(/\`[^`]*\`/g, function (match) {
			return '___string' + arr.push(match);
		});
		return str;
	}

	function unescape (str, arr) {
		//unescape strings
		arr.forEach(function (rep, i) {
			str = str.replace('___string' + (i+1), rep);
		});

		//unhide comments
		arr.forEach(function (value, i) {
			str = str.replace('___comment' + (i+1), value);
		});
		return str;
	}


	//register macro, #define directive
	function define (str) {
		var data = /([A-Za-z0-9_$]*)(?:\(([^\(\)]*)\))?/i.exec(str);
		var name = data[1];
		var args = data[2];

		var value = str.slice(data[0].length).trim();

		//register function macro
		//#define FOO(A, B) (expr)
		if (args != null) {
			if (args.trim().length) {
				args = args.split(/\s*,\s*/);
			}
			else {
				args = [];
			}

			macros[name] = function (argValues) {
				var result = value;

				//for each arg - replace it’s occurence in `result`
				for (var i = 0; i < args.length; i++) {
					result = processDefinition(result, args[i], argValues[i]);
				}

				result = process(result);

				return result;
			};
		}

		//register value macro
		//#define FOO insertion
		//#define FOO (expr)
		else {
			macros[name] = value;
		}
	}

	//unregister macro, #undef directive
	function undefine (str) {
		var name = /[^\s\(\)]+/.exec(str)[0];
		delete macros[name];
	}
}


module.exports = preprocess;