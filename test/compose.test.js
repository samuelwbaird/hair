// compose and composeEach boundaries, lists and ordering
import { root, nextFrame, countMoves } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

const items = (...names) => names.map((name) => ({ name }));

test('compose passes an array through whole', () => {
	const parent = root();
	h.render(parent, {}, () => h.compose(['a', 'b'], (list) => h.p('count ' + list.length)));
	assert.equal(parent.innerHTML, '<p>count 2</p>');
});

test('render passes an array through whole', () => {
	const parent = root();
	h.render(parent, ['a', 'b'], (list) => h.p('count ' + list.length));
	assert.equal(parent.innerHTML, '<p>count 2</p>');
});

test('composeEach renders each item, including falsy values', () => {
	const parent = root();
	h.render(parent, {}, () => h.ul(h.composeEach([0, 1, '', 2], (n) => h.li(n))));
	assert.equal(parent.innerHTML, '<ul><li>0</li><li>1</li><li></li><li>2</li></ul>');
});

test('composeEach passes iterable items through whole', () => {
	const parent = root();
	const map = new Map([['k1', 'v1'], ['k2', 'v2']]);
	h.render(parent, {}, () => h.ul(h.composeEach(map, ([key, value]) => h.li(key + '=' + value))));
	assert.equal(parent.innerHTML, '<ul><li>k1=v1</li><li>k2=v2</li></ul>');
});

test('composeEach reuses DOM for the same item objects', () => {
	const parent = root();
	const model = { items: items('A', 'B', 'C') };
	const context = h.render(parent, model, (m) => h.ul(h.composeEach(m.items, (item) => h.li(item.name))));
	const before = [...parent.querySelectorAll('li')];
	model.items.reverse();
	context.update(model);
	const after = [...parent.querySelectorAll('li')];
	assert.equal(parent.textContent, 'CBA');
	assert.deepEqual(after, [...before].reverse());
});

test('prepending an item moves no existing nodes', () => {
	const parent = root();
	const model = { items: items('A', 'B', 'C') };
	const context = h.render(parent, model, (m) => h.ul(h.composeEach(m.items, (item) => h.li(item.name))));
	model.items.unshift({ name: 'N' });
	const moves = countMoves(parent.firstChild, () => context.update(model));
	assert.equal(parent.textContent, 'NABC');
	assert.equal(moves, 0);
});

test('a list reordered by its own signal stays before following siblings', async () => {
	const parent = root();
	const model = { items: items('A', 'B', 'C') };
	h.render(parent, model, (m) => h.div([h.composeEach(m.items, (item) => h.span(item.name)), h.p('footer')]));
	model.items.reverse();
	h.signal(model.items);
	await nextFrame();
	assert.equal(parent.innerHTML, '<div><span>C</span><span>B</span><span>A</span><p>footer</p></div>');
});

test('signalling an item re-renders only that item', async () => {
	const parent = root();
	const model = { items: items('A', 'B') };
	let rootRenders = 0;
	h.render(parent, model, (m) => { rootRenders++; return h.ul(h.composeEach(m.items, (item) => h.li(item.name))); });
	model.items[1].name = 'B2';
	h.signal(model.items[1]);
	await nextFrame();
	assert.equal(parent.textContent, 'AB2');
	assert.equal(rootRenders, 1);
});

test('signalling a parent re-renders composed children', async () => {
	const parent = root();
	const model = { selected: null, items: items('A', 'B') };
	h.render(parent, model, (m) => h.ul(h.composeEach(m.items, (item) => h.li(item.name, { class: m.selected === item ? 'sel' : null }))));
	model.selected = model.items[1];
	h.signal(model);
	await nextFrame();
	assert.equal(parent.querySelector('.sel').textContent, 'B');
});

test('a parent and child signalled together render the child once', async () => {
	const parent = root();
	const model = { child: { name: 'c' } };
	let childRenders = 0;
	h.render(parent, model, (m) => h.compose(m.child, (child) => { childRenders++; return h.p(child.name); }));
	childRenders = 0;
	h.signal(model.child);
	h.signal(model);
	await nextFrame();
	assert.equal(childRenders, 1);
});
