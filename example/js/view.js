// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

/** top level view, render the app as a title, list, and "add new" component */
export default function app(model) {
	return [
		h.h1(model.name),
		h.div([
			h.ol({ _id: 'list' }, h.compose(model.items, (item) => displayItem(model, item))),
			itemCount(model.items.length),
		]),
		h.div([
			h.p('Add new items below'),
			addItem,
		]),
	];
}

/** small component, executed inline to render the list count */
function itemCount(count) {
	if (count == 0) {
		return h.p('Add some items to your TODO list');
	} else if (count == 1) {
		return h.p('1 item');			
	} else {
		return h.p(count + ' items');
	}
}

/** component to render each item in the list in its own view */
function displayItem(model, item) {
	return h.div([
		h.input({ type: 'checkbox', _id: 'completed' }, [
			h.listen('change', (context, element, e) => { 
				if (element.value) {
					item.setCompleted();
				}
			}),
		]),
		h.span(item.text),
		h.button('Delete', { _class: 'delete' }, h.listen('click', () => { model.delete(item); })),
	]);
}

/** component to render the UI to add new items */
function addItem(model) {
	return h.div([
		h.input({ _id: 'txt_input' }),
		h.button('Add', { _class: 'add' }, h.listen('click', () => {  })),
	]);
}
