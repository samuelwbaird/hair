// reference the hair library to access the provided functions to generate elements
import { compose, composeEach, onBroadcast, onDelay, onFrame, onContext, listen, elements } from '../../hair.js';

const { h1, h2, div, p, button, progress } = elements;

// -- main menu ------------------------------------------

export function mainMenuView (app) {
	return [
		h1('Example Quiz App'),
		div({ class: 'button-holder' }, composeEach(app.levels, mainMenuButton)),
		p('This app presents simple example quizzes using maths questions with multichoice answers, as an example of structuring multiple views and features like timers.'),
				
		// broadcast example
		div({ class: 'fade-cover' }, onBroadcast('fadeout', (context, element) => {
			// block interaction and fade to white over the top
			element.style.pointerEvents = 'all';
			element.style.opacity = 1;
		})),
	];
}

function mainMenuButton (level) {
	return button(level.label, { class: 'main' }, listen('click', level.action));
}

// -- quiz view ------------------------------------------

export function quizView (quiz) {
	return [
		h1(quiz.name),
		// show the current question is there is one
		compose(quiz.currentQuestion, (question) => questionView(quiz, question)),
		// show the results if they are ready
		compose(quiz.results, resultsOverlay),
	];
}

function questionView (quiz, question) {
	return [
		questionNumber(quiz, question),
		div({ class: 'question-area' }, [
			h2(question.text),
			question.hasBeenAnswered ? questionAnswered(quiz, question) : questionInPlay(quiz, question)
		]),
	];
}

function questionInPlay (quiz, question) {
	let delay = 0;
	return [
		div({ class: 'answer-holder' }, composeEach(question.answers, (answer) => {
			return button(answer.text, { class: 'answer', style: { opacity: 0 } }, [
				listen('click', () => {
					question.selectAnswer(answer);
				}),
				// staggered appearance for each button
				onDelay((++delay * 0.1), (context, element) => {
					element.style.opacity = 1;
				}),
			]);
		})),
		compose(question.timer, timerView),
	];	
}

function questionAnswered (quiz, question) {
	return [
		div({ class: 'answer-holder' }, composeEach(question.answers, (answer) => {
			return button(answer.text, {
				// show which button was selected and which was correct
				class: ['answer', (answer.correct ? 'correct' : '')], 
				disabled: true,
				style: {
					opacity: (answer == question.selectedAnswer) ? 1 : 0.5,
				}
			});
		})),
		// fade out
		onDelay(1.5, (context, element) => {
			element.style.opacity = 0;
		}),
	];
}

function questionNumber (quiz, question) {
	const total = quiz.questions.length;
	const index = (total - quiz.questions.indexOf(question));
	return p('Question ' + index + '/' + total, { class: 'question-number' });
}

function timerView (timer) {
	return div({ class: 'timer-holder' }, [
		progress({ context_id: 'progress', max: 100, value: 100 }, onFrame((context, element) => {
			context.get('progress').value = timer.percentRemaining();
		})),
	]);
}

// -- results -------------------------------------------

function resultsOverlay (results) {
	return div({ class: 'results-holder' }, [
		p('You got', delayedAppearance(0.25)),
		p(results.correct + ' out of ' + results.total, { class: 'results' }, delayedAppearance(0.5)),
		button('OK', { class: 'answer' }, [
			listen('click', (context) => { context.get('app').navMainMenu(); }),
			delayedAppearance(1.5),
		]),
		div({ class: 'fade-cover' }, onBroadcast('fadeout', (context, element) => {
			// block interaction and fade to white over the top
			element.style.pointerEvents = 'all';
			element.style.opacity = 1;
		})),
	]);
}

// give a delayed appearance functionality to an element
function delayedAppearance(delay) {
	return onContext((contextListener) => {
		let cancelToken = null;
		contextListener.onAttach = (context, element) => {
			element.style.opacity = 0;
			cancelToken = delay(delay, () => {
				element.style.opacity = 1;
			}, contextListener);
		}
	});
}
