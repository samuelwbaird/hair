// reference the hair library to access the provided functions to generate elements
import { compose, composeEach, listen, elements } from '../../hair.js';

const { h1, div, p, span, ol, li, button, input } = elements;

/** top level view, render the app as a title, list, and "add new" component */
export default function app (model) {
	return [
		h1(model.name),
		div([
			ol(composeEach(model.items, (item) => displayItem(model, item))),
			itemCount(model.items.length),
			sortButton,
		]),
		div([
			p('Add new items below'),
			addItem,
		]),
	];
}

/** small component, executed inline to render the list count */
function itemCount (count) {
	if (count == 0) {
		return p('Add some items to your TODO list');
	} else if (count == 1) {
		return p('1 item');			
	} else {
		return p(count + ' items');
	}
}

function sortButton (model) {
	// sort button to test out ordering of re-used elements
	return [
		button('Sort Items', { class: ['btn', 'btn-sort'] }, listen('click', () => { model.sortItems(); })),
		div({ style: { display: 'inline', marginRight: '10px' }}),
		span('(alphabetical sort, with completed items last)'),
	];
}

/** component to render each item in the list in its own view */
function displayItem (model, item) {
	return div([
		input({ type: 'checkbox', checked: item.completed, disabled: item.completed }, [
			listen('change', (context, element) => { 
				if (element.checked) {
					item.setCompleted();
				}
			}),
		]),
		div({ style: { display: 'inline', marginRight: '5px' }}),
		span(item.text, { class: 'txt-todo', style: { textDecoration: (item.completed ? 'line-through' : '') }}),
		div({ style: { display: 'inline', marginRight: '5px' }}),
		button('Delete', { class: ['btn', 'btn-delete'] }, listen('click', () => { model.removeItem(item); })),
	]);
}

/** component to render the UI to add new items */
function addItem (model) {
	return div([
		input({ context_id: 'txt_input' }),
		div({ style: { display: 'inline', marginRight: '10px' }}),
		button('Add', { class: ['btn', 'btn-add'] }, listen('click', (context, element) => {
			// use a reference to a another element within this same context, using the special context_id property
			model.addItem(context.get('txt_input').value);
			context.get('txt_input').value = '';
		})),
	]);
}
