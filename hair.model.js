// hair.model.js - MIT license, copyright 2024 Samuel Baird
// ===============================================================================
// Helpers for working with a model, without imposing a particular way of structuring it
//
// Merge fresh data (eg. JSON from a server) into existing model objects, keeping their identity
//   const changed = merge(target, source, options);
//
// Objects
//   * each property of the source is merged into the target, properties missing from the source are left alone
//   * values are assigned only if they differ, nested objects are merged into the existing object
//   * an object with nothing to merge into is made with create(data, key, parent)
//     create receives the source data and is responsible for its whole subtree
//
// Arrays keep their identity and are updated in place
//   * arrays of objects that all have ids are matched by id, matched items are merged
//     arrays: 'merge' (default)  update matched items in place, add new items at the end, remove nothing
//     arrays: 'match'            the array ends up with exactly the items of the source, in its order
//   * other arrays (values, or objects without ids) are replaced as a whole when they differ
//
// Options
//   id = 'id'                  property name, or (object) => key, to match objects within arrays
//   create = (data) => data    make a model object for data with no match (data, key, parent)
//   arrays = 'merge'           'merge' or 'match'
//   signal = true              signal each object and array that changed, once, after the merge
//
// Returns true if anything changed. Other dependencies remain the model's job, eg. after a merge
// that changed something a model could also signal itself or a summary object.

import * as hair from './hair.js';

// -- public interface ----------------------------------------------------------------------

export function merge (target, source, { id = 'id', create = (data) => data, arrays = 'merge', signal = true } = {}) {
	if (arrays != 'merge' && arrays != 'match') {
		throw new Error('arrays must be \'merge\' or \'match\'');
	}
	const merger = new Merger((typeof id == 'function') ? id : (object) => object[id], create, arrays);
	if (Array.isArray(target) && Array.isArray(source)) {
		merger.mergeArray(target, source, null, null);
	} else if (isObject(target) && isObject(source) && !Array.isArray(target) && !Array.isArray(source)) {
		merger.mergeObject(target, source);
	} else {
		throw new Error('merge requires two objects or two arrays');
	}

	if (signal) {
		for (const object of merger.changed) {
			hair.signal(object);
		}
	}
	return merger.changed.size > 0;
}

// -- merging -------------------------------------------------------------------------------

function isObject (value) {
	return value !== null && typeof value == 'object';
}

class Merger {
	constructor (idOf, create, arrays) {
		this.idOf = idOf;
		this.create = create;
		this.arrays = arrays;

		// objects and arrays changed by this merge, in the order they changed
		this.changed = new Set();
	}

	mergeObject (target, source) {
		for (const [key, value] of Object.entries(source)) {
			const current = target[key];
			if (Array.isArray(value) && Array.isArray(current)) {
				this.mergeArray(current, value, key, target);
			} else if (isObject(value) && !Array.isArray(value) && isObject(current) && !Array.isArray(current)) {
				this.mergeObject(current, value);
			} else {
				const next = this.createValue(value, key, target);
				if (!Object.is(current, next)) {
					target[key] = next;
					this.changed.add(target);
				}
			}
		}
	}

	mergeArray (target, source, key, parent) {
		let next;
		if (source.every((item) => isObject(item) && this.idOf(item) != null)) {
			// match objects by id, merging into the existing object for each id
			const existing = new Map();
			for (const item of target) {
				const itemId = isObject(item) ? this.idOf(item) : null;
				if (itemId != null && !existing.has(itemId)) {
					existing.set(itemId, item);
				}
			}
			const merged = source.map((data) => {
				const match = existing.get(this.idOf(data));
				if (match) {
					this.mergeObject(match, data);
					return match;
				}
				return this.create(data, key, parent);
			});
			if (this.arrays == 'match') {
				next = merged;
			} else {
				const kept = new Set(target);
				next = [...target, ...merged.filter((item) => !kept.has(item))];
			}
		} else {
			// otherwise compare values, and replace the contents if they differ
			if (target.length == source.length && source.every((value, i) => !isObject(value) && Object.is(value, target[i]))) {
				return;
			}
			next = source.map((value) => this.createValue(value, key, parent));
		}

		if (next.length != target.length || next.some((item, i) => item !== target[i])) {
			// update the contents in place, keeping the identity of the array
			target.length = next.length;
			next.forEach((item, i) => { target[i] = item; });
			this.changed.add(target);
		}
	}

	// source values used as they are, except objects with no match, which are created
	createValue (value, key, parent) {
		if (Array.isArray(value)) {
			return value.map((item) => this.createValue(item, key, parent));
		}
		return isObject(value) ? this.create(value, key, parent) : value;
	}
}
