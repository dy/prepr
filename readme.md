> Preprocess any string in C/GLSL-preprocessor fashion.

[![npm install prepr](https://nodei.co/npm/prepr.png?mini=true)](https://npmjs.org/package/prepr/)

```js
var prepr = require('prepr');

prepr(`
	#define A 2;

	#ifdef A
	var a = A;
	#endif

	#if __LINE__ > 40
	//too far
	#elif __LINE__ < 10
	//too close
	#else
	//about right
	#endif

	var b = myVar;
	var c = myMacro('xyz');
`, {
	//remove processed directives from source
	remove: true,

	//custom macros
	define: {
		myVar: 1,
		myMacro: function (arg) { return arg; }
	},

	//custom directives
	directives: {
		extension: function (arg) {
			registerExtension(arg);
			return '';
		}
	}
});

// ↓

`
var a = 2;

//about right

var b = 1;
var c = 'xyz';
`
```

The primary purpose is to preprocess code for [glsl-transpiler](https://github.com/stackgl/glsl-transpiler), so some [C-preprocessor](https://gcc.gnu.org/onlinedocs/cpp/index.html#Top) functionality is absent, but the project is welcome to forks and PRs.