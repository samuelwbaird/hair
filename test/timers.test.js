// signals and frame timers
import { nextFrame, reportedErrors } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

test('frame actions run in the order they were requested', async () => {
	const order = [];
	h.onNextFrame(() => order.push(1));
	h.onNextFrame(() => order.push(2));
	h.onNextFrame(() => order.push(3));
	await nextFrame();
	assert.deepEqual(order, [1, 2, 3]);
});

test('an exception in one frame action does not stop the others', async () => {
	let ran = false;
	reportedErrors.length = 0;
	h.onNextFrame(() => { throw new Error('first'); });
	h.onNextFrame(() => { ran = true; });
	await nextFrame();
	assert.equal(ran, true);
	assert.equal(reportedErrors.length, 1);
});

test('an exception in one watcher does not stop the others', () => {
	const object = {};
	let ran = false;
	reportedErrors.length = 0;
	h.watch(object, () => { throw new Error('watcher'); });
	h.watch(object, () => { ran = true; });
	h.signal(object);
	assert.equal(ran, true);
	assert.equal(reportedErrors.length, 1);
});

test('watchers of a disposed owner are ignored', () => {
	const object = {};
	const owner = {};
	let ran = false;
	h.watch(object, () => { ran = true; }, owner);
	h.markObjectAsDisposed(owner);
	h.signal(object);
	assert.equal(ran, false);
});

test('wait resolves after a delay and on a condition', async () => {
	await h.wait(0.01);
	let count = 0;
	const result = await h.wait(() => (++count >= 2) ? 'done' : false);
	assert.equal(result, 'done');
});
