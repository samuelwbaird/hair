import * as h from '../../hair.js';

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

