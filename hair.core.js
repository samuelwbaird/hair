// hair.core.js - MIT license, copyright 2024 Samuel Baird
// ====================================================================================
// Signals and Timers
//   Watcher, watch, signal, removeWatcher
//	   watch and signal allow components to "watch" any object for signals
//	   signalling on a state or model object will trigger views to updates
//     can be used as simple event system, objects are tracked in WeakMaps to prevent interfering with garbage collection
//
//   DelayedAction, delay, timer, onNextFrame, onEveryFrame
//     globally available timer and event callback
//     all callbacks occur during a requestAnimationFrame timeslot, but animation frames are only active when required
//
//   Disposal markObjectAsDisposed, isObjectDisposed
//	   arbitrarily mark any object as disposed
//	   used to check where delayed actions and watched signals should be ignored if related to outdated renders
//	   objects are tracked in a WeakSet to prevent interfering with garbage collection
// ===============================================================================

// -------------------------------------------------------------------------------
// hair.signals, callbacks and requestAnimationFrame updates as required
// -------------------------------------------------------------------------------

// -- watch / signal / removeWatcher -------------------------------------------
// a global weakly linked signal/watch system

const watchMap = new WeakMap();
const ownerMap = new WeakMap();

export function watch(object, action, owner) {
	// add this action and owner to weak watch list for this object
	if (!watchMap.has(object)) {
		watchMap.set(object, []);
	}
	const watcher = new Watcher(object, action, owner);
	watchMap.get(object).push(watcher);

	// reverse map owner to watched objects to help with reversal
	if (owner) {
		if (!ownerMap.has(owner)) {
			ownerMap.set(owner, []);
		}
		ownerMap.get(owner).push(watcher);
	}

	// return the specific action+owner object to allow cancelling that specifically also
	return watcher;
}

export function signal(object, ...args) {
	if (!watchMap.has(object) || isObjectDisposed(object)) {
		return;
	}

	const list = watchMap.get(object);
	for (const watcher of [...list]) {
		if (!isObjectDisposed(watcher.owner)) {
			watcher.action(...args);
		}
	}
}

/** remove a specific watcher or all watchers for an owner */
export function removeWatcher(ownerOrWatcher) {
	if (ownerOrWatcher instanceof Watcher) {
		const watchersForObject = watchMap.get(ownerOrWatcher.object);
		if (watchersForObject) {
			let i = watchersForObject.length;
			while (i > 0) {
				if (watchersForObject[--i] == ownerOrWatcher) {
					watchersForObject.splice(i, 1);
				}
			}
			if (watchersForObject.length == 0) {
				watchMap.delete(ownerOrWatcher.object);
			}
		}

	} else if (ownerMap.has(ownerOrWatcher)) {
		const allWatchersForOwner = ownerMap.get(ownerOrWatcher);
		ownerMap.delete(ownerOrWatcher);
		for (const watcher of allWatchersForOwner) {
			removeWatcher(watcher);
		}
	}
}

class Watcher {
	constructor (object, action, owner) {
		this.object = object;
		this.action = action;
		this.owner = owner;
	}
}

// -- delay / onNextFrame ---------------------------------------
// a consolidated timer for events that need to occur on a later render frame
// requestAnimationFrame is used to align updates smoothly with rendering
// but is only activated around when delayed actions are actually requested

const delayedActions = [];

export function delay (seconds, action, owner) {
	const delayedAction = new DelayedAction(Date.now() + (seconds * 1000), action, owner);
	delayedActions.push(delayedAction);
	// sort the upcoming actions to the end of the list
	delayedActions.sort((a, b) => { return b.time - a.time; });
	requestFrameTimer();
	return delayedAction;
}

export function timer (seconds, action, owner) {
	const delayedAction = delay(seconds, action, owner);
	delayedAction.repeat = seconds;
	return delayedAction;
}

export function onNextFrame (action, owner) {
	const delayedAction = new DelayedAction(0, action, owner);
	delayedActions.push(delayedAction);
	requestFrameTimer();
	return delayedAction;
}

