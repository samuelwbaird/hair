// -- public interface of the library ---------------------------------

// top level request to render state to a parent using a component
export function render(parent, state, component) {
	// create a context (attached to this parent)
	const context = new RenderContext(parent, component);

	// recursively expand the component in element specs
	context.render(state);

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
// set a reuseKey object or string, to use that to make sure the same composed context is reused for the same purpose
export function compose(state, component, reuseKey) {
	return new ComposeSpecification(state, component, reuseKey);
}

// add an event listener as a child of instantiated elements
export function listen(event, listener) {
	return new ListenSpecification(event, listener, false);
}

// attach, detach, update - re-use references to the same function object to prevent extra updates
// onAttach
// onRemove
// onUpdate

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
export const b = elementFactory('b');
export const i = elementFactory('i');
export const em = elementFactory('em');
export const small = elementFactory('small');
export const u = elementFactory('u');
export const strike = elementFactory('strike');
export const strong = elementFactory('strong');
export const br = elementFactory('br');
export const hr = elementFactory('hr');

export const a = elementFactory('a');
export const img = elementFactory('img');

export const ol = elementFactory('ol');
export const ul = elementFactory('ul');
export const li = elementFactory('li');

export const form = elementFactory('form');
export const option = elementFactory('option');
export const button = elementFactory('button');
export const input = elementFactory('input');
export const label = elementFactory('label');

export const table = elementFactory('table');
export const tr = elementFactory('tr');
export const th = elementFactory('th');
export const td = elementFactory('td');

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
	constructor (state, component, reuseKey) {
		super();
		this.state = state;
		this.component = component;
		this.reuseKey = this.reuseKey ?? this.state;
	}
}

// a data object that specifies an event listener to be attached to instantiated DOM objects
class ListenSpecification extends ComponentSpecification {
	constructor (event, listener) {
		super();
		this.event = event;
		this.listener = listener;
	}
}


// -- Context Objects ------------------------------------
// map the instantiated DOM objects to the components that created them
// helping to support events, callbacks, lifecycle and updates

// QUESTIONS: should h.compose be explicit, or somehow more automatic (compose lets you select a substate to pass to another component)
// explicit, it lets you select a different root state object

// RELATED: should list handling be automatic whenever the state is an array (for all functions, or only for compose)
// maybe.. render/apply/update on a DOM context could detect whenever a list object is the root state object and do.... list stuff
//

// MAYBE: compose automatically and create a sub context whenever a function is supplied as a component (instead of immediately executed)
// What is the natural definition of a context for this purpose
// does every call of apply, or every dom parent element or every function application have its own context
// simplified/explicit answer is every use of h.compose

// Pass globals/shared values into the first context on first render...
// yes set this up


// RenderContext
// RenderPhase

const TIMER_PHASE_MODEL_UPDATES = 1;

// the context for a component having been rendered to the DOM
class RenderContext {

	constructor (parentDOMElement, component) {
		// root of dom rendering
		this.parentDOMElement = parentDOMElement;
		this.component = component;

		// created elements
		this.attachments = [];

		// consolidate updates
		this.updateIsRequested = false;
	}

	// derive a child context
	derive (parentDOMElement, component) {
		const child = new RenderContext(parentDOMElement, component);
		return child;
	}

	// get/find (from this or any parent context)
	// set (at this context level)

	render (state) {
		this.clear();
		this.update(state);
	}

	update (state) {
		if (!state) {
			this.clear();
			return;
		}

		// unwatch signals/updates
		removeWatcher(this);
		this.updateIsRequested = false;

		// begin middle and end of render
		const renderPhase = new RenderPhase(this);
		this.#apply(this.parentDOMElement, state, this.component, renderPhase);
		this.commit(renderPhase);

		// allow signals to trigger an update
		watch(state, () => {
			this.updateIsRequested = state;
			onNextFrame(() => { this.consolidatedUpdateFromSignals(); }, TIMER_PHASE_MODEL_UPDATES, this);
		}, this);
	}

	consolidatedUpdateFromSignals () {
		if (this.updateIsRequested) {
			this.update(this.updateIsRequested);
		}
	}

	clear () {
		// remove all attachments in reverse order
		let i = this.attachments.length;
		while (i > 0) {
			this.attachments[--i].remove();
		}
		this.attachments = [];

		// unwatch signals/updates
		removeWatcher(this);
	}

	dispatch (event, data) {
		// dispatch through children
		// or dispatch through parents

		// onMount, onUpdate, on
	}

	// recursive process to expand the components and apply them to the DOM
	#apply (parent, state, component, renderPhase) {
		if (Array.isArray(state)) {
			// special case list handling... map list items and their component to the created element
			for (const item of state) {
				const subContext = renderPhase.findOrCreateListItemSubContext(this, parent, component, item);
				subContext.update(item);
			}
			return;
		}

