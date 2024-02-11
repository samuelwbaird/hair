// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

/** top level view, render the app as a title, list, and "add new" component */
export default function app (model) {
	return [
		h.h1(model.name),
		h.div([
			h.ol(h.compose(model.items, (item) => displayItem(model, item))),
			itemCount(model.items.length),
			sortButton,
		]),
		h.div([
			h.p('Add new items below'),
			addItem,
		]),
	];
}

/** small component, executed inline to render the list count */
function itemCount (count) {
	if (count == 0) {
		return h.p('Add some items to your TODO list');
	} else if (count == 1) {
		return h.p('1 item');			
	} else {
		return h.p(count + ' items');
	}
}

function sortButton (model) {
	// sort button to test out ordering of re-used elements
	return h.button('Sort Items', { class: ['btn', 'btn-sort'] }, h.listen('click', () => { model.sortItems(); }));
}

/** component to render each item in the list in its own view */
function displayItem (model, item) {
	return h.div([
		h.input({ type: 'checkbox', checked: item.completed, disabled: item.completed }, [
			h.listen('change', (context, element) => { 
				if (element.checked) {
					item.setCompleted();
				}
			}),
		]),
		h.span(item.text, { class: 'txt-todo', style: { textDecoration: (item.completed ? 'line-through' : '') }}),
		h.button('Delete', { class: ['btn', 'btn-delete'] }, h.listen('click', () => { model.removeItem(item); })),
	]);
}

/** component to render the UI to add new items */
function addItem (model) {
	return h.div([
		h.input({ _id: 'txt_input' }),
		h.button('Add', { class: ['btn', 'btn-add'] }, h.listen('click', (context, element) => {
			// use a reference to a another element within this same context, using the special _id property
			model.addItem(context.txt_input.value);
			context.txt_input.value = '';
		})),
	]);
}
