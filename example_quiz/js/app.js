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
		this.#setMainView({ levels: this.getLevels() }, view.mainMenuView);
	}
	
	getLevels () {
		return [
			{ label: 'Easy Quiz', action: () => { this.startLevel(new model.QuizModel('Easy Quiz', 5, 1, 5)); } },
			{ label: 'Medium Quiz', action: () => { this.startLevel(new model.QuizModel('Medium Quiz', 5, 3, 7)); }  },
			{ label: 'Hard Quiz', action: () => { this.startLevel(new model.QuizModel('Hard Quiz', 5, 1, 12)); }  },
		];
	}
	
	startLevel (quiz) {
		//fade out the menu
		this.rootView.broadcast('fadeout');
		hair.delay(0.25, () => {
			this.#setMainView(quiz, view.quizView);
		});
	}
	
	#setMainView(model, view) {
		if (this.rootView) {
			this.rootView.dispose();
			this.rootView = null;
		}
		
		this.rootView = hair.render(this.rootDOM, model, view, {
			app: this,
		});
	}
	
}
