// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

export function mainMenu(controller) {
	return [
		h.h1('Example Quiz App'),
		h.div({ class: 'button-holder' }, h.compose(controller.getLevels(), mainMenuButton)),
		h.p('This example app shows simple example quizzes using maths questions with multichoice answers, to demonstrate ways to structure multiple scenes and features like timers.'),
	];
}

function mainMenuButton(level) {
	return h.button(level.label, { class: 'main' }, h.listen('click', level.action));
}
