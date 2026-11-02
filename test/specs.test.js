// building specifications and rendering values
import { root } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

test('null and undefined arguments are ignored', () => {
	const parent = root();
	h.render(parent, {}, () => h.div({ class: 'x' }, null, undefined, 'text'));
	assert.equal(parent.innerHTML, '<div class="x">text</div>');
});

test('true and false render nothing (reserved)', () => {
	const parent = root();
	h.render(parent, {}, () => h.div([false && h.span('no'), true, 'yes'], false));
	assert.equal(parent.innerHTML, '<div>yes</div>');
});

test('numbers render as text anywhere in a spec, including 0', () => {
	const parent = root();
	h.render(parent, {}, () => h.div([0, 1, () => 2]));
	assert.equal(parent.textContent, '012');
});

test('empty string renders as an empty text node', () => {
	const parent = root();
	h.render(parent, {}, () => h.p(''));
	assert.equal(parent.querySelector('p').childNodes.length, 1);
});

test('any number of children arguments are kept', () => {
	const parent = root();
	h.render(parent, {}, () => h.div('t', {}, h.span('a'), h.span('b'), h.span('c')));
	assert.equal(parent.innerHTML, '<div>t<span>a</span><span>b</span><span>c</span></div>');
});

test('two property objects throw', () => {
	assert.throws(() => h.div({ a: 1 }, { b: 2 }), /multiple property objects/);
});

test('null or undefined state renders nothing', () => {
	const parent = root();
	let called = false;
	h.render(parent, null, () => { called = true; return h.p('x'); });
	assert.equal(called, false);
	assert.equal(parent.innerHTML, '');
});

test('0 and empty string are valid state', () => {
	const parent = root();
	h.render(parent, {}, () => [h.compose(0, (n) => h.p(n)), h.compose('', (s) => h.p('empty' + s))]);
	assert.equal(parent.innerHTML, '<p>0</p><p>empty</p>');
});
