// reuse keys, and how compose and composeEach match their regions
import { root } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

const { div, p, ul, li } = h.elements;

test('a key can be given in any argument position of an element', () => {
	const a = div(h.key('x'), 'text', { id: 'one' });
	const b = div('text', { id: 'one' }, h.key('x'));
	assert.deepEqual(a, b);
	assert.equal(h.isKey(h.key('x')), true);
	assert.equal(h.isKey('x'), false);
});

test('two keys for one element throw', () => {
	assert.throws(() => div(h.key('a'), h.key('b')), /multiple keys/);
});

test('a key given as a child throws', () => {
	assert.throws(() => h.render(root(), {}, () => div([h.key('a')])), /must be an argument/);
});

test('an element is only reused when all key values are equal', () => {
	const parent = root();
	const state = {};
	const first = {};
	let values = [first, 1];
	const context = h.render(parent, state, () => p(h.key(...values), 'x'));
	const original = parent.firstChild;

	values = [first, 1];
	context.update(state);
	assert.equal(parent.firstChild, original);

	values = [first, 2];
	context.update(state);
	assert.notEqual(parent.firstChild, original);
	assert.equal(parent.children.length, 1);
});

test('context_id and id do not affect element reuse', () => {
	const parent = root();
	const state = {};
	let name = 'one';
	const context = h.render(parent, state, () => div({ id: name, context_id: name }));
	const original = parent.firstChild;
	name = 'two';
	context.update(state);
	assert.equal(parent.firstChild, original);
	assert.equal(context.get('one'), null);
	assert.equal(context.get('two'), original);
});

test('a listener with a key is created again when the key changes', () => {
	const parent = root();
	const state = {};
	let level = 1;
	const attached = [];
	const context = h.render(parent, state, () => div(h.onAttach(() => attached.push(level), h.key(level))));
	context.update(state);
	level = 2;
	context.update(state);
	assert.deepEqual(attached, [1, 2]);
});

test('reuse keys for listeners must be given using key', () => {
	assert.throws(() => h.onAttach(() => {}, 'level'), /must be given using key/);
	assert.throws(() => h.onDelay(1, () => {}, {}), /must be given using key/);
});

test('compose reuses its region for the same state object, and rebuilds it for a new one', () => {
	const parent = root();
	const model = { current: { name: 'a' } };
	const context = h.render(parent, model, (m) => h.compose(m.current, (current) => p(current.name)));
	const original = parent.firstChild;

	context.update(model);
	assert.equal(parent.firstChild, original);

	model.current = { name: 'b' };
	context.update(model);
	assert.notEqual(parent.firstChild, original);
	assert.equal(parent.textContent, 'b');
});

test('composeEach keeps item DOM when the collection is replaced', () => {
	const parent = root();
	const model = { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] };
	const context = h.render(parent, model, (m) => ul(h.composeEach(m.items, (item) => li(item.name))));
	const [a, b, c] = parent.querySelectorAll('li');

	model.items = model.items.filter((item) => item.name != 'B');
	context.update(model);
	assert.deepEqual([...parent.querySelectorAll('li')], [a, c]);
	assert.equal(b.isConnected, false);
});

test('composeEach watches the replacement collection', async () => {
	const parent = root();
	const model = { items: [{ name: 'A' }] };
	const context = h.render(parent, model, (m) => ul(h.composeEach(m.items, (item) => li(item.name))));
	model.items = [...model.items];
	context.update(model);
	model.items.push({ name: 'B' });
	h.signal(model.items);
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(parent.textContent, 'AB');
});
