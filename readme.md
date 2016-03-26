Preprocess any string in [C](https://gcc.gnu.org/onlinedocs/cpp/index.html#Top)/GLSL-preprocessor fashion.

```js
var prepr = require('prepr');

prepr(`
	#define A 2;
	var a = A;
`);

// ↓

`
var a = 2;
`
```
