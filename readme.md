> Preprocess any string in C/GLSL-preprocessor fashion.

[![npm install prepr](https://nodei.co/npm/prepr.png?mini=true)](https://npmjs.org/package/prepr/)

```js
var prepr = require('prepr');

prepr(`
	#define A 2;
	var a = A;
	var b = myVar;
	var c = myString('xyz');
`, {
	myVar: 1,
	myMacro: function (arg) { return arg; }
	//...other custom defininitions
});

// ↓

`
var a = 2;
var b = 1;
var c = 'xyz';
`
```

The primary purpose is to preprocess code for [glsl-transpiler](https://github.com/stackgl/glsl-transpiler), so some [C-preprocessor](https://gcc.gnu.org/onlinedocs/cpp/index.html#Top) functionality is absent, but the project is welcome to forks and PRs.