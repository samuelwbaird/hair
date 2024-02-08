import * as h from '../../hair.js';

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

function itemCount(count) {
	if (count == 0) {
		return h.p('Add some items to your TODO list');
	} else if (count == 1) {
		return h.p('1 item');			
	} else {
		return h.p(count + ' items');
	}
}

function displayItem(model, item) {
	return h.div([
		h.input('Completed', { type: 'checkbox', _id: 'completed' }, [
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

function addItem(model) {
	return h.div([
		h.input({ _id: 'txt_input' }),
		h.button('Add', { _class: 'add' }, h.listen('click', () => {  })),
	]);
}
