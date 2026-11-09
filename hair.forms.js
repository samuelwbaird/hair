// hair.forms.js - MIT license, copyright 2024 Samuel Baird
// ===============================================================================
// Two way binding between the controls of a form and the properties of an object
//   form(bind(object), [ input({ name: 'title' }), ... ])
//   form(bind(object, { signal: true }), [ ... ])
//
// Add bind as a child of a form element. Controls are matched by their name to properties
// of the object, and only properties that already exist on the object are bound.
//   * after each render, values that have changed on the object are written to their controls
//     (skipping a control that has focus, it is written on a later render)
//   * when a control is changed by the user, its value is written to the object
//   * with { signal: true } the object is also signalled when a control changes it
//
// Bind owns the values of the controls it binds, so don't also set value or checked in the spec.
//
// Signalling re-renders any view of the object as the user types, eg. to show live validation.
// Without it, nothing re-renders while the user types. A useful pattern is to bind a draft object,
// transient state for the form, and copy it into the model when the form is submitted.
//
// A new object passed to bind creates a new binding, eg. to reset a form with a fresh draft.
//
// Supported controls, and the values they read and write
//   text, textarea and other inputs     a string
//   number and range inputs             a number, or null when empty
//   checkbox                            a boolean
//   radio buttons with the same name    the string value of the checked radio button
//   select                              the string value of the selected option
// Buttons, file inputs and multiple selects are not bound.

import * as hair from './hair.js';

// -- public interface ----------------------------------------------------------------------

export function bind (object, { signal = false } = {}) {
	return hair.onContext((contextListener) => {
		// the value of each name last written to, or read from, the controls
		const lastValues = new Map();

		const onInput = (event) => {
			const control = event.target;
			if (control.form !== contextListener.element || !isBound(control, object)) {
				return;
			}
			if (control.type == 'radio' && !control.checked) {
				return;
			}
			const value = readControl(control);
			if (Object.is(value, lastValues.get(control.name))) {
				return;
			}
			object[control.name] = value;
			lastValues.set(control.name, value);
			if (signal) {
				hair.signal(object);
			}
		};

		contextListener.onAttach = (context, form) => {
			if (form.localName != 'form') {
				throw new Error('bind must be a child of a form element');
			}
			form.addEventListener('input', onInput);
			form.addEventListener('change', onInput);
		};

		contextListener.onUpdate = (context, form) => {
			// group bound controls by name, as radio buttons share a name
			const controlsByName = new Map();
			for (const control of form.elements) {
				if (isBound(control, object)) {
					controlsByName.set(control.name, [...(controlsByName.get(control.name) ?? []), control]);
				}
			}
			for (const [name, controls] of controlsByName) {
				const value = object[name];
				if (Object.is(value, lastValues.get(name)) || controls.includes(document.activeElement)) {
					// unchanged, or in use and left to be written on a later render
					continue;
				}
				for (const control of controls) {
					writeControl(control, value);
				}
				lastValues.set(name, value);
			}
		};

		contextListener.onRemove = (context, form) => {
			form.removeEventListener('input', onInput);
			form.removeEventListener('change', onInput);
		};
	}, hair.key(object, signal));
}

// -- reading and writing controls ----------------------------------------------------------

const unboundInputTypes = ['button', 'submit', 'reset', 'image', 'file'];

function isBound (control, object) {
	if (!control.name || !(control.name in object)) {
		return false;
	}
	switch (control.localName) {
		case 'input':
			return !unboundInputTypes.includes(control.type);
		case 'select':
			return !control.multiple;
		case 'textarea':
			return true;
		default:
			return false;
	}
}

function readControl (control) {
	switch (control.type) {
		case 'checkbox':
			return control.checked;
		case 'number':
		case 'range':
			return Number.isNaN(control.valueAsNumber) ? null : control.valueAsNumber;
		default:
			return control.value;
	}
}

function writeControl (control, value) {
	switch (control.type) {
		case 'checkbox':
			control.checked = !!value;
			break;
		case 'radio':
			control.checked = (value != null && control.value === String(value));
			break;
		default:
			control.value = value ?? '';
	}
}