export function onEveryFrame (action, owner) {
	const delayedAction = onNextFrame(action, owner);
	delayedAction.repeat = 0;
	return delayedAction;
}

export function onAnyFrame (action, owner) {
	const delayedAction = new DelayedAction(0, action, owner);
	delayedActions.push(delayedAction);
	delayedAction.repeat = 0;
	delayedAction.doesNotRequestFrames = true;
	return delayedAction;
}

export function cancel (owner) {
	if (!owner) {
		return;
	}

	let i = 0;
	while (i < delayedActions.length) {
		const check = delayedActions[i];
		if (check == owner || check.owner == owner) {
			delayedActions.splice(i, 1);
		} else {
			i++;
		}
	}
}

const READY_TIME = 50;			// how many ms ahead of the requested time slot do we switch from setTimeout to requestAnimationFrame
let frameIsRequested = false;	// is an animationFrameRequest for the next frame already in play?
let longDelayTimeout = false;	// is a timeout for delayed animation frames already in play?

// set a consistent time at the start of any timer events
export let frameStartTime = Date.now();
export let frameDeltaSeconds = 0;

function requestFrameTimer () {
	if (frameIsRequested || delayedActions.length == 0) {
		return;
	}

	// cancel any current timeout
	if (longDelayTimeout) {
		clearTimeout(longDelayTimeout);
		longDelayTimeout = false;
	}

	// work out if a long delay or short delay is needed next
	let next = false;
	let i = delayedActions.length;
	while (--i >= 0) {
		if (!delayedActions[i].doesNotRequestFrames) {
			next = delayedActions[i].time;
			break;
		}
	}
	if (next === false) {
		return;
	}

	// if the next action is soon then request an animation frame
	const now = Date.now();
	if (next - now < READY_TIME) {
		frameIsRequested = true;
		requestAnimationFrame(_animationFrame);
		return;
	}

	// if the next action is not soon then request a timeout closer to the time
	longDelayTimeout = setTimeout(requestFrameTimer, (next - now) - READY_TIME);
}

function _animationFrame () {
	// set aside all actions now due
	const now = Date.now();
	frameDeltaSeconds = (now - frameStartTime) / 1000.0;
	frameStartTime = now;

	const toBeActioned = [];
	const toBeRepeated = [];
	while (delayedActions.length > 0 && delayedActions[delayedActions.length - 1].time <= frameStartTime) {
		const delayed = delayedActions.pop();
		toBeActioned.push(delayed);
		// does this action have a repeat built in
		if (typeof delayed.repeat == 'number' && !isObjectDisposed(delayed.owner)) {
			toBeRepeated.push(delayed);
		}
	}
	// reschedule repeating actions
	if (toBeRepeated.length > 0) {
		for (const delayed of toBeRepeated) {
			delayed.time = frameStartTime + (delayed.repeat * 1000);
			delayedActions.push(delayed);
		}
		delayedActions.sort((a, b) => { return b.time - a.time; });
	}

	// make sure the next frame is correctly queued if required
	frameIsRequested = false;
	requestFrameTimer();

	// ordered by phase to allow more consistent dispatch ordering
	toBeActioned.sort((a, b) => { return a.phase - b.phase; });

	// dispatch all actions (ignoring disposed owners)
	for (const delayed of toBeActioned) {
		if (!isObjectDisposed(delayed.owner)) {
			delayed.action();
		}
	}
}

class DelayedAction {
	constructor (time, action, owner, repeat) {
		this.time = time;
		this.action = action;
		this.owner = owner;

		// override this with a number to set a recurring delay to repeat the event after the first time it is called
		this.repeat = false;

		// override this with another number to control how timer events are sorted within the same timeslice
		this.phase = 0;
	}
}


// -- markObjectAsDisposed / isObjectDisposed ---------------------------------------
// a globally available system to mark any object as disposed
// disposed objects are ignored in timers and signals

const disposeSet = new WeakSet();

export function markObjectAsDisposed (obj) {
	disposeSet.add(obj);
}

export function isObjectDisposed (obj) {
	if (!obj) {
		return false;
	}
	return disposeSet.has(obj);
}
