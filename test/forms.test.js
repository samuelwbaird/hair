// two way binding of form controls with hair.forms.js bind
import { root, nextFrame } from './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as h from '../hair.js';
import { bind } from '../hair.forms.js';

const { form, input, select, option, textarea, button, p } = h.elements;

// change a control as the user would, then dispatch the event the browser would
function userInput (control, value, eventType = 'input') {
	if (control.type == 'checkbox' || control.type == 'radio') {
		control.checked = value;
	} else {
		control.value = value;
	}
	control.dispatchEvent(new window.Event(eventType, { bubbles: true }));
}

const fields = () => [
	input({ name: 'title' }),
	input({ name: 'count', type: 'number' }),
	input({ name: 'done', type: 'checkbox' }),
	input({ name: 'size', type: 'radio', value: 'small' }),
	input({ name: 'size', type: 'radio', value: 'large' }),
	select({ name: 'colour' }, [option('red', { value: 'red' }), option('blue', { value: 'blue' })]),
	textarea({ name: 'notes' }),
];

const controls = (parent) => Object.fromEntries([...parent.querySelectorAll('[name]')].map((control) => [control.name + (control.type == 'radio' ? '_' + control.value : ''), control]));

test('controls are written from the object on first render', () => {
	const parent = root();
	const draft = { title: 'hello', count: 3, done: true, size: 'large', colour: 'blue', notes: 'some notes' };
	h.render(parent, draft, (d) => form(bind(d), fields()));
	const c = controls(parent);
	assert.equal(c.title.value, 'hello');
	assert.equal(c.count.value, '3');
	assert.equal(c.done.checked, true);
	assert.equal(c.size_small.checked, false);
	assert.equal(c.size_large.checked, true);
	assert.equal(c.colour.value, 'blue');
	assert.equal(c.notes.value, 'some notes');
});

test('user changes are written to the object with matching types', () => {
	const parent = root();
	const draft = { title: '', count: null, done: false, size: null, colour: 'red', notes: '' };
	h.render(parent, draft, (d) => form(bind(d), fields()));
	const c = controls(parent);
	userInput(c.title, 'typed');
	userInput(c.count, '42');
	userInput(c.done, true, 'change');
	userInput(c.size_small, true, 'change');
	userInput(c.colour, 'blue', 'change');
	userInput(c.notes, 'more');
	assert.deepEqual(draft, { title: 'typed', count: 42, done: true, size: 'small', colour: 'blue', notes: 'more' });
	userInput(c.count, '');
	assert.equal(draft.count, null);
});

test('without signal, user changes do not re-render', async () => {
	const parent = root();
	const draft = { title: '' };
	let renders = 0;
	h.render(parent, draft, (d) => { renders++; return form(bind(d), input({ name: 'title' })); });
	userInput(parent.querySelector('input'), 'typed');
	await nextFrame();
	assert.equal(draft.title, 'typed');
	assert.equal(renders, 1);
});

test('with signal, user changes re-render views of the object', async () => {
	const parent = root();
	const draft = { title: '' };
	h.render(parent, draft, (d) => form(bind(d, { signal: true }), [
		input({ name: 'title' }),
		p(d.title.length < 3 ? 'too short' : 'ok'),
	]));
	const field = parent.querySelector('input');
	userInput(field, 'ab');
	await nextFrame();
	assert.equal(parent.querySelector('p').textContent, 'too short');
	userInput(field, 'abc');
	await nextFrame();
	assert.equal(parent.querySelector('p').textContent, 'ok');
	assert.equal(field.value, 'abc');
});

test('values changed on the object are written on the next render', () => {
	const parent = root();
	const draft = { title: 'one', notes: 'kept' };
	const context = h.render(parent, draft, (d) => form(bind(d), [input({ name: 'title' }), textarea({ name: 'notes' })]));
	draft.title = 'two';
	context.update(draft);
	assert.equal(parent.querySelector('input').value, 'two');
	assert.equal(parent.querySelector('textarea').value, 'kept');
});

test('a control with focus is written on a later render', () => {
	const parent = root();
	const draft = { title: 'one' };
	const context = h.render(parent, draft, (d) => form(bind(d), input({ name: 'title' })));
	const field = parent.querySelector('input');
	field.focus();
	draft.title = 'two';
	context.update(draft);
	assert.equal(field.value, 'one');
	field.blur();
	context.update(draft);
	assert.equal(field.value, 'two');
});

test('controls without a matching property, and buttons, are not bound', () => {
	const parent = root();
	const draft = { title: 'one' };
	h.render(parent, draft, (d) => form(bind(d), [
		input({ name: 'other', value: 'left alone' }),
		button('go', { name: 'title', type: 'button' }),
	]));
	userInput(parent.querySelector('[name=other]'), 'changed');
	assert.equal(parent.querySelector('[name=other]').value, 'changed');
	assert.deepEqual(draft, { title: 'one' });
});

test('a new object creates a new binding', () => {
	const parent = root();
	const model = { draft: { title: 'first' } };
	const context = h.render(parent, model, (m) => form(bind(m.draft), input({ name: 'title' })));
	const first = model.draft;
	model.draft = { title: '' };
	context.update(model);
	const field = parent.querySelector('input');
	assert.equal(field.value, '');
	userInput(field, 'second');
	assert.equal(model.draft.title, 'second');
	assert.equal(first.title, 'first');
});

test('a removed binding no longer updates the object', () => {
	const parent = root();
	const state = { show: true, draft: { title: '' } };
	const context = h.render(parent, state, (s) => s.show ? form(bind(s.draft), input({ name: 'title' })) : null);
	const field = parent.querySelector('input');
	state.show = false;
	context.update(state);
	userInput(field, 'typed');
	assert.equal(state.draft.title, '');
});

test('bind outside a form throws', () => {
	assert.throws(() => h.render(root(), {}, (s) => h.elements.div(bind(s))), /child of a form/);
});
