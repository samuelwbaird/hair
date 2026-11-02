// updating existing DOM: ordering, properties, and leaving DOM-owned state alone
import { root, countMoves } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

const { div, p, b, button, input } = h.elements;

test('text keeps its position when an element appears before it', () => {
	const parent = root();
	const state = {};
	let on = false;
	const context = h.render(parent, state, () => p([on ? b('!') : null, 'text']));
	on = true;
	context.update(state);
	assert.equal(parent.innerHTML, '<p><b>!</b>text</p>');
});

test('text nodes are placed in spec order', () => {
	const parent = root();
	const state = {};
	let on = false;
	const context = h.render(parent, state, () => p([on ? 'A' : null, b('x'), 'B']));
	on = true;
	context.update(state);
	assert.equal(parent.innerHTML, '<p>A<b>x</b>B</p>');
});

test('class list replaces only classes from the previous spec', () => {
	const parent = root();
	const state = {};
	let classes = ['a', 'b', 'c'];
	const context = h.render(parent, state, () => div({ class: classes }));
	const element = parent.firstChild;
	element.classList.add('from-dom');
	classes = ['x'];
	context.update(state);
	assert.deepEqual([...element.classList].sort(), ['from-dom', 'x']);
});

test('class accepts space separated names and ignores falsy entries', () => {
	const parent = root();
	h.render(parent, {}, () => div({ class: ['a b', null, false, '', 'c'] }));
	assert.deepEqual([...parent.firstChild.classList], ['a', 'b', 'c']);
});

test('style merges an object, removing keys no longer in the spec', () => {
	const parent = root();
	const state = {};
	let style = { color: 'red', marginTop: '2px' };
	const context = h.render(parent, state, () => div({ style }));
	const element = parent.firstChild;
	element.style.paddingLeft = '3px';
	style = { color: 'blue' };
	context.update(state);
	assert.equal(element.style.color, 'blue');
	assert.equal(element.style.marginTop, '');
	assert.equal(element.style.paddingLeft, '3px');
});

test('an unchanged style is not written again', () => {
	const parent = root();
	const state = {};
	const context = h.render(parent, state, () => div({ style: { opacity: 0 } }));
	parent.firstChild.style.opacity = 1;
	context.update(state);
	assert.equal(parent.firstChild.style.opacity, '1');
});

test('style supports custom properties', () => {
	const parent = root();
	h.render(parent, {}, () => div({ style: { '--accent': 'red' } }));
	assert.equal(parent.firstChild.style.getPropertyValue('--accent'), 'red');
});

test('a property removed from the spec is reset to its default', () => {
	const parent = root();
	const state = {};
	let props = { disabled: true, title: 'tip' };
	const context = h.render(parent, state, () => button('go', props));
	props = {};
	context.update(state);
	// reflected string properties can only be reset to their default (empty) value, not removed
	const element = parent.firstChild;
	assert.equal(element.disabled, false);
	assert.equal(element.title, '');
});

test('an unchanged property is not written again', () => {
	const parent = root();
	const state = {};
	const context = h.render(parent, state, () => input({ value: 'from spec', title: 'tip' }));
	const element = parent.firstChild;
	element.value = 'typed';
	element.title = 'changed by dom code';
	context.update(state);
	assert.equal(element.value, 'typed');
	assert.equal(element.title, 'changed by dom code');
});

test('a changed property is written', () => {
	const parent = root();
	const state = {};
	let value = 'one';
	const context = h.render(parent, state, () => input({ value }));
	value = 'two';
	context.update(state);
	assert.equal(parent.firstChild.value, 'two');
});

test('dataset merges values and removes those no longer in the spec', () => {
	const parent = root();
	const state = {};
	let dataset = { state: 'open', size: 'large' };
	const context = h.render(parent, state, () => div({ dataset }));
	dataset = { state: 'closed' };
	context.update(state);
	assert.equal(parent.innerHTML, '<div data-state="closed"></div>');
});

test('attributes are set and removed explicitly', () => {
	const parent = root();
	const state = {};
	let attributes = { 'aria-describedby': 'help', hidden: true };
	const context = h.render(parent, state, () => div({ attributes }));
	assert.equal(parent.innerHTML, '<div aria-describedby="help" hidden=""></div>');
	attributes = { hidden: false };
	context.update(state);
	assert.equal(parent.innerHTML, '<div></div>');
});

test('elements are matched by key rather than position', () => {
	const parent = root();
	const state = {};
	let showFirst = true;
	const context = h.render(parent, state, () => [
		showFirst ? input(h.key('first')) : null,
		input(h.key('second')),
	]);
	const second = parent.children[1];
	second.value = 'typed';
	showFirst = false;
	context.update(state);
	assert.equal(parent.children.length, 1);
	assert.equal(parent.firstChild, second);
	assert.equal(parent.firstChild.value, 'typed');
	assert.equal(parent.firstChild.key, undefined);
});

test('a reused element keeps its listeners up to date', () => {
	const parent = root();
	const state = {};
	let label = 'one';
	const clicks = [];
	const context = h.render(parent, state, () => button(h.listen('click', () => clicks.push(label))));
	label = 'two';
	context.update(state);
	parent.firstChild.click();
	assert.deepEqual(clicks, ['two']);
});

test('updating with unchanged order moves nothing', () => {
	const parent = root();
	const state = {};
	const context = h.render(parent, state, () => div([p('a'), 'text', p('b')]));
	assert.equal(countMoves(parent.firstChild, () => context.update(state)), 0);
});
