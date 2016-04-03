> Preprocess any string in C/GLSL-preprocessor fashion.

[![npm install prepr](https://nodei.co/npm/prepr.png?mini=true)](https://npmjs.org/package/prepr/)

```js
var prepr = require('prepr');

prepr(`
	#define A 2;

	#ifdef A
	var a = A;
	#endif

	#if A > 40
	//too far
	#elif A < 1
	//too close
	#else
	//about right
	#endif

	var b = myVar;
	var c = myMacro('xyz');
`, {
	myVar: 1,
	myMacro: function (arg) { return arg; }
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

## Related

* [compile-js-like-c](https://github.com/ParksProjets/compile-js-like-c) — another C preprocessor for js.