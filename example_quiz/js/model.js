// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';

export class QuizModel {

	constructor (name, numberOfQuestion, minNumber, maxNumber) {
		this.name = name;
		
		this.questions = [];
		this.remainingQuestions = [];
		
		// just making up a trash quiz for an example
		for (let i = 0; i < numberOfQuestion; i++) {
			const question = new QuizQuestion(this, minNumber, maxNumber);
			this.questions.push(question);
			this.remainingQuestions.push(question);
		}
		
		this.currentQuestion = null;
		this.results = null;
		this.queueNextQuestion();
	}
	
	queueNextQuestion () {
		this.currentQuestion = this.remainingQuestions.pop();
		if (this.currentQuestion) {
			this.currentQuestion.startTimer();
		}
		
		// once all the questions are done generate the results
		if (!this.currentQuestion && !this.results) {
			this.results = new QuizResults();
		}
		h.signal(this);
	}
		
}

class QuizQuestion {
	
	constructor (quiz, minNumber, maxNumber) {
		this.quiz = quiz;
		
		// generate a random multiplication question with 4 possible answers
		const n1 = Math.floor(Math.random() * ((maxNumber + 1) - minNumber)) + minNumber;
		const n2 = Math.floor(Math.random() * ((maxNumber + 1) - minNumber)) + minNumber;
		const answer = n1 * n2;

		this.text = 'What is ' + n1 + ' x ' + n2;
		this.answers = [];

		let shownAnswer = answer - Math.floor(Math.random() * 4);
		while (this.answers.length < 4) {
			if (shownAnswer > 0) {
				this.answers.push(new QuizAnswer(shownAnswer, shownAnswer == answer));
			}
			shownAnswer++;
		}		
		
		this.selectedAnswer = null;
		this.hasBeenAnswered = false;
	}
	
	selectAnswer (answer) {
		if (this.hasBeenAnswered) {
			return;
		}
		
		this.hasBeenAnswered = true;
		this.selectedAnswer = answer;
		h.signal(this);
		
		h.delay(2, () => {
			this.quiz.queueNextQuestion();
		});
	}
	
	startTimer () {
		this.timer = new QuizTimer(10, () => {
			this.selectAnswer(null);
		});
	}
	
}

class QuizTimer {
	
	constructor (seconds, onComplete) {
		this.time = seconds;
		this.due = (Date.now() + ((seconds + 1) * 1000));
		h.delay(seconds, onComplete);
	}
	
	secondsRemaining () {
		const seconds = (this.due - Date.now()) / 1000;
		if (seconds > this.time) {
			return this.time;
		} else if (seconds > 0) {
			return seconds;
		} else {
			return 0;
		}
	}
	
	percentRemaining () {
		return ((this.secondsRemaining() * 100) / this.time);
	}
	
}

class QuizAnswer {
	
	constructor (text, correct) {
		this.text = text;
		this.correct = correct;
	}
	
}

class QuizResults {
	
}