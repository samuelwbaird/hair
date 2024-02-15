// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

// -- main menu ------------------------------------------

export function mainMenuView (app) {
	return [
		h.h1('Example Quiz App'),
		h.div({ class: 'button-holder' }, h.compose(app.levels, mainMenuButton)),
		h.p('This app presents simple example quizzes using maths questions with multichoice answers, as an example of structuring multiple views and features like timers.'),
	];
}

function mainMenuButton (level) {
	return h.button(level.label, { class: 'main' }, h.listen('click', level.action));
}

// -- quiz view ------------------------------------------

export function quizView (quiz) {
	return [
		h.h1(quiz.name),
		// show the current question is there is one
		h.compose(quiz.currentQuestion, (question) => questionView(quiz, question)),
		// show the results if they are ready
		h.compose(quiz.results, resultsOverlay),
	];
}

function questionView (quiz, question) {
	if (!question) {
		return;
	}
		
	if (question.selectedAnswer != null) {
		return [
			h.h2(question.text),
			h.div({ class: 'answer-holder' }, h.compose(question.answers, (answer) => {
				return h.button(answer.text, {
					class: ['answer', (answer.correct ? 'correct' : '')], 
					disabled: true,
					style: {
						opacity: (answer == question.selectedAnswer) ? 1 : 0.5,
					}
				});
			})),
		];
		
	} else {
		return [
			h.h2(question.text),
			h.div({ class: 'answer-holder' }, h.compose(question.answers, (answer) => {
				return h.button(answer.text, { class: 'answer' }, h.listen('click', () => {
					question.selectAnswer(answer);
					h.delay(1, () => {
						quiz.queueNextQuestion();
					});
				}))			
			})),
			// TODO: add visual time limit to answer
			// TODO: add staggered appearance of each button
		];
	}
}

// -- results -------------------------------------------

function resultsOverlay (results) {
	if (!results) {
		return;
	}
	
	return [
		h.button('Return', h.listen('click', (context) => { context.get('controller').navMainMenu(); })),
	];
}