		if (typeof component === 'string') {
			renderPhase.findCreateOrUpdateText(parent, component);

		} else if (Array.isArray(component)) {
			for (const c of component) {
				this.#apply(parent, state, c, renderPhase);
			}

		} else if (component instanceof ElementSpecification) {
			// make the new element
			const element = renderPhase.findOrCreateElement(component.type, parent, state);

			// apply the properties of this element
			if (component.properties) {
				for (const [key, value] of Object.entries(component.properties)) {
					// check for special purpose property handlers
					const handler = propertyHandlers[key];
					if (handler) {
						handler(this, element, key, value);
					} else {
						// default handling
						element[key] = value;
					}
				}
			}
			// add the children of this element
			this.#apply(element, state, component.children, renderPhase);

		} else if (component instanceof ComposeSpecification) {
			// compose either a list or sub component
			const subContext = renderPhase.findOrCreateSubContext(this, parent, component.component, component.reuseKey);
			subContext.update(component.state);

		} else if (component instanceof ListenSpecification) {
			renderPhase.findOrCreateDOMListener(this, parent, component.event, component.listener);

		} else if (typeof component === 'function') {
			this.#apply(parent, state, component(state), renderPhase);

		} else if (component == null) {
			// we can ignore

		} else {
			throw new Error('unhandled component type ' + (typeof component));
		}
	}

	commit (renderPhase) {
		// console.log('Render: ' + renderPhase.newAttachments.length + ' new attachments')
		// console.log('Render: ' + renderPhase.priorAttachments.length + ' removed attachments')
		// console.log('Render: ' + renderPhase.attachments.length + ' current attachments')
		// console.log('------')

		// remove prior attachments
		let i = renderPhase.priorAttachments.length;
		while (i > 0) {
			i--;
			renderPhase.priorAttachments[i].remove();
		}
		// these are out new attachments
		this.attachments = renderPhase.attachments;
		// signal attachment on new attachments
		for (const attachment of renderPhase.newAttachments) {
			attachment.attach();
		}
	}

	dispose () {
		this.clear();
		markObjectAsDisposed(this);
	}
}

class RenderPhase {

	constructor (context) {
		this.context = context;

		// take a copy of all existing sub elements and sub contexts
		// and attempt to re-use and update them during the render pass
		this.priorAttachments = [...context.attachments];

		// attachments created or in use this render
		this.attachments = [];

		// new attachments that need to be signalled on creation
		this.newAttachments = [];
	}

	findOrCreateSubContext (context, parent, component, keyObject) {
		const keys = [ parent, keyObject ];
		const existing = this.find(SubContextAttachment, keys);
		if (existing) {
			existing.component = component;
			return existing.context;
		}

		const sub = context.derive(parent, component);
		this.addAttachment(new SubContextAttachment(sub), keys)
		return sub;
	}

	findOrCreateListItemSubContext (context, parent, component, keyObject) {
		const keys = [ parent, keyObject ];
		const existing = this.find(SubContextAttachment, keys);
		if (existing) {
			existing.component = component;
			return existing.context;
		}

		const sub = context.derive(parent, component);
		this.addAttachment(new SubContextAttachment(sub), keys)
		return sub;
	}

	findOrCreateElement (type, parent, state) {
		const keys = [ type, parent, state ];
		const existing = this.find(ElementAttachment, keys);
		if (existing) {
			return existing.element;
		}

		const element = document.createElement(type);
		parent.appendChild(element);
		this.addAttachment(new ElementAttachment(element), keys);
		return element;
	}

	findCreateOrUpdateText (parent, text) {
		const keys = [ parent ];
		const existing = this.find(TextAttachment, keys);
		if (existing) {
			existing.textNode.textContent = text;
			return existing;
		}

		const textNode = document.createTextNode(text);
		parent.appendChild(textNode);
		this.addAttachment(new TextAttachment(textNode), keys);
		return textNode;
	}

	findOrCreateDOMListener (context, parent, event, listener) {
		const keys = [ context, parent, event ];
		const existing = this.find(DOMListenerAttachment, keys);
		if (existing) {
			existing.listener = listener;
			return existing;
		}

		return this.addAttachment(new DOMListenerAttachment(context, parent, event, listener), keys);
	}

	find (attachmentType, keys) {
		// NOTE: this linear search might be very inefficient on large components or long lists
		// could replace with some kind of multi-key dictionary if needed
		let i = 0;
		search: while (i < this.priorAttachments.length) {
			const attachment = this.priorAttachments[i];
			if (attachment instanceof attachmentType) {
				for (let j = 0; j < keys.length; j++) {
					if (keys[j] != attachment.keys[j]) {
						i++;
						continue search;
					}
				}
				this.priorAttachments.splice(i, 1);
				this.attachments.push(attachment);
				return attachment;
			}
			i++;
		}
		return null;
	}

