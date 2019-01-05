/**
 * Preprocess in C-preprocessor fashion
 * @module  prepr
 */

var paren = require('parenthesis');
var balanced = require('balanced-match');
var extend = require('xtend/mutable');
var escaper = require('escaper');


/**
 * Main processing function
 */
function preprocess (what, how) {
	var result = '';
	var source = what + '';

	//defined macros
	//FIXME: provide real values here
	var macros = extend({
		__LINE__: 0,
		__FILE__: '_',
		__VERSION__: 100,
		defined: function (arg) {
			return [].slice.call(arguments).every(function (arg) {
				return macros[arg] != null;
			});
		}
	}, how);

	return process(source);


	//process chunk of a string by finding out macros and replacing them
	function process (str) {
		if (!str) return '';

		var arr = [];

		var chunk = str;

		//find next directive, get chunk to process before it
		var directive = /#[A-Za-z0-9_$]+/ig.exec(str);

		//get chunk to process - before next call
		if (directive) {
			chunk = chunk.slice(0, directive.index);
			str = str.slice(directive.index);
		}


		//escape bad things
		chunk = escape(chunk, arr);

		//replace all defined X to defined (X)
		chunk = chunk.replace(/\bdefined\s*([A-Za-z0-9_$]+)/g, 'defined($1)');

		//for each registered macro do it’s call
		for (var name in macros) {
			//fn macro
			if (macros[name] instanceof Function) {
				chunk = processFunction(chunk, name, macros[name]);
			}
		}

		chunk = escape(chunk, arr);

		//for each defined var do replacement
		for (var name in macros) {
			//value replacement
			if (!(macros[name] instanceof Function)) {
				chunk = processDefinition(chunk, name, macros[name]);
			}
		}

		chunk = unescape(chunk, arr);


		//process directive
		if (directive) {
			if (/^#def/.test(directive[0])) {
				str = define(str);
			}
			else if (/^#undef/.test(directive[0])) {
				str = undefine(str);
			}
			else if (/^#if/.test(directive[0])) {
				str = processIf(str);
			}
			else if (/^#line/.test(directive[0])) {
				var data = /#[A-Za-z0-9_]+\s*([-0-9]+)?[^\n]*/.exec(str);
				macros.__LINE__ = parseInt(data[1]);
				str = str.slice(data.index + data[0].length);
			}
			else if (/^#version/.test(directive[0])) {
				var data = /#[A-Za-z0-9_]+\s*([-0-9]+)?[^\n]*/.exec(str);
				macros.__VERSION__ = parseInt(data[1]);
				str = str.slice(data.index + data[0].length);
			}
			else {
				//drop directive line
				var directiveDecl = /\n/m.exec(str);
				chunk += str.slice(0, directiveDecl.index) + '\n';
				str = str.slice(directiveDecl.index)
			}

			return chunk + process(str);
		}

		return chunk;
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
				var args = parts[argsPartIdx].trim();
				if (args.length) {
					args = args.split(/\s*,\s*/);
					args = args.map(function (arg) {
						var argParts = parts.slice();
						argParts[0] = arg;
						return paren.stringify(argParts, {flat: true, escape: '___'});
					}).map(function (arg) {
						return arg;
					});
				} else {
					args = [];
				}

				if (args.length != fn.length) throw Error(`macro "${name}" requires ${fn.length} arguments, but ${args.length} given`);

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
		return escaper.replace(str, true, arr)
	}

	function unescape (str, arr) {
		if (!arr || !arr.length) return str

		return escaper.paste(str, arr)
	}



	//register macro, #define directive
	function define (str) {
		var data = /#[A-Za-z]+[ ]*([A-Za-z0-9_$]*)(?:\(([^\(\)]*)\))?[ \r]*([^\n]*)$/m.exec(str);
		str = str.slice(data.index + data[0].length);

		var name = data[1];
		var args = data[2];
		var value = data[3] || true;

		if (!name || !value) throw Error(`Macro definition "${data[0]}" is malformed`);

		//register function macro
		//#define FOO(A, B) (expr)
		if (args != null) {
			if (args.trim().length) {
				args = args.split(/\s*,\s*/);
			}
			else {
				args = [];
			}

			function fn () {
				var result = value;

				//for each arg - replace it’s occurence in `result`
				for (var i = 0; i < args.length; i++) {
					result = processDefinition(result, args[i], arguments[i]);
				}

				result = process(result);

				return result;
			};
			Object.defineProperty(fn, 'length', {
				value: args.length
			});

			macros[name] = fn;
		}

		//register value macro
		//#define FOO insertion
		//#define FOO (expr)
		else {
			macros[name] = value;
		}

		return str;
	}

	//unregister macro, #undef directive
	function undefine (str) {
		var data = /#[A-Za-z0-9_]+[ ]*([A-Za-z0-9_$]+)/.exec(str);
		delete macros[data[1]];

		return str.slice(data.index + data[0].length);
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
		var matchElse = balanced('#if', '#else', str)
		if (matchElse && matchElse.end <= match.end) {
			elseBody = matchElse.post.slice(matchElse.post.indexOf('\n'), -match.post.length - 6);
			body = matchElse.body;
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
