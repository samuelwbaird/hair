// reference the hair library to signal changes, and merge to bring server data into the model
import * as h from '../../hair.js';
import * as hm from '../../hair.model.js';

/** the model holds the hottest cities, and a status object for the updates */
export default class WeatherModel {
	constructor (server) {
		this.server = server;
		this.hottest = [];
		// the status changes with every update, so it is its own object, signalled separately from the cities
		this.status = { updatedAt: null, merges: 0, lastMergeChanged: false, loading: false };
	}

	async refresh () {
		if (this.status.loading) {
			return;
		}
		this.status.loading = true;
		h.signal(this.status);

		const response = await this.server.fetchHottest();

		// the response is fresh JSON, merge it into the existing model objects
		// the top five is a complete list, so arrays: 'match' removes cities that drop out and follows the new order
		// merge signals each object and array that changed: the list, each changed city, each changed history
		const changed = hm.merge(this, { hottest: response.cities, status: { updatedAt: response.time } }, {
			arrays: 'match',
			create: (data, key) => (key == 'hottest') ? new City(data) : data,
		});

		this.status.merges++;
		this.status.lastMergeChanged = changed;
		this.status.loading = false;
		h.signal(this.status);
	}
}

/** cities in the model are class instances, merge updates them through their properties and setters */
class City {
	#temperature = null;

	constructor (data) {
		this.id = data.id;
		this.name = data.name;
		this.country = data.country;
		this.previousTemperature = null;
		this.#temperature = data.temperature;
		this.weather = data.weather;
		this.history = [...data.history];
	}

	get temperature () {
		return this.#temperature;
	}

	set temperature (value) {
		this.previousTemperature = this.#temperature;
		this.#temperature = value;
	}

	// the direction of the last change in temperature
	trend () {
		if (this.previousTemperature == null) {
			return '';
		}
		return (this.temperature > this.previousTemperature) ? '▲' : '▼';
	}
}
