// render contexts: values, refs, signalling, listeners and disposal
import { root, nextFrame, reportedErrors } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';

const { div, p, button, input } = h.elements;

test('context_id refs are stored as context values', () => {
	const parent = root();
	const context = h.render(parent, {}, () => div({ context_id: 'update' }));
	assert.equal(typeof context.update, 'function');
	assert.equal(context.get('update'), parent.firstChild);
});

test('context_id refs are visible to inner contexts', () => {
	const parent = root();
	let found = null;
	h.render(parent, {}, () => [
		input({ context_id: 'field' }),
		h.compose({}, () => button(h.onAttach((context) => { found = context.get('field'); }))),
	]);
	assert.equal(found, parent.querySelector('input'));
});

test('context_id refs are removed with their element', () => {
	const parent = root();
	const state = {};
	let show = true;
	const context = h.render(parent, state, () => show ? div({ context_id: 'box' }) : null);
	show = false;
	context.update(state);
	assert.equal(context.get('box'), null);
});

test('context.set does not re-render unless asked to', async () => {
	const parent = root();
	let renders = 0;
	const context = h.render(parent, {}, (state, context) => { renders++; return p(context.get('tab', 'first')); });
	context.set('tab', 'second');
	await nextFrame();
	assert.equal(renders, 1);
	context.set('tab', 'third', true);
	await nextFrame();
	assert.equal(renders, 2);
	assert.equal(parent.textContent, 'third');
});

test('a signal of its own state during a render does not render again', async () => {
	const parent = root();
	const state = {};
	let renders = 0;
	h.render(parent, state, () => { renders++; h.signal(state); return p('x'); });
	await nextFrame();
	assert.equal(renders, 1);
});

test('a context watches its new state when the state object changes', async () => {
	const parent = root();
	const first = { name: 'first' };
	const second = { name: 'second' };
	let renders = 0;
	const context = h.render(parent, first, (s) => { renders++; return p(s.name); });
	context.update(second);
	h.signal(first);
	await nextFrame();
	assert.equal(renders, 2);
	h.signal(second);
	await nextFrame();
	assert.equal(renders, 3);
});

test('a context rendered again with the same state still watches it', async () => {
	const parent = root();
	const state = {};
	let renders = 0;
	const context = h.render(parent, state, () => { renders++; return p('x'); });
	context.render(state);
	h.signal(state);
	await nextFrame();
	assert.equal(renders, 3);
});

test('signalling a context re-renders its region', async () => {
	const parent = root();
	let renders = 0;
	const context = h.render(parent, {}, () => { renders++; return p('x'); });
	h.signal(context);
	await nextFrame();
	assert.equal(renders, 2);
});

test('context listeners use the latest listener on reuse', () => {
	const parent = root();
	const state = {};
	let n = 1;
	const seen = [];
	const context = h.render(parent, state, () => { const mine = n; return div(h.onUpdate(() => seen.push(mine))); });
	n = 2;
	context.update(state);
	n = 3;
	context.update(state);
	assert.deepEqual(seen, [1, 2, 3]);
});

test('onDelay runs once, with the latest listener', async () => {
	const parent = root();
	const state = {};
	let label = 'one';
	const seen = [];
	const context = h.render(parent, state, () => { const mine = label; return div(h.onDelay(0.01, () => seen.push(mine))); });
	label = 'two';
	context.update(state);
	await nextFrame();
	await nextFrame();
	assert.deepEqual(seen, ['two']);
});

test('onDelay is cancelled when removed', async () => {
	const parent = root();
	let ran = false;
	const context = h.render(parent, {}, () => div(h.onDelay(0.01, () => { ran = true; })));
	context.dispose();
	await nextFrame();
	await nextFrame();
	assert.equal(ran, false);
});

test('disposables added to a context listener are disposed on removal', () => {
	const parent = root();
	const disposed = [];
	const context = h.render(parent, {}, () => div(h.onContext((contextListener) => {
		contextListener.addDisposable(() => disposed.push('function'));
		contextListener.addDisposable({ dispose: () => disposed.push('object') });
	})));
	context.dispose();
	assert.deepEqual(disposed, ['function', 'object']);
});

test('a render that throws still watches its state', async () => {
	const parent = root();
	const state = {};
	let fail = false;
	let renders = 0;
	const context = h.render(parent, state, () => {
		renders++;
		return [p('a'), () => { if (fail) throw new Error('render failed'); return p('b'); }];
	});
	fail = true;
	assert.throws(() => context.update(state), /render failed/);
	fail = false;
	h.signal(state);
	await nextFrame();
	assert.equal(renders, 3);
	assert.equal(parent.innerHTML, '<p>a</p><p>b</p>');
});

test('a render that throws during a signalled update is reported', async () => {
	const parent = root();
	const state = {};
	let fail = false;
	h.render(parent, state, () => { if (fail) throw new Error('signalled render failed'); return p('ok'); });
	fail = true;
	reportedErrors.length = 0;
	h.signal(state);
	await nextFrame();
	assert.equal(reportedErrors.length, 1);
	assert.match(reportedErrors[0].message, /signalled render failed/);
});
