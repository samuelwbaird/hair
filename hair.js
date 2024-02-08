// -- public interface of the library ---------------------------------

// top level request to render state to a parent using a component
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

// construct an element spec for rendering with variable arguments
// arguments in any order can include a string of text content, a property object, and child components
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
		} else if (arg instanceof ComponentSpecification) {
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

	return new ElementSpecification(type, properties, children);
}

// mark a point within the render tree that is composed with its own render context or list
export function compose(state, component) {
	return new ComposeSpecification(state, component);
}

// add an event listener as a child of instantiated elements
export function listen(event, listener) {
	return new ListenSpecification(event, listener, false);
}

// add an event listener as a child of instantiated elements that fires at most once
export function once(event, listener) {
	return new ListenSpecification(event, listener, true);	
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
export const label = elementFactory('label');


// -- Component Specification ---------------------------------------
// components are presented as text, a function, an array, _or_ as one of these known objects

class ComponentSpecification {
	// a base class to identify objects that should be treated as renderable specifications when encountered in arguments or components
}

// a data object that contains the spec for a DOM element to be rendered or updated
class ElementSpecification extends ComponentSpecification {
	constructor (type, properties, children) {
		super();
		this.type = type;
		this.properties = properties;
		this.children = children;
	}
}

// a data object that specifies a sub-render (object or list) to be composed at a point in the render tree
class ComposeSpecification extends ComponentSpecification {
	constructor (state, component) {
		super();
		this.state = state;
		this.component = component;
	}
}

// a data object that specifies an event listener to be attached to instantiated DOM objects
class ListenSpecification extends ComponentSpecification {
	constructor (event, listener, once) {
		super();
		this.event = event;
		this.listener = listener;
		this.once = once;
	}
}


// -- Context Objects ------------------------------------
// map the instantiated DOM objects to the state and components that created them
// helping to support events, callbacks, lifecycle and updates

// the context for a component having been rendered to the DOM
class DOMContext {
	constructor (contextParent, domParent, state, component) {
		this.state = state;
		this.component = component;
		watch(state, () => {
			console.log('state was signaled');
		}, this);
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



// property names that have specific functionality to apply them
const propertyHandlers = {
	_id: applyIDProperty,

	_class: applyClasses,
	className: applyClasses,
	classes: applyClasses,
}

function applyIDProperty(context, element, key, value) {
	context[value] = element;
}

function applyClasses(context, element, key, value) {
}

function applyMerged(context, element, key, value) {
}

// recursive process to expand the components and apply them to the DOM
function innerRender(context, parent, state, component) {
	if (typeof component === 'string') {
		parent.appendChild(document.createTextNode(component));

	} else if (Array.isArray(component)) {
		for (const c of component) {
			innerRender(context, parent, state, c);
		}

	} else if (component instanceof ElementSpecification) {
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

	} else if (component instanceof ComposeSpecification) {
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
		
	} else if (component instanceof ListenSpecification) {
		// not implemented yet
		
	} else if (typeof component === 'function') {
		innerRender(context, parent, state, component(state));

	} else if (component == null) {
		// we can ignore

	} else {
		throw new Error('unhandled component type ' + (typeof item));
	}
}


// -- watch / signal ---------------------------------------------
// a global weakly linked signal/watch system

const watchMap = new WeakMap();
const ownerMap = new WeakMap();

export function watch(object, action, owner) {
	// add this action and owner to weak watch list for this object
	if (!watchMap.has(object)) {
		watchMap.set(object, []);
	}
	watchMap.get(object).push({
		action: action,
		owner: owner,
	});

	// reverse map owner to watched objects to help with reversal
	if (owner) {
		if (!ownerMap.has(owner)) {
			ownerMap.set(owner, []);
		}
		ownerMap.get(owner).push(object);
	}
}

export function signal(object, ...args) {
	if (!watchMap.has(object)) {
		return;
	}
	
	const list = watchMap.get(object);
	for (const watcher of list) {
		watcher.action(...args);
	}
}

export function unwatch(owner) {
	if (!ownerMap.has(owner)) {
		return;
	}
	
	const list = ownerMap.get(owner);
	ownerMap.delete(owner);
	let i = 0;
	while (i < list.length) {
		if (list[i].owner == owner) {
			list.splice(i, 1);
		} else {
			i++;
		}
	}
}

// _consolidatedSignals (implement on the context, not here)


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
