// merging data into a model with hair.model.js merge
import { root } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';
import * as hm from '../hair.model.js';

// record the objects signalled while running an action
function signalled (objects, action) {
	const seen = [];
	const owner = {};
	for (const object of objects) {
		h.watch(object, () => seen.push(object), owner);
	}
	action();
	h.removeWatcher(owner);
	return seen;
}

test('properties are merged, missing properties are left alone', () => {
	const target = { a: 1, b: 2, c: 3 };
	assert.equal(hm.merge(target, { a: 1, b: 20, d: null }), true);
	assert.deepEqual(target, { a: 1, b: 20, c: 3, d: null });
	assert.equal(hm.merge(target, { a: 1, b: 20 }), false);
});

test('nested objects are merged keeping their identity', () => {
	const inner = { x: 1, y: 2 };
	const target = { inner };
	hm.merge(target, { inner: { x: 10 } });
	assert.equal(target.inner, inner);
	assert.deepEqual(inner, { x: 10, y: 2 });
});

test('objects with nothing to merge into are made with create', () => {
	const calls = [];
	const target = { inner: null };
	hm.merge(target, { inner: { x: 1 } }, { create: (data, key, parent) => { calls.push([key, parent]); return { made: true, ...data }; } });
	assert.deepEqual(target.inner, { made: true, x: 1 });
	assert.deepEqual(calls, [['inner', target]]);
});

test('create receives the source data and owns its subtree', () => {
	const created = [];
	const target = {};
	hm.merge(target, { item: { id: 1, parts: [{ id: 2 }], detail: { z: 1 } } }, { create: (data) => { created.push(data); return data; } });
	assert.equal(created.length, 1);
	assert.equal(target.item.detail.z, 1);
});

test('arrays merge by id: matched items in place, new items added, nothing removed', () => {
	const a = { id: 'a', v: 1 };
	const b = { id: 'b', v: 2 };
	const list = [a, b];
	const target = { list };
	hm.merge(target, { list: [{ id: 'c', v: 3 }, { id: 'a', v: 10 }] });
	assert.equal(target.list, list);
	assert.deepEqual(list.map((item) => item.id), ['a', 'b', 'c']);
	assert.equal(list[0], a);
	assert.equal(a.v, 10);
	assert.equal(list[1], b);
});

test('arrays match by id: the source items in the source order, reusing matched objects', () => {
	const a = { id: 'a', v: 1 };
	const b = { id: 'b', v: 2 };
	const list = [a, b];
	hm.merge(list, [{ id: 'c', v: 3 }, { id: 'a', v: 10 }], { arrays: 'match' });
	assert.deepEqual(list.map((item) => item.id), ['c', 'a']);
	assert.equal(list[1], a);
	assert.equal(a.v, 10);
});

test('ids can be found with a function', () => {
	const a = { key: { code: 'a' }, v: 1 };
	const list = [a];
	hm.merge(list, [{ key: { code: 'a' }, v: 2 }], { id: (item) => item.key.code });
	assert.equal(list[0], a);
	assert.equal(a.v, 2);
});

test('arrays of values are replaced in place when they differ', () => {
	const tags = ['x', 'y'];
	const target = { tags };
	assert.equal(hm.merge(target, { tags: ['x', 'y'] }), false);
	assert.equal(hm.merge(target, { tags: ['y', 'z', 'w'] }), true);
	assert.equal(target.tags, tags);
	assert.deepEqual(tags, ['y', 'z', 'w']);
});

test('arrays of objects without ids are replaced, using create', () => {
	const target = { points: [{ x: 1 }] };
	hm.merge(target, { points: [{ x: 2 }, { x: 3 }] }, { create: (data) => ({ ...data, made: true }) });
	assert.deepEqual(target.points, [{ x: 2, made: true }, { x: 3, made: true }]);
});

test('changed objects and arrays are signalled once, after the merge', () => {
	const city = { id: 1, temperature: 20, history: ['sun'] };
	const other = { id: 2, temperature: 15, history: [] };
	const model = { cities: [city, other], status: { time: 1 } };
	const views = [];
	h.watch(city, () => views.push(model.status.time), {});
	const seen = signalled([model, model.cities, city, city.history, other, other.history, model.status], () => {
		hm.merge(model, { cities: [{ id: 1, temperature: 22, history: ['sun', 'rain'] }, { id: 2, temperature: 15 }], status: { time: 2 } });
	});
	assert.deepEqual(new Set(seen), new Set([city, city.history, model.status]));
	assert.equal(seen.length, 3);
	// the watcher saw the whole merge complete
	assert.deepEqual(views, [2]);
});

test('signal: false merges without signalling', () => {
	const target = { a: 1 };
	const seen = signalled([target], () => hm.merge(target, { a: 2 }, { signal: false }));
	assert.equal(target.a, 2);
	assert.deepEqual(seen, []);
});

test('class instances are merged through their setters and keep their methods', () => {
	class Reading {
		#value = 0;
		previous = null;
		get value () { return this.#value; }
		set value (value) { this.previous = this.#value; this.#value = value; }
		rising () { return this.value > this.previous; }
	}
	const reading = new Reading();
	reading.value = 10;
	hm.merge({ reading }, { reading: { value: 12 } });
	assert.equal(reading.value, 12);
	assert.equal(reading.rising(), true);
});

test('invalid options and mismatched values throw', () => {
	assert.throws(() => hm.merge({}, {}, { arrays: 'replace' }), /arrays must be/);
	assert.throws(() => hm.merge([], {}), /two objects or two arrays/);
});

test('a list merged with match keeps the DOM of matched items', () => {
	const parent = root();
	const model = { cities: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] };
	const { ul, li } = h.elements;
	const context = h.render(parent, model, (m) => ul(h.composeEach(m.cities, (city) => li(city.name))));
	const [a, , c] = parent.querySelectorAll('li');
	hm.merge(model.cities, [{ id: 3, name: 'C' }, { id: 4, name: 'D' }, { id: 1, name: 'A' }], { arrays: 'match' });
	context.update(model);
	const after = [...parent.querySelectorAll('li')];
	assert.deepEqual(after.map((element) => element.textContent), ['C', 'D', 'A']);
	assert.equal(after[0], c);
	assert.equal(after[2], a);
});
