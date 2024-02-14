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
		this.#setTopLevel({ levels: this.getLevels() }, view.mainMenuView);
	}
	
	getLevels () {
		return [
			{ label: 'Easy Quiz', action: () => { this.startLevel(5, 1, 5); } },
			{ label: 'Medium Quiz', action: () => { this.startLevel(5, 3, 7); }  },
			{ label: 'Hard Quiz', action: () => { this.startLevel(5, 1, 12); }  },
		];
	}
	
	startLevel (numberOfQuestion, minNumber, maxNumber) {
		//fade out the menu
		this.rootView.dispatch('fadeout');
		hair.delay(0.25, () => {
			this.#setTopLevel(new model.QuizModel(numberOfQuestion, minNumber, maxNumber), view.quizView);
		});
	}
	
	#setTopLevel(model, view) {
		if (this.rootView) {
			this.rootView.dispose();
			this.rootView = null;
		}
		
		this.rootView = hair.render(this.rootDOM, model, view, {
			controller: this,
		});
	}
	
}
