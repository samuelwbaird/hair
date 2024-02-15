// reference the hair library to access the provided functions to generate elements
import * as h from '../../hair.js';

// -- main menu ------------------------------------------

export function mainMenuView (app) {
	return [
		h.h1('Example Quiz App'),
		h.div({ class: 'button-holder' }, h.compose(app.levels, mainMenuButton)),
		h.p('This app presents simple example quizzes using maths questions with multichoice answers, as an example of structuring multiple views and features like timers.'),
				
		// broadcast example
		h.div({ class: 'fade-cover' }, h.onBroadcast('fadeout', (context, element) => {
			// block interaction and fade to white over the top
			element.style.pointerEvents = 'all';
			element.style.opacity = 1;
		})),
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
	return [
		questionNumber(quiz, question),
		h.div({ class: 'question-area' }, [
			h.h2(question.text),
			question.hasBeenAnswered ? questionAnswered(quiz, question) : questionInPlay(quiz, question)
		]),
	];
}

function questionInPlay (quiz, question) {
	let delay = 0;
	return [
		h.div({ class: 'answer-holder' }, h.compose(question.answers, (answer) => {
			return h.button(answer.text, { class: 'answer', style: { opacity: 0 } }, [
				h.listen('click', () => {
					question.selectAnswer(answer);
				}),
				// staggered appearance for each button
				h.onDelay((++delay * 0.1), (context, element) => {
					element.style.opacity = 1;
				}),
			]);
		})),
		h.compose(question.timer, timerView),
	];	
}

function questionAnswered (quiz, question) {
	return [
		h.div({ class: 'answer-holder' }, h.compose(question.answers, (answer) => {
			return h.button(answer.text, {
				// show which button was selected and which was correct
				class: ['answer', (answer.correct ? 'correct' : '')], 
				disabled: true,
				style: {
					opacity: (answer == question.selectedAnswer) ? 1 : 0.5,
				}
			});
		})),
		// fade out
		h.onDelay(1.5, (context, element) => {
			element.style.opacity = 0;
		}),
	];
}

function questionNumber (quiz, question) {
	const total = quiz.questions.length;
	const index = (total - quiz.questions.indexOf(question));
	return h.p('Question ' + index + '/' + total, { class: 'question-number' });
}

function timerView (timer) {
	return h.div({ class: 'timer-holder' }, [
		h.element('progress', { _id: 'progress', max: 100, value: 100 }, h.onFrame((context, element) => {
			context.progress.value = timer.percentRemaining();
		})),
	]);
}

// -- results -------------------------------------------

function resultsOverlay (results) {
	return h.div({ class: 'results-holder' }, [
		h.p('You got', delayedAppearance(0.25)),
		h.p(results.correct + ' out of ' + results.total, { class: 'results' }, delayedAppearance(0.5)),
		h.button('OK', { class: 'answer' }, [
			h.listen('click', (context) => { context.get('app').navMainMenu(); }),
			delayedAppearance(1.5),
		]),
		h.div({ class: 'fade-cover' }, h.onBroadcast('fadeout', (context, element) => {
			// block interaction and fade to white over the top
			element.style.pointerEvents = 'all';
			element.style.opacity = 1;
		})),
	]);
}

// give a delayed appearance functionality to an element
function delayedAppearance(delay) {
	return h.onContext((contextListener) => {
		let cancelToken = null;
		contextListener.onAttach = (context, element) => {
			element.style.opacity = 0;
			cancelToken = h.delay(delay, () => {
				element.style.opacity = 1;
			}, contextListener);
		}
	});
}
