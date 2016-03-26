/**
 * Preprocess in C-preprocessor fashion
 * @module  prepr
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
		//for each registered macro - find it’s mention in the code and make replacement
		for (var name in macros) {
			//fn macro
			if (macros[name] instanceof Function) {
				var re = new RegExp(name + '\\(([^\\)\\(]*)\\)', 'g');
				str = str.replace(re, function (match, args, idx, str) {
					var fnArgs = args.trim();

					if (fnArgs.length) {
						fnArgs = fnArgs.split(/\s*,\s*/);
					} else {
						fnArgs = [];
					}

					return macros[name](fnArgs);
				});
			}
			//value replacement
			else {
				var re = new RegExp(name, 'g');
				str = str.replace(re, function (match, idx, str) {
					return macros[name];
				});
			}
		}

		return str;
	}

	//register macro, #define directive
	function define (str) {
		var data = /([a-z0-9_]*)\s*(?:\(([^\(\)]*)\))?/i.exec(str);
		var name = data[1];
		var args = data[2];

		var value = str.slice(name.length + (args ? args.length : 0)).trim();

		//register function macro
		//#define FOO(A, B) (expr)
		if (args) {
			// args = args.split(/\s*,\s*/).map(function (name, pos) {
			// 	//escape all strings
			// 	var strings = [];

			// 	//FIXME: resolve this double code fragment
			// 	rest = rest.replace(/\'[^']*\'/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});
			// 	rest = rest.replace(/\"[^"]*\"/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});
			// 	rest = rest.replace(/\`[^`]*\`/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});

			// 	//replace each stringified arg as is
			// 	rest = rest.replace(new RegExp(`#${name}`, 'g'), '\' + \'"' + name + '"\' + \'');

			// 	//replace each simple name notion
			// 	rest = rest.replace(new RegExp(`\\b${name}\\b`, 'g'), '\' + ' + name + ' + \'');


			// 	strings.forEach(function (rep, i) {
			// 		rest = rest.replace('×' + (i+1), rep);
			// 	});

			// 	return `var ${name} = arguments[${pos}] || '';`;
			// });

			// name += '()';

			// var fn = new Function(`
			// 	${fnArgs.join('\n ')}

			// 	var result = '${value}';

			// 	var strings = [];
			// 	result = result.replace(/\'[^']*\'/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});
			// 	result = result.replace(/\"[^"]*\"/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});
			// 	result = result.replace(/\\\`[^\`]*\\\`/g, function (match) {
			// 		return '×' + strings.push(match);
			// 	});

			// 	result = this.preprocessDescriptor(result);

			// 	strings.forEach(function (rep, i) {
			// 		result = result.replace('×' + (i+1), rep);
			// 	});

			// 	return result;
			// `);
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



	var str = node.token.data;
		var args = /#\s*([a-z]+)\s*([a-z0-9_]+)(\([^\)]*\))?\s*/i.exec(str);
		var directive = args[1];
		var name = args[2];
		var directiveParams = args[3];




	//apply preprocessor
	if (this.preprocess) {
		if (this.macro.hasOwnProperty(str)) {
			str = this.macro[str].call(this);
		}
	}


	//apply preprocessor
	if (this.preprocess) {
		if (this.macro.hasOwnProperty(callName + '()')) {
			var params = args.map(function (node) {
				if (node.type === 'ident') return node.data;
				return this.process(node);
			}, this);
			var res = this.macro[callName + '()'].apply(this, params);
			return Descriptor(res, callName);
		}
	}
}


module.exports = preprocess;