// larger renders, where prior attachments are found through an index rather than a search
import { root, countMoves } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

const { ul, li, div, span } = h.elements;

const items = (count) => Array.from({ length: count }, (_, i) => ({ name: 'i' + i }));
const names = (parent) => [...parent.querySelectorAll('li')].map((element) => element.textContent);

test('a long list is reordered, filtered and extended reusing existing nodes', () => {
	const parent = root();
	const model = { items: items(100) };
	const context = h.render(parent, model, (m) => ul(h.composeEach(m.items, (item) => li(item.name))));
	const nodeFor = new Map([...parent.querySelectorAll('li')].map((element) => [element.textContent, element]));

	model.items.reverse();
	context.update(model);
	assert.deepEqual(names(parent), model.items.map((item) => item.name));

	model.items = model.items.filter((_, i) => i % 3 != 0);
	model.items.splice(10, 0, { name: 'new' });
	context.update(model);
	assert.deepEqual(names(parent), model.items.map((item) => item.name));
	for (const element of parent.querySelectorAll('li')) {
		if (element.textContent != 'new') {
			assert.equal(nodeFor.get(element.textContent), element);
		}
	}
});

test('a long list with the same object twice renders it twice', () => {
	const parent = root();
	const list = items(50);
	const model = { items: [...list, list[0]] };
	const context = h.render(parent, model, (m) => ul(h.composeEach(m.items, (item) => li(item.name))));
	context.update(model);
	const all = names(parent);
	assert.equal(all.length, 51);
	assert.equal(all[0], 'i0');
	assert.equal(all[50], 'i0');
});

test('keyed elements in one large context follow their keys', () => {
	const parent = root();
	const state = { items: items(60) };
	const context = h.render(parent, state, (s) => ul(s.items.map((item) => li(h.key(item), item.name))));
	const before = [...parent.querySelectorAll('li')];
	state.items.reverse();
	context.update(state);
	assert.deepEqual([...parent.querySelectorAll('li')], [...before].reverse());
});

test('an unchanged large context moves nothing', () => {
	const parent = root();
	const state = { items: items(80) };
	const context = h.render(parent, state, (s) => div(s.items.map((item) => [span(item.name), ' '])));
	assert.equal(countMoves(parent.firstChild, () => context.update(state)), 0);
	assert.equal(parent.firstChild.childNodes.length, 160);
});
