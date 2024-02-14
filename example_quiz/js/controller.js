// reference the hair library to hook into the signal/watch mechanism
import * as hair from '../../hair.js';

import * as model from './model.js';
import * as view from './view.js';

export default class QuizApp {

	constructor (rootDOM) {
		this.rootDOM = rootDOM;
		this.rootView = null;
	}
	
	navMainMenu () {
		this.#setTopLevel(this, view.mainMenu);
	}
	
	getLevels () {
		return [
			{ label: 'Easy Quiz', action: () => { alert('easy'); } },
			{ label: 'Medium Quiz', action: () => { alert('medium'); }  },
			{ label: 'Hard Quiz', action: () => { alert('hard'); }  },
		];
	}
	
	#setTopLevel(model, view) {
		if (this.rootView) {
			this.rootView.dispose();
			this.rootView = null;
		}
		
		this.rootView = hair.render(this.rootDOM, model, view);
	}
	
}
