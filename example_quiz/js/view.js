// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

export function mainMenuView(app) {
	return [
		h.h1('Example Quiz App'),
		h.div({ class: 'button-holder' }, h.compose(app.levels, mainMenuButton)),
		h.p('This app presents simple example quizzes using maths questions with multichoice answers, as an example to demonstrate ways to structure multiple scenes and features like timers.'),
	];
}

function mainMenuButton(level) {
	return h.button(level.label, { class: 'main' }, h.listen('click', level.action));
}

export function quizView(quiz) {
	return h.button('Return', h.listen('click', (context) => { context.get('controller').navMainMenu(); }));
}
