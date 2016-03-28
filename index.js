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
		__LINE__: 0,
		__FILE__: '',
		__VERSION__: 100
	};


	var chunk, nextDirective;

	//process everything which is before the next directive
	while (nextDirective = /#([a-z0-9_]+)\s*(.*)/ig.exec(source)) {
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
		//hide comments
		var comments = [];
		str = str.replace(/\/\/[^\n]*$/mg, function (match) {
			return '___comment' + comments.push(match);
		});
		str = str.replace(/\/\*([^\*]|[\r\n]|(\*+([^\*\/]|[\r\n])))*\*+\//g, function (match) {
			return '___comment' + comments.push(match);
		});

		//for each registered macro - find it’s mention in the code and make replacement
		for (var name in macros) {
			//fn macro
			if (macros[name] instanceof Function) {
				var parts = paren(str, {
					flat: true,
					brackets: '()',
					escape: '___'
				});

				var re = new RegExp(name + '\\s*\\(___([0-9]+)\\)');

				str = processParens(parts[0]);

				//process list of cross-referenced parentheses
				function processParens (str) {
					var data;

					//if there is a macro call in str - insert it’s arguments, do call
					if (data = re.exec(str)) {
						var args = parts[data[1]];
						args = args.split(/\s*,\s*/);
						args = args.map(processParens);
						var res = macros[name](args);

						var restParts = parts.slice();
						restParts[0] = processParens(str.slice(data.index + data[0].length));

						var rest = paren.stringify(restParts, {flat: true, escape: '___'});

						return str.slice(0, data.index) + res + rest;
					}

					//else - just unwrap string
					else {
						var restParts = parts.slice();
						restParts[0] = str;

						return paren.stringify(restParts, {flat: true, escape: '___'});
					}
				};
			}
			//value replacement
			else {
				var re = new RegExp(name, 'g');
				str = str.replace(re, function (match, idx, str) {
					return macros[name];
				});
			}
		}


		//unhide comments
		comments.forEach(function (value, i) {
			str = str.replace('___comment' + (i+1), value);
		});

		return str;
	}

	//register macro, #define directive
	function define (str) {
		var data = /([a-z0-9_]*)(?:\(([^\(\)]*)\))?/i.exec(str);
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


			// 	//replace each stringified arg as is
			// 	value = value.replace(new RegExp(`#${name}`, 'g'), '\' + \'"' + name + '"\' + \'');

			// 	//replace each simple name notion
			// 	value = value.replace(new RegExp(`\\b${name}\\b`, 'g'), '\' + ' + name + ' + \'');



			// 	return `var ${name} = arguments[${pos}] || '';`;
			// });

			macros[name] = function (argValues) {
				var result = value;

				var strings = [];
				//Escape strings
				result = result.replace(/\'[^']*\'/g, function (match) {
					return '×' + strings.push(match);
				});
				result = result.replace(/\"[^"]*\"/g, function (match) {
					return '×' + strings.push(match);
				});
				result = result.replace(/\`[^`]*\`/g, function (match) {
					return '×' + strings.push(match);
				});

				//for each arg - replace it’s occurence in `result`
				for (var i = 0; i < args.length; i++) {
					//FIXME: probably we have to ignore within-tokens replacements like aXbc
					result = result.replace(new RegExp(`${args[i]}`, 'g'), function (match) {
						return match;
					});
				}


				//unescape strings
				strings.forEach(function (rep, i) {
					result = result.replace('×' + (i+1), rep);
				});

				return process(result);
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