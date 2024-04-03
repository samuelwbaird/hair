// hair.tween.js - MIT license, copyright 2024 Samuel Baird
// ===============================================================================
//
// Tweening
//	tween(target, properties, timing, owner)
//	transform, wrap a DOM element in a proxy object that can conveniently read and write the x,y,scale,rotation and opacity of a DOM object 

import * as hair from './hair.js';

// -- tweening ----------------------------------------------------------------------

export function tween(target, properties, timing, owner = null) {
	if (typeof timing == 'number') {
		timing = linear(timing);
	}
	
	return new Tween(target, properties, timing, owner)
}

// allow for await asyncTween(...);
export function asyncTween(target, properties, timing, owner = null) {	
	return new Promise((resume) => {
		const t = tween(target, properties, timing, owner);
		const originalOnComplete = t.timing.onComplete;
		t.timing.onComplete = () => {
			originalOnComplete?.();
			resume();
		};
	});
}

// async? return a promise from the tween that can be awaited instead of onComplete

// variable argument options
// linear(5)								// 5 second transition
// linear(5, 2)								// 5 second transition, 2 second delay before beginning
// linear(5, () => { afterComplete() })		// 5 second transition, onComplete
// linear(5, 2, () => { afterComplete() })	// 5 second transition, 2 second delay, onComplete

export function linear(duration, arg1, arg2) {
	return new TweenTiming(_linearFunction, duration, arg1, arg2);
}

export function easeIn(duration, arg1, arg2) {
	return new TweenTiming(_easeInFunction, duration, arg1, arg2);	
}

export function easeOut(duration, arg1, arg2) {
	return new TweenTiming(_easeOutFunction, duration, arg1, arg2);
}

export function easeInOut(duration, arg1, arg2) {
	return new TweenTiming(_easeInOutFunction, duration, arg1, arg2);
}

export function interpolate(values, duration, arg1, arg2) {
	const max = (values.length - 1);
	const interpolateFunction = (ratio) => {
		const base = Math.floor(ratio * max);
		const offset = (ratio * max) - base;
		if (base >= max) {
			return values[max];
		} else {			
			return (values[base] * (1 - offset)) + (values[base + 1] * offset);
		}
	};
	return new TweenTiming(interpolateFunction, duration, arg1, arg2);
}

class Tween {
	constructor (target, properties, timing, owner) {
		this.target = target;
		this.timing = timing;
		this.owner = owner;
		this.propertiesRequested = properties;
		if (timing.delay == 0) {
			this.#begin();
		} else {
			hair.delay(timing.delay, () => { this.#begin(); }, owner);
		}
	}
	
	#begin () { 
		this.startTime = Date.now();
		this.properties = {}
		for (const k in this.propertiesRequested) {
			this.properties[k] = captureTweenProperty(this.target, k, this.propertiesRequested[k]);
		}
		this.timer = hair.onEveryFrame(() => {
			const now = Date.now();
			this.#update(Math.max(0, Math.min(1, (now - this.startTime) / (this.timing.duration * 1000))));
		}, this.owner);
	}
	
	#update (transition) {
		if (hair.isObjectDisposed(this) || hair.isObjectDisposed(this.owner)) {
			return;
		}
		
		const ratio = this.timing.curveFunction(transition);
		const inverse = 1 - ratio;

		for (const k in this.properties) {
			const prop = this.properties[k];
			this.target[k] = ((prop.initial * inverse) + (prop.final * ratio)) + prop.suffix;
		}

		if (transition >= 1) {
			this.timing.onComplete?.();
			this.cancel();
			return;
		}
	}
	
	complete () {
		if (hair.isObjectDisposed(this) || hair.isObjectDisposed(this.owner)) {
			return;
		}
		this.#update(1);
	}
	
	cancel () {
		if (this.timer) {
			hair.cancel(this.timer);
			this.timer = null;
		}
		this.target = null;
		this.onComplete = null;
		this.properties = null;
		hair.markObjectAsDisposed(this);
	}
	
}

const _linearFunction = (v) => { return v; };
const _easeInFunction = (v) => { return v * v; };
const _easeOutFunction = (v) => { return 1 - ((1 - v) * (1 - v)); };
const _easeInOutFunction = (v) => { return (_easeInFunction(v) * (1 - v)) + (_easeOutFunction(v) * v); }

// timing = delay, duration, easing, onComplete
class TweenTiming {
	
	constructor (curveFunction, duration, arg1, arg2) {
		this.curveFunction = curveFunction;
		this.duration = duration;
		this.delay = 0;
		this.onComplete = null;
		if (typeof arg1 == 'number') {
			this.delay = arg1;
		} else if (typeof arg2 == 'number') {
			this.delay = arg2;
		}
		if (typeof arg1 == 'function') {
			this.onComplete = arg1;
		} else if (typeof arg2 == 'function') {
			this.onComplete = arg2;
		}
	}
	
}

function captureTweenProperty (target, property, final) {
	// capture if this property has a non-numeric suffix (eg. 90px or 10%)
	let initial = target[property];
	let suffix = 0;
	if (typeof initial == 'string') {
		const numeric = initial.match(/^[\d\.\-]+/);
		if (numeric) {
			suffix = initial.substring(numeric[0].length) ?? '';
			initial = parseFloat(numeric[0]);
		}
	}
	return { initial : initial, final : final, suffix: suffix };
}

// -- transform (dom) ---------------------------------------------------------------
// wrap a DOM element with an object that makes it easy to manipulate its style transform properties
// only the few most common 2D properties are supported
export function transform (element) {
	return new Transform(element);
}

class Transform {
	#x; #y; #scale; #rotation; #opacity;
	
	constructor (element) {
		this.element = element;
		const style = getComputedStyle(element);
		const matrix = style.transform
		if (matrix && matrix != 'none') {
			const matrixValues = matrix.match(/matrix.*\((.+)\)/)[1].split(', ');
			this.#x = Number.parseFloat(matrixValues[4]);
			this.#y = Number.parseFloat(matrixValues[5]);
			this.#scale = Math.sqrt(Math.pow(Number.parseFloat(matrixValues[0]), 2) + Math.pow(Number.parseFloat(matrixValues[2]), 2));
			this.#rotation = Math.atan2(Number.parseFloat(matrixValues[1]), Number.parseFloat(matrixValues[0])) * (180 / Math.PI);
		} else {
			this.#x = 0; this.#y = 0; this.#scale = 1; this.#rotation = 0;
		}
		this.#opacity = Number.parseFloat(style.opacity);
	}
	
	get x () { return this.#x; }
	get y () { return this.#y; }
	get scale () { return this.#scale; }
	get rotation () { return this.#rotation; }
	get opacity () { return this.#opacity; }

	set x (value) { this.#x = value; this.#updateTransform(); }	
	set y (value) { this.#y = value; this.#updateTransform(); }	
	set scale (value) { this.#scale = value; this.#updateTransform(); }	
	set rotation (value) { this.#rotation = value; this.#updateTransform(); }	
	set opacity (value) { this.#opacity = value; this.#updateTransform(); }	
	
	#updateTransform () {
		const radians = (this.#rotation * (Math.PI / 180));
		const scale = this.#scale;
		const transform = [ scale * Math.cos(radians), scale * Math.sin(radians), scale * Math.sin(radians) * -1, scale * Math.cos(radians), this.#x, this.#y ];
		this.element.style.transform = 'matrix(' + transform.join(',') + ')';
		this.element.style.opacity = Math.min(1, Math.max(0, this.opacity));
	}
	
}
