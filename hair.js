// -- watch / signal ---------------------------------------------
// a global weakly linked signal/watch system

const watchMap = new WeakMap();

export function watch(object, action) {

}

export function signal(object) {

}

// _consolidatedSignals


// -- delay / frame ---------------------------------------
// manage a consolidated timer for events that need to occur on a later render frame

const delayedActions = [];

export function delay(seconds, action, phase, owner) {
	phase = phase ?? 0;
	delayedActions.push({
		time: Date.now() + (seconds * 1000),
		action: action,
		phase: phase,
		owner: owner,
	});
	// sort the upcoming actions to the end of the list
	delayedActions.sort((a1, a2) => {
		return a2.time - a1.time;
	});
	requestFrameTimer();
}

export function onNextFrame(action, phase, owner) {
	phase = phase ?? 0;
	delayedActions.push({
		time: 0,
		action: action,
		phase: phase,
		owner: owner,
	});
	requestFrameTimer();
}

let frameIsRequested = false;
let longDelay = null;

function requestFrameTimer() {
	if (frameIsRequested) {
		return;
	}
	
	// work out if a long delay or short delay is needed next

}

function actionFrame() {
	
}



// -- dispose / isDisposed ---------------------------------------
// a globally available system to mark any object as disposed

const disposeSet = new WeakSet();

export function dispose(obj) {
	disposeSet.set(obj);
}

export function isDisposed(obj) {
	return disposeSet.has(obj);
}



// -- Element Spec ---------------------------------------
// describe HTML elements for creation or update as the output from components

// a data object that contains the spec for a DOM element to be rendered or updated
class ElementSpec {
	constructor (type, properties, children) {
		this.type = type;
		this.properties = properties;
		this.children = children;
	}
}

// construct an element spec with variable arguments
export function element(type, arg1, arg2, arg3) {
	let properties = null;
	let children = [];

	for (const arg of  [arg1, arg2, arg3]) {
		if (typeof arg === 'string') {
			// strings are a valid child element
			children.push(arg);
		} else if (Array.isArray(arg)) {
			for (const child of arg) {
				children.push(child);
			}
		} else if ((arg instanceof ComposeSpec) || (arg instanceof ListenSpec) || (arg instanceof ElementSpec)) {
			children.push(arg);
		} else if (typeof arg === 'function') {
			children.push(arg);
		} else if (typeof arg === 'object') {
			if (properties != null) {
				throw new Error('multiple property objects for HTML element');
			}
			properties = arg;
		}
	}

	return new ElementSpec(type, properties, children);
}

// as a convenience provide built in element spec generators for common elements
export function elementFactory(type) {
	return function (arg1, arg2, arg3) {
		return element(type, arg1, arg2, arg3);
	}
}

// create some common element tags for convenience
export const div = elementFactory('div');

export const h1 = elementFactory('h1');
export const h2 = elementFactory('h2');
export const h3 = elementFactory('h3');
export const h4 = elementFactory('h4');
export const h5 = elementFactory('h5');

export const p = elementFactory('p');
export const span = elementFactory('span');
export const hr = elementFactory('h2');

export const ol = elementFactory('ol');
export const ul = elementFactory('ul');
export const li = elementFactory('li');

export const button = elementFactory('button');
export const input = elementFactory('input');

// mark a point within the render tree that is composed with its own render context or list
class ComposeSpec {
	constructor (state, component) {
		this.state = state;
		this.component = component;
	}
}

export function compose(state, component) {
	return new ComposeSpec(state, component);
}


// mark a point within the render tree that is composed with its own render context or list
class ListenSpec {
	constructor (event, listener, once) {
		this.event = event;
		this.listener = listener;
		this.once = once;
	}
}

export function listen(event, listener) {
	return new ListenSpec(event, listener, false);
}

export function once(event, listener) {
	return new ListenSpec(event, listener, true);	
}

// -- Context Objects ------------------------------------
// map the instantiated DOM objects to the state and components that created them

// the context for a component having been rendered to the DOM
class DOMContext {
	constructor (contextParent, domParent, state, component) {
		this.state = state;
		this.component = component;
	}
	
	update (state) {
		
	}
	
	dispatch (event, data) {
		
	}
	
	dispose () {
		
	}
}

class DOMListContext extends DOMContext {
	constructor (contextParent, domParent, state, component) {
		super(contextParent, domParent, state, component);
	}

	// specialist list version of update
}


// -- Main render entry point  ------------------------------

export function render(parent, state, component) {
	// create a context (attached to this parent)
	const context = new DOMContext(null, parent, state, component);

	// recursively expand the component in element specs
	innerRender(context, parent, state, component);

	// mount events
	context.dispatch('onMount');
	context.dispatch('onUpdate');
	return context;
}

// property names that have specific functionality to apply them
const propertyHandlers = {
	_id: applyIDProperty,

	_class: applyClasses,
	className: applyClasses,
	classes: applyClasses,
}


// recursive process to expand the components and apply them to the DOM
function innerRender(context, parent, state, component) {
	if (Array.isArray(component)) {
		for (const c of component) {
			innerRender(context, parent, state, c);
		}
		return;
	}

	if (typeof component === 'string') {
		parent.appendChild(document.createTextNode(component));

	} else if (component instanceof ElementSpec) {
		// make the new element
		const element = document.createElement(component.type);
		parent.appendChild(element);
		// apply the properties of this element
		if (component.properties) {
			for (const [key, value] of Object.entries(component.properties)) {
				// check for special purpose property handlers
				const handler = propertyHandlers[key];
				if (handler) {
					handler(context, element, key, value);
				} else {
					// default handling
					element[key] = value;
				}
			}
		}
		// add the children of this element
		innerRender(context, element, state, component.children);

	} else if (component instanceof ComposeSpec) {
		// compose either a list or sub component
		if (Array.isArray(component.state)) {
			const listContext = new DOMListContext(context, parent, component.state, component.component);
			for (const item of component.state) {
				const subContext = new DOMContext(listContext, parent, item, component.component);
				innerRender(subContext, parent, item, component.component);
			}
		} else {
			const subContext = new DOMContext(context, parent, component.state, component.component);
			innerRender(subContext, parent, component.state, component.component);
		}
		
	} else if (component instanceof ListenSpec) {
		// not implemented yet
		
	} else if (typeof component === 'function') {
		innerRender(context, parent, state, component(state));

	} else if (component == null) {
		// we can ignore

	} else {
		throw new Error('unhandled component type ' + (typeof item));
	}
}

function applyIDProperty(context, element, key, value) {
	context[value] = element;
}

function applyClasses(context, element, key, value) {
}

function applyMerged(context, element, key, value) {
}