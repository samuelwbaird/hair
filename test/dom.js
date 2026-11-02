// shared test setup, a jsdom window installed as globals before hair.js is used
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
for (const name of ['window', 'document', 'requestAnimationFrame', 'Node', 'HTMLElement', 'HTMLInputElement', 'MutationObserver']) {
	globalThis[name] = dom.window[name];
}

// errors reported (rather than thrown) by hair are collected here
export const reportedErrors = [];
globalThis.reportError = (error) => { reportedErrors.push(error); };

// a fresh, attached parent element for each test
export function root () {
	const element = document.createElement('div');
	document.body.appendChild(element);
	return element;
}

// wait long enough for any requested animation frames to run
export function nextFrame () {
	return new Promise((resolve) => setTimeout(resolve, 50));
}

// count nodes removed from (ie. moved within) a parent while running an action
export function countMoves (parent, action) {
	const records = [];
	const observer = new MutationObserver(() => {});
	observer.observe(parent, { childList: true });
	action();
	records.push(...observer.takeRecords());
	observer.disconnect();
	return records.reduce((total, record) => total + record.removedNodes.length, 0);
}
