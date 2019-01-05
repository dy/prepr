var test = require('tape');
var prepr = require('./');
var clean = require('cln');
var assert = require('assert');

test('Object macros', function (t) {
	t.equal(clean(prepr(`
		#define QUATRE FOUR
		#define FOUR 4
		int x = QUATRE;
		#undef FOUR
		int y = QUATRE;
		#define FOUR 16
		int z = QUATRE;
	`)), clean(`
		int x = 4;
		int y = FOUR;
		int z = 16;
	`));

	t.equal(clean(prepr(`
		#define NUMBERS 1, \
						2, \
						3
		int x[] = { NUMBERS };
	`)), clean(`
		int x[] = { 1, 2, 3 };
	`))
	t.end()
});

test.skip('Define case #4', function (t) {
	console.log(clean(prepr(`
		#define THING
		#ifdef THING
		123;
		#end
	`)))

	t.end()
})


test('Function macros', function (t) {
	t.equal(clean(prepr(`
		#define lang_init()  c_init()
		int x = lang_init();
		int y = lang_init;
		#undef lang_init
		int z = lang_init();
	`)), clean(`
		int x = c_init();
		int y = lang_init;
		int z = lang_init();
	`));

	t.equal(clean(prepr(`
		#define lang_init ()    c_init()
		lang_init()
	`)), clean(`
		() c_init()()
	`));
	t.end()
});

test('Macro: Fn call', function (t) {
	t.equal(clean(prepr(`
		#define min(X, Y)  ((X) < (Y) ? (X) : (Y))
		x = min(a, b);
		y = min(1, 2);
		z = min(a + 28, p);
	`)), clean(`
		x = ((a) < (b) ? (a) : (b));
		y = ((1) < (2) ? (1) : (2));
		z = ((a + 28) < (p) ? (a + 28) : (p));
	`));
	t.end()
})

test('Macro: Nested fn', function (t) {
	t.equal(clean(prepr(`
		#define min(X, Y)  ((X) < (Y) ? (X) : (Y))
		min (min (a, b), c);
	`)), clean(`
		((((a) < (b) ? (a) : (b))) < (c) ? (((a) < (b) ? (a) : (b))) : (c));
	`));
	t.end()
});

test('Macro: Empty arg', function (t) {
	t.equal(clean(prepr(`
		#define min(X, Y)  ((X) < (Y) ? (X) : (Y))
		min(, b);
		min(a, );
		min(,);
		min((,),);
	`)), clean(`
		(() < (b) ? () : (b));
		((a) < () ? (a) : ());
		(() < () ? () : ());
		(((,)) < () ? ((,)) : ());
	`));
	t.end()
})

test('Macro: Throw bad args errors', function (t) {
	t.throws(function () {
		prepr(`
			#define min(X, Y)  ((X) < (Y) ? (X) : (Y))
			min();
		`);
		//macro "min" requires 2 arguments, but only 1 given
	});

	t.throws(function () {
		prepr(`
			#define min(X, Y)  ((X) < (Y) ? (X) : (Y))
			min(,,)
		`);
		//macro "min" passed 3 arguments, but takes just 2
	});
	t.end()
})

test('Macro: ignore strings', function (t) {
	t.equal(clean(prepr(`
		#define foo(x) x, "x"
		foo(bar);
	`)), clean(`
		bar, "x";
	`));
	t.end()
});

test('Multiline example', function (t) {
	t.equal(clean(prepr(`
		#define WARN_IF(EXP) \
		do { if (EXP) \
			fprintf (stderr, "Warning: " #EXP "!"); } \
		while (0)
		WARN_IF (x == 0);
	`)), clean(`
		do { if (x == 0) fprintf (stderr, "Warning: " "x == 0" "!"); } while (0);
	`));
	t.end()
});

test('Nested stringification', function (t) {
	t.equal(clean(prepr(`
	#define xstr(s) str(s)
	#define str(s) #s
	#define foo 4
	str (foo);
	xstr (foo);
	`)), clean(`
	"foo";
	"4";
	`));
	t.end()
});

test('Concatenation', function (t) {
	t.equal(clean(prepr(`
		#define COMMAND(NAME)  { #NAME, NAME ## _command }
		struct command =
		{
			COMMAND (quit),
			COMMAND (help),
		};
	`)), clean(`
		struct command =
		{
			{ "quit", quit_command },
			{ "help", help_command },
		};
	`));

	t.equal(clean(prepr(`
		#define COMMAND(NAME)  { #NAME, command_ ## NAME }
		struct command =
		{
			COMMAND (quit),
			COMMAND (help),
		};
	`)), clean(`
		struct command =
		{
			{ "quit", command_quit },
			{ "help", command_help },
		};
	`));
	t.end()
});

test.skip('FIXME Variadic macros', function (t) {
	t.equal(clean(prepr(`
		#define eprintf(...) fprintf (stderr, __VA_ARGS__)
		eprintf ("%s:%d: ", input_file, lineno)
	`)), clean(`
		fprintf (stderr, "%s:%d: ", input_file, lineno)
	`));

	// #define eprintf(args...) fprintf (stderr, args) ← replaces VA_ARGS

	// #define eprintf(format, ...) fprintf (stderr, format, __VA_ARGS__)

	// eprintf ("success!\n")
	// ==> fprintf(stderr, "success!\n", );

	// #define eprintf(format, args...) fprintf (stderr, format , ##args)
	t.end()
});

test.skip('FIXME nested macro directives', function (t) {
	// #define f(x) x x
	// f (1
	// #undef f
	// #define f 2
	// f)
	//→ 1 2 1 2
	t.end()
});

test('ifdef', function (t) {
	t.equal(clean(prepr(`
		#ifdef MACRO
		x
		#else
		!x
		#endif /* MACRO */

		#define MACRO true

		#ifdef MACRO
		y
		#endif /* MACRO */

		#undef MACRO
		#ifndef MACRO
		z
		#endif
	`)), clean(`
		!x
		y
		z
	`));
	t.end()
})

test('if', function (t) {
	t.equal(clean(prepr(`
		#if A === 1
		fail
		#endif /* expression */

		#define A 1
		#if A === 1
		a1
		#endif /* expression */

		#define A 2
		#if A === 1
		fail
		#else
		a2
		#endif /* expression */
	`)), clean(`
		a1
		a2
	`));
	t.end()
});

test('nested ifs', function (t) {
	t.equal(clean(prepr(`
		#define X 3

		#if X == 1
		1
		#else /* X != 1 */

		#if X == 2
		2
		#else /* X != 2 */
		!2
		#endif /* X != 2 */

		#endif /* X != 1 */
	`)), clean(`
		!2
	`));

	t.equal(clean(prepr(`
		#define X 3

		#if X != 1

			#if X == 2
			2
			#else
			!2
			#endif

		#else
		1
		#endif
	`)), clean(`
		!2
	`));

	t.equal(clean(prepr(`
		#define X 2

		#if X != 1

			#if X == 2
			2
			#else
			!2
			#endif

		#else
		1
		#endif
	`)), clean(`
		2
	`));
	t.end()
});

test('elif', function (t) {
	t.equal(clean(prepr(`
		#define X 2
		#if X == 1
		1
		#elif X == 2
		2
		#else /* X != 2 and X != 1*/
		3
		#endif /* X != 2 and X != 1*/
	`)), clean(`
		2
	`));
	t.end()
});

test('defined', function (t) {
	t.equal(clean(prepr(`
		#define __ns16000__ 1
		#if defined (__vax__) || defined (__ns16000__)
		1
		#endif

		#define BUFSIZE 0
		#if defined BUFSIZE// && BUFSIZE >= 1024
		2
		#endif
	`)), clean(`
		1
		2
	`));
	t.end()
});

test('else', function (t) {
	t.equal(clean(prepr(`
		#if 0
		text-if-true
		#else /* Not expression */
		text-if-false
		#endif /* Not expression */
	`)), clean(`
		text-if-false
	`));
	t.end()
});



test('#error, #pragma, #extension, #anything', function (t) {
	t.equal(clean(prepr(`
		#error 1
		#pragma a()\
		b()
		#extension all: disable

		#extension name : behaviour

		#pragma optimize(on)

		#pragma STDGL
	`)), clean(`
		#error 1
		#pragma a()\
		b()
		#extension all: disable

		#extension name : behaviour

		#pragma optimize(on)

		#pragma STDGL
	`));
	t.end()
});

test.skip('FIXME: #line, #version', function (t) {
	t.equal(clean(prepr(`
		var a = __LINE__;
		#line 10;
		var b = __LINE__;
		#line -10;
		var c = __LINE__;
		var d = __LINE__;
		var e = __VERSION__;
		#version 440 core;
		var f = __VERSION__;
	`)), clean(`
		var a = 1;
		var b = 11;
		var c = -10;
		var d = -9;
		var e = 100;
		var f = 440;
	`));
	t.end()
});


test.skip('FIXME: Options - readme example', function (t) {
	t.equal(clean(prepr(`
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
		remove: false,

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
	})), clean(`
		#define A 2;

		#ifdef A
	`));
	t.end()
});


test('Undefined directive arg', function (t) {
	t.equal(clean(prepr(`
		#abc
		1;
		2;
		#undefine
		3;
		4;

	`)), clean(`
		#abc
		1;
		2;
		3;
		4;
	`));
	t.throws(function () {
		prepr(`
			#define
			#define\
			123
		`);
	})
	t.end()
});


test('Real use-case', function (t) {
	var src = `
		precision highp int;
		precision highp float;
		precision highp vec2;
		precision highp vec3;
		precision highp vec4;
		#line 0

		#define X(a) Y \
		  asdf \
		  barry

		varying vec2 vTexcoord;
		varying vec3 vPosition;
		uniform mat4 proj, view;

		    attribute vec3 position;
		    attribute vec2 texcoord;

		    void main(){
		        vTexcoord = texcoord;
		        vPosition = position;
		        gl_Position = proj * view * vec4(position, 1.0);
		    }
	`;

	var res = `
		precision highp int;
		precision highp float;
		precision highp vec2;
		precision highp vec3;
		precision highp vec4;

		varying vec2 vTexcoord;
		varying vec3 vPosition;
		uniform mat4 proj, view;

		    attribute vec3 position;
		    attribute vec2 texcoord;

		    void main(){
		        vTexcoord = texcoord;
		        vPosition = position;
		        gl_Position = proj * view * vec4(position, 1.0);
		    }
	`

	t.equal(clean(prepr(src)), clean(res));
	t.end()
});


test('Too many comments', function (t) {
	var escaper = require('escaper')
	var src = `
		/* a */
		// b
		// c
		/* d */
		// e
		// f
		// g
		// h
		/* i */
		// j
		// k
		// l
		/* m */
		// n
		// o
		// p
		// q
	`;

	t.equal(clean(prepr(src)), clean(src));
	t.end()
});
