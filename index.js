/**
 * Preprocess in C-preprocessor fashion
 * @module  prepr
 */

var paren = require('parenthesis');
var balanced = require('balanced-match');
var extend = require('xtend/mutable');

/**
 * Main processing function
 */
function preprocess (what, how) {
	var result = '';
	var source = what + '';

	//defined macros
	//FIXME: provide real values here
	var macros = extend({
		// __LINE__: 0,
		// __FILE__: '',
		__VERSION__: 100,
		defined: function () {
			return [].slice.call(arguments).every(function (arg) {
				return macros[arg] != null;
			});
		}
	}, how);


	var chunk, directive;

	//process everything which is before the next directive
	while (directive = /#([A-Za-z0-9_$]+)\s*(.*)/ig.exec(source)) {
		//insert skipped chunk
		chunk = source.slice(0, directive.index);
		result += process(chunk);

		//shorten source
		source = source.slice(directive.index);

		var directiveName = directive[1];
		var directiveValue = directive[2];

		//process directive
		if (/^def/.test(directiveName)) {
			//FIXME: make define return source
			define(directiveValue);
			source = source.slice(directive[0].length);
		}
		else if (/^undef/.test(directiveName)) {
			//FIXME: make undefine return source
			undefine(directiveValue);
			source = source.slice(directive[0].length);
		}
		else if (/^if/.test(directiveName)) {
			source = processIf(source);
		}
	}

	//process the remainder
	result += process(source);

	return result;


	//process chunk of a string by finding out macros and replacing them
	//FIXME: make process a main entry, calling itself on the rest of file, to parse nested directives eg
	function process (str) {
		var arr = [];

		str = escape(str, arr);

		//replace all defined X to defined (X)
		str = str.replace(/\bdefined\s*([A-Za-z0-9_$]+)/g, 'defined($1)');

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
				return fn.apply(null, args);
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
			return ' ___comment' + arr.push(match);
		});
		str = str.replace(/\/\*([^\*]|[\r\n]|(\*+([^\*\/]|[\r\n])))*\*+\//g, function (match) {
			return ' ___comment' + arr.push(match);
		});
		//Escape strings
		str = str.replace(/\'[^']*\'/g, function (match) {
			return ' ___string' + arr.push(match);
		});
		str = str.replace(/\"[^"]*\"/g, function (match) {
			return ' ___string' + arr.push(match);
		});
		str = str.replace(/\`[^`]*\`/g, function (match) {
			return ' ___string' + arr.push(match);
		});
		return str;
	}

	function unescape (str, arr) {
		//unescape strings
		arr.forEach(function (rep, i) {
			str = str.replace(' ___string' + (i+1), rep);
		});

		//unhide comments
		arr.forEach(function (value, i) {
			str = str.replace(' ___comment' + (i+1), value);
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

			macros[name] = function () {
				var result = value;

				//for each arg - replace it’s occurence in `result`
				for (var i = 0; i < args.length; i++) {
					result = processDefinition(result, args[i], arguments[i]);
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
		var name = /[A-Za-z0-9_$]+/.exec(str)[0];
		delete macros[name];
	}

	//process if/else/ifdef/elif/ifndef/defined
	function processIf (str) {
		var match = balanced('#if', '#endif', str)

		//if no nested ifs - means we are in clause, return as is
		if (!match) return str;

		var body = match.body;
		var post = match.post;
		var elseBody = '';

		//find else part
		var matchElse;
		if (matchElse = /^\s*#else[^\n\r]*$/m.exec(body)) {
			elseBody = body.slice(matchElse.index + matchElse[0].length);
			body = body.slice(0, matchElse.index);
		}

		//ifdef
		if(/^def/.test(body)) {
			body = body.slice(3);
			var nameMatch = /[A-Za-z0-9_$]+/.exec(body);
			var name = nameMatch[0];
			body = body.slice(name.length + nameMatch.index);
			if (macros[name] != null) str = process(body);
			else str = process(elseBody);
		}
		//ifndef
		else if (/^ndef/.test(body)) {
			body = body.slice(4);
			var nameMatch = /[A-Za-z0-9_$]+/.exec(body);
			var name = nameMatch[0];
			body = body.slice(name.length + nameMatch.index);
			if (macros[name] == null) str = process(body);
			else str = process(elseBody);
		}
		//if
		else {
			//split elifs
			var clauses = body.split(/^\s*#elif\s+/m);

			var result = false;

			//find first triggered clause
			for (var i = 0; i < clauses.length; i++) {
				var clause = clauses[i];

				var exprMatch = /\s*(.*)/.exec(clause);
				var expr = exprMatch[0];
				clause = clause.slice(expr.length + exprMatch.index);

				//eval expression
				expr = process(expr);

				try {
					result = eval(expr);
				} catch (e) {
					result = false;
				}

				if (result) {
					str = process(clause);
					break;
				}
			}

			//else clause
			if (!result) {
				str = process(elseBody);
			}
		}


		//trim post till the first endline, because there may be comments after #endif
		var match = /[\n\r]/.exec(post);
		if (match) post = post.slice(match.index);

		return str + post;
	}
}


module.exports = preprocess;