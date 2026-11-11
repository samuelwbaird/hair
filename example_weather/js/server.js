// a fake server, holding the weather of ten cities in its "database"
// each request changes the weather a little, and responds with the five hottest cities

const weatherTypes = ['☀️', '🌤️', '⛅', '🌥️', '🌧️', '⛈️'];

export default class FakeWeatherServer {
	constructor () {
		this.cities = [
			{ id: 'bkk', name: 'Bangkok', country: 'Thailand', temperature: 33 },
			{ id: 'dxb', name: 'Dubai', country: 'UAE', temperature: 36 },
			{ id: 'del', name: 'Delhi', country: 'India', temperature: 34 },
			{ id: 'cai', name: 'Cairo', country: 'Egypt', temperature: 32 },
			{ id: 'phx', name: 'Phoenix', country: 'USA', temperature: 35 },
			{ id: 'sin', name: 'Singapore', country: 'Singapore', temperature: 31 },
			{ id: 'dar', name: 'Darwin', country: 'Australia', temperature: 33 },
			{ id: 'lim', name: 'Lima', country: 'Peru', temperature: 27 },
			{ id: 'mia', name: 'Miami', country: 'USA', temperature: 30 },
			{ id: 'acc', name: 'Accra', country: 'Ghana', temperature: 31 },
		].map((city) => ({ ...city, normal: city.temperature, weather: '☀️', history: [] }));
		
		// fill in some starting data
		this.#updateWeather();
		for (const city of this.cities) {
			while (city.history.length < 7) {
				city.history = [...city.history, city.weather].slice(-7);
			}
		}
	}

	// respond after a short delay, like a network request
	async fetchHottest () {
		await new Promise((resolve) => setTimeout(resolve, 100 + (Math.random() * 100)));
		if (Math.random() < 0.5) {
			this.#updateWeather();
		}
		
		const hottest = [...this.cities].sort((a, b) => b.temperature - a.temperature).slice(0, 5);
		// fresh objects in every response, as JSON from a real server would be
		return JSON.parse(JSON.stringify({
			time: this.updateTime,
			cities: hottest.map(({ id, name, country, temperature, weather, history }) => ({ id, name, country, temperature, weather, history })),
		}));
	}

	#updateWeather () {
		this.updateTime = new Date().toLocaleTimeString();
		
		// a few cities change temperature and weather each update
		for (let i = 0; i < 2; i++) {
			const city = this.cities[Math.floor(Math.random() * this.cities.length)];
			const change = (Math.random() * 4) - 2;
			city.temperature += (Math.random() -0.5) * 2;
			city.weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
		}

		// every city adds its current weather to its history
		for (const city of this.cities) {
			city.history = [...city.history, city.weather].slice(-7);
		}
	}
}
