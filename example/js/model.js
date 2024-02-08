// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';

/** A simple example model for a TODO list */
export default class TodoModel {
	constructor (name) {
		this.name = name;
		this.items = [];
	}
	
	addItem (text) {
		const item = new TodoItem(text, false);
		this.items.push(item);
		h.signal(this);
		return item;	
	}
	
	removeItem (item) {
		const index = this.items.indexOf(item);
		if (index >= 0) {
			model.items.splice(index, 1);
			h.signal(this);
		}
	}
}

/** Each item in the TODO list */
class TodoItem {
	constructor (text, completed) {
		this.text = text;
		this.completed = completed;
	}
	
	setCompleted () {
		this.completed = true;
		h.signal(this);
	}
}