	addAttachment (attachment, keys) {
		attachment.keys = keys;
		this.attachments.push(attachment);
		this.newAttachments.push(attachment);
		return attachment;
	}

}

class RenderAttachment {
	// be prepared to let go of your attachments
	attach () {}
	remove () {}
}

class SubContextAttachment extends RenderAttachment {
	constructor (context) {
		super();
		this.context = context;
	}

	remove () {
		this.context.dispose();
	}
}

class ElementAttachment extends RenderAttachment {
	constructor (element) {
		super();
		this.element = element;
	}

	remove () {
		this.element.remove();
	}
}

class TextAttachment extends RenderAttachment {
	constructor (textNode) {
		super();
		this.textNode = textNode;
	}

	remove () {
		this.textNode.remove();
	}
}

class DOMListenerAttachment extends RenderAttachment {
	constructor (context, element, eventName, handler) {
		super();
		this.element = element;
		this.eventName = eventName;
		this.handler = handler;
		this.wrappedHandler = (evt) => { this.handler(context, element, evt); }
	}

	attach () {
		this.element.addEventListener(this.eventName, this.wrappedHandler);
	}

	remove () {
		this.element.removeEventListener(this.eventName, this.wrappedHandler);
	}
}

class ContextListenerAttachment {

}

// -- setting properties that need specific handling ------------------------
// property names that have specific functionality to apply them
const propertyHandlers = {
	_id: applyContextIDProperty,
	class: applyClassList,
	style: applyMergedProperties,
}

export function setPropertyHandler(name, handler) {
	propertyHandlers[name] = handler;
}

function applyContextIDProperty(context, element, key, value) {
	context[value] = element;
}

function applyClassList(context, element, key, value) {
	// allow either a single class or array of class names
	if (!Array.isArray(value)) {
		value = [value];
	}
	const newNames = new Set();
	for (const className of value) {
		newNames.add(className);
		if (!element.classList.contains(className)) {
			element.classList.add(className);
		}
	}
	for (const className of element.classList) {
		if (!newNames.has(className)) {
			element.classList.remove(value);
		}
	}
}

function applyMergedProperties(context, element, key, value) {
	const mergeInto = element[key];
	for (const [k, v] of Object.entries(value)) {
		mergeInto[k] = v;
	}
}


// -- watch / signal / removeWatcher -------------------------------------------
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

export function removeWatcher(owner) {
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

// -- delay / onNextFrame ---------------------------------------
// a consolidated timer for events that need to occur on a later render frame
// requestAnimationFrame is used to align updates smoothly with rendering
// but is only activated around when delayed actions are actually requested

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
	delayedActions.sort((a, b) => {
		return a.time - b.time;
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

export function cancel(owner) {
	let i = 0;
	while (i < delayedActions.length) {
		if (delayedActions[i].owner == owner) {
			delayedActions.splice(i, 1);
		} else {
			i++;
		}
	}
}

const READY_TIME = 100;
let frameIsRequested = false;
let longDelayTimeout = false;

function requestFrameTimer() {
	if (frameIsRequested || delayedActions.length == 0) {
		return;
	}

	// work out if a long delay or short delay is needed next
	const next = delayedActions[delayedActions.length - 1].time;
	const now = Date.now();

	// cancel any current timeout
	if (longDelayTimeout) {
		clearTimeout(longDelayTimeout);
		longDelayTimeout = false;
	}

	// if the next action is soon then request an animation frame
	if (next - now < READY_TIME) {
		frameIsRequested = true;
		requestAnimationFrame(_animationFrame);
		return;
	}

	// if the next action is not soon then request a timeout closer to the time
	longDelayTimeout = setTimeout(requestFrameTimer, (next - now) - READY_TIME);
}

function _animationFrame() {
	// set aside all actions now due
	const now = Date.now();
	const toBeActioned = [];
	while (delayedActions.length > 0 && delayedActions[delayedActions.length - 1].time <= now) {
		toBeActioned.push(delayedActions.pop());
	}

	// make sure the next frame is correctly queued if required
	frameIsRequested = false;
	requestFrameTimer();

	// ordered by phase to allow more consistent dispatch ordering
	toBeActioned.sort((a, b) => {
		return a.phase - b.phase;
	});
	// dispatch all actions (ignoring disposed owners)
	for (const delayed of toBeActioned) {
		if (!isObjectDisposed(delayed.owner)) {
			delayed.action();
		}
	}
}

// -- markObjectAsDisposed / isObjectDisposed ---------------------------------------
// a globally available system to mark any object as disposed
// disposed objects are ignored in timers and signals

const disposeSet = new WeakSet();

export function markObjectAsDisposed(obj) {
	disposeSet.add(obj);
}

export function isObjectDisposed(obj) {
	if (!obj) {
		return false;
	}
	return disposeSet.has(obj);
}
