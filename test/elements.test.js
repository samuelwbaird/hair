// element functions, created on demand from the elements proxy
import { root } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as h from '../hair.js';

test('any tag name gives a function for that element', () => {
	const parent = root();
	const { section, progress, details, summary } = h.elements;
	h.render(parent, {}, () => section([progress({ max: 10, value: 5 }), details(summary('more'))]));
	assert.equal(parent.innerHTML, '<section><progress max="10" value="5"></progress><details><summary>more</summary></details></section>');
});

test('custom element names can be used with bracket access', () => {
	const parent = root();
	const myWidget = h.elements['my-widget'];
	h.render(parent, {}, () => myWidget('content'));
	assert.equal(parent.innerHTML, '<my-widget>content</my-widget>');
});

test('element functions match element', () => {
	assert.deepEqual(h.elements.div({ id: 'x' }, 'text'), h.element('div', { id: 'x' }, 'text'));
});

test('the same function is returned for each access to a tag', () => {
	assert.equal(h.elements.div, h.elements.div);
	assert.notEqual(h.elements.div, h.elements.span);
});

test('elements is not mistaken for a promise', async () => {
	assert.equal(h.elements.then, undefined);
	assert.equal(await Promise.resolve(h.elements), h.elements);
});

test('symbol keys are not treated as tags', () => {
	assert.equal(h.elements[Symbol.iterator], undefined);
	assert.equal(h.elements[Symbol.toPrimitive], undefined);
	assert.doesNotThrow(() => inspect(h.elements));
});
