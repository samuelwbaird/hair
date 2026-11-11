// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

const { h1, p, ol, li, span, div, button } = h.elements;

/** top level view, the update status and the list of hottest cities */
export default function appView (model) {
	return [
		h1('Hottest cities'),
		p('A fake server tracks and randomly updates the weather in a set of cities. The server is "polled" every two seconds returning the five hottest cites.', { class: 'note' }),
		p('hair.model.merge merges the latest server data into a persistent JS model, signalling changes.', { class: 'note' }),
		p('Each part of the view flashes when it renders on signal. A change in order of cities causes the list to update, but hair.js minimises the DOM changes applied.', { class: 'note' }),
		h.compose(model.status, (status) => statusView(model, status)),
		ol({ class: 'cities' }, h.composeEach(model.hottest, cityView)),
	];
}

function statusView (model, status) {
	return div({ class: 'status' }, [
		span(status.updatedAt ? ('Updated ' + status.updatedAt) : 'Waiting for the first update'),
		span(status.merges + ' merges, the last merge ' + (status.lastMergeChanged ? 'changed the model' : 'changed nothing')),
		button('Refresh now', { disabled: status.loading }, h.listen('click', () => model.refresh())),
		flash(),
	]);
}

// each city row renders when that city changes, or when the order of the list changes
function cityView (city) {
	return li({ class: 'city' }, [
		span(city.weather, { class: 'weather' }),
		span(city.name, { class: 'name' }),
		span(city.country, { class: 'country' }),
		span(city.temperature.toFixed(1) + '°', { class: 'temperature' }),
		span(city.trend(), { class: 'trend' }),
		h.compose(city.history, historyView),
		flash(),
	]);
}

// the history is an array of its own, signalled by merge whenever it changes, even if the city doesn't
function historyView (history) {
	return span({ class: 'history' }, history.join(''), flash());
}

// highlight an element each time its region renders, to show which parts of the view update
// the flash class belongs to this DOM code, not the spec, so the spec's class property leaves it alone
function flash () {
	return h.onUpdate((context, element) => {
		element.classList.remove('flash');
		void element.offsetWidth;	// force a style recalculation so the animation restarts
		element.classList.add('flash');
	});
}
