// hair.js - MIT license, copyright 2024 Samuel Baird
// ====================================================================================
// The code is split into three main sections:
//  * component specifications, ie. describing the view to be rendered in a composable way
//  * render, creating or updating DOM elements to match that description
//  * signals and timers, watching for updated objects and requesting animation frames when required
// -----------------------------------------------------------------------------------
// Top level export public functions to define and render views
// 	 render
//
//   Functions to compose component specifications for render
//     element, compose, list
//	   onAttach, onRemove, onUpdate, onContext
//	   onBroadcast, onDelay, onTimer
//
//   Component specification classes
//	   These data objects capture the specifications that will be used to produce or update the DOM in a render pass
// -----------------------------------------------------------------------------------
// Rendering
//   RenderContext
//	   captures the combination of a component spec and a DOM parent element and is created on first render
//	   the context can be retained and used to update the render with update state
//	   it will re-use and clean up elements as required to achieve this
//
//   RenderPhase
//	   is created for each recursive render or update pass of a context
//	   tracks created and reused elements to merge and clean up changes at the end of each render
// 
//   RenderAttachments
//	   objects created during render or update that attach functionality to a rendered DOM view
//
//   Property Handlers
//     eg. setPropertyHandler, applyClassList
//	   specialised handling of matching property names when applied to DOM elements
// -----------------------------------------------------------------------------------
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
// -----------------------------------------------------------------------------------
// Debug
//	set MONITOR_DOM_UPDATES to true to trace a simple count of DOM objects created or moved during rendering
// ===============================================================================


// -------------------------------------------------------------------------------
// top level request to render state to a parent using a component
// -------------------------------------------------------------------------------

export function render (parent, state, component, initialContextValues = null) {
	// create a context (attached to this parent)
	const context = new RenderContext(parent, component, initialContextValues);

	// recursively expand the component in element specs
	context.render(state);

	return context;
}

// -------------------------------------------------------------------------------
// hair.component-specifications, describe your components for rendering
// -------------------------------------------------------------------------------

// construct an element spec for rendering with variable arguments
// arguments in any order can include a string of text content, a property object, and child components
export function element (type, arg1, arg2, arg3) {
	let properties = null;
	let children = [];

	for (const arg of  [arg1, arg2, arg3]) {
		if (typeof arg === 'string') {
			// strings are a valid child element
			children.push(arg);
		} else if (typeof arg == 'number') {
			// treat numbers are strings
			children.push(arg.toString());
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
export function compose (state, component, reuseKey) {
	return new ComposeSpecification(state, component, reuseKey);
}

// add a DOM event listener as a child of instantiated elements
export function listen (event, listener) {
	return new ListenSpecification(event, listener, false);
}

export function onAttach (listener, ...reuseKeys) {
	// run once when attached
	return new ContextListenerSpecification('attach', (contextListener) => {
		contextListener.onAttach = listener;
	}, ...reuseKeys);
}

export function onRemove (listener, ...reuseKeys) {
	// run once when removed
	return new ContextListenerSpecification('remove', (contextListener) => {
		contextListener.onRemove = listener;
	}, ...reuseKeys);
}

export function onUpdate (listener, ...reuseKeys) {
	// run whenever this component is created or updated 
	return new ContextListenerSpecification('update', (contextListener) => {
		contextListener.onUpdate = listener;
	}, ...reuseKeys);
}

export function onBroadcast (event, listener, ...reuseKeys) {
	// receive arbitrary events through the context tree
	return new ContextListenerSpecification('broadcast', (contextListener) => {
		contextListener.onBroadcast = (event, eventData) => {
			if (event == event) {
				listener(contextListener.context, contextListener.element, eventData);
			}
		}
	}, ...reuseKeys);
}

export function onDelay (time, listener, ...reuseKeys) {
	// action X seconds after this component exists (if it still exists)
	return new ContextListenerSpecification('delay', (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = delay(time, () => {
				listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, ...reuseKeys);
}

export function onTimer (time, listener, ...reuseKeys) {
	// repeat every X seconds while this component exists
	return new ContextListenerSpecification('timer', (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = timer(time, () => {
				listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, ...reuseKeys);
}

export function onFrame (listener, ...reuseKeys) {
	// run every animation while this component exists
	return new ContextListenerSpecification('frame', (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = onEveryFrame(() => {
				listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, ...reuseKeys);
}

export function onContext (configurator, ...reuseKeys) {
	return new ContextListenerSpecification('general', (contextListener) => {
		// use contextListener, contextListener.context, and contextListener.element
		// and set onAttach, onRemove, onUpdate, onBroadcast handlers
		configurator(contextListener);
	});
}

// as a convenience provide built in element spec generators for common elements
export function elementFactory (type) {
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
		this.reuseKey = reuseKey ?? this.state;
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

class ContextListenerSpecification extends ComponentSpecification {
	constructor (type, configurator, ...reuseKeys) {
		super();
		this.type = type;
		this.configurator = configurator;
		this.reuseKeys = [...reuseKeys];
	}	
}

// -------------------------------------------------------------------------------
// hair.render, render component specications into the dom
// -------------------------------------------------------------------------------

// -- Context Objects ------------------------------------
// map the instantiated DOM objects to the components that created them
// helping to support events, callbacks, lifecycle and updates

// the context for a component having been rendered to the DOM
class RenderContext {

	constructor (parentDOMElement, component, initialContextValues = null) {
		// root of dom rendering
		this.parentDOMElement = parentDOMElement;
		this.component = component;

		// created elements
		this.attachments = [];

		// consolidate updates
		this.updateIsRequested = false;
		
		// context reference values, ie. app and library integrations (rather than model data)
		this.contextValues = new Map();
		if (initialContextValues) {
			for (const [key, value] of Object.entries(initialContextValues)) {
				this.set(key, value);
			}
		}
	}

	// component refreshed on reuse
	updateComponent (component) {
		this.component = component;
	}

	// derive a child context
	derive (parentDOMElement, component) {
		const child = new RenderContext(parentDOMElement, component);
		child.parentContext = this;
		return child;
	}

	// set a value or reference at this level of the context
	set (name, value) {
		this.contextValues.set(name, value);
	}
	
	// get a value stored in this or any parent context
	get (name, defaultValue = null) {
		if (this.contextValues.has(name)) {
			return this.contextValues.get(name);
		}		
		if (this.parentContext) {
			return this.parentContext.get(name);
		}
		return defaultValue;
	}

	render (state) {
		this.clear();
		this.update(state);
	}

	update (state, parentOrder = null) {
		if (!state) {
			this.clear();
			return;
		}

		// track the intended order of elements as they are created or reused
		if (parentOrder) {
			this.parentOrder = parentOrder;
		} else {
			this.parentOrder = new Map();
			// we need to start this component off in its current position
			for (const attachment of this.attachments) {
				if ((attachment instanceof ElementAttachment) && (attachment.element.parentElement == this.parentDOMElement)) {
					this.parentOrder.set(this.parentDOMElement, attachment.element);
				}
			}
		}

		// unwatch signals/updates
		removeWatcher(this);
		this.updateIsRequested = false;

		// begin middle and end of render
		const renderPhase = new RenderPhase(this, this.parentOrder);
		this.#apply(this.parentDOMElement, state, this.component, renderPhase);
		this.commit(renderPhase);

		// allow signals to trigger an update
		if (typeof state == 'object') {
			watch(state, () => {
				this.updateIsRequested = state;
				onNextFrame(() => { this.consolidatedUpdateFromSignals(); }, this);
			}, this);
		}
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

	broadcast (event, data) {
		for (const attachment of this.attachments) {
			if (attachment instanceof SubContextAttachment) {
				attachment.context.broadcast(event, data);
			} else if (attachment instanceof ContextListenerAttachment) {
				attachment.onBroadcast?.(event, data);
			}
		}
	}

	// recursive process to expand the components and apply them to the DOM
	#apply (parent, state, component, renderPhase) {
		if (Array.isArray(state)) {
			// special case list handling... map list items and their component to the created element
			for (const item of state) {
				const subContext = renderPhase.findOrCreateListItemSubContext(this, parent, component, item);
				subContext.update(item, renderPhase.parentOrder);
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
			const element = renderPhase.findOrCreateElement(component.type, parent, state, component.properties);

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
			subContext.update(component.state, renderPhase.parentOrder);

		} else if (component instanceof ListenSpecification) {
			renderPhase.findOrCreateDOMListener(this, parent, component.event, component.listener);
			
		} else if (component instanceof ContextListenerSpecification) {
			renderPhase.findOrCreateContextListener(this, parent, component.type, component.configurator, component.reuseKeys);

		} else if (typeof component === 'function') {
			this.#apply(parent, state, component(state, this), renderPhase);

		} else if (component == null) {
			// we can ignore

		} else {
			throw new Error('unhandled component type ' + (typeof component));
		}
	}

	commit (renderPhase) {
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
			if (attachment instanceof ContextListenerAttachment) {
				attachment.onAttach?.(attachment.context, attachment.element);
			}
		}
		for (const attachment of this.attachments) {
			if (attachment instanceof ContextListenerAttachment) {
				attachment.onUpdate?.(attachment.context, attachment.element);
			}
		}
	}

	dispose () {
		this.clear();
		markObjectAsDisposed(this);
	}
}

class RenderPhase {

	constructor (context, parentOrder) {
		this.context = context;
		this.parentOrder = parentOrder;

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
			existing.context.updateComponent(component);
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
			existing.context.updateComponent(component);
			return existing.context;
		}

		const sub = context.derive(parent, component);
		this.addAttachment(new SubContextAttachment(sub), keys)
		return sub;
	}

	findOrCreateElement (type, parent, state, properties) {
		if (!this.parentOrder.has(parent)) {
			this.parentOrder.set(parent, parent.firstChild);
		}
		const insertBefore = this.parentOrder.get(parent);
				
		const keys = [ type, parent, state ];
		const existing = this.find(ElementAttachment, keys);
		if (existing) {
			if (existing.element == insertBefore || existing.element.nextSibling == insertBefore) {
				this.parentOrder.set(parent, existing.element.nextSibling);
			} else {
				if (MONITOR_DOM_UPDATES) {
					MOVE_COUNT++;
				}
				existing.element.remove();
				parent.insertBefore(existing.element, insertBefore);
			}
			return existing.element;
		}

		if (MONITOR_DOM_UPDATES) {
			CREATE_COUNT++;
		}
		const element = document.createElement(type);
		if (insertBefore) {
			parent.insertBefore(element, insertBefore);
		} else {
			parent.appendChild(element);
		}
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
			existing.updateListener(listener);
			return existing;
		}

		return this.addAttachment(new DOMListenerAttachment(context, parent, event, listener), keys);
	}
	
	findOrCreateContextListener (context, element, type, configurator, reuseKeys) {
		const keys = [ context, element, type, ...reuseKeys ];
		const existing = this.find(ContextListenerAttachment, keys);
		if (existing) {
			return existing;
		}
		
		const contextListener = new ContextListenerAttachment(context, element, type);
		configurator(contextListener);
		return this.addAttachment(contextListener, keys);		
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
	remove () {
		markObjectAsDisposed(this);
	}
}

class SubContextAttachment extends RenderAttachment {
	constructor (context) {
		super();
		this.context = context;
	}

	remove () {
		super.remove();
		this.context.dispose();
		this.context = null;
	}
}

class ElementAttachment extends RenderAttachment {
	constructor (element) {
		super();
		this.element = element;
	}

	remove () {
		super.remove();
		markObjectAsDisposed(this.element);
		this.element.remove();
		this.element = null;
	}
}

class TextAttachment extends RenderAttachment {
	constructor (textNode) {
		super();
		this.textNode = textNode;
	}

	remove () {
		super.remove();
		this.textNode.remove();
		this.textNode = null;
	}
}

class DOMListenerAttachment extends RenderAttachment {
	constructor (context, element, eventName, listener) {
		super();
		this.element = element;
		this.eventName = eventName;
		this.listener = listener;
		this.wrappedListener = (evt) => { this.listener(context, element, evt); }
		this.element.addEventListener(this.eventName, this.wrappedListener);
	}
	
	updateListener (listener) {
		this.listener = listener;
	}

	remove () {
		super.remove();
		this.element.removeEventListener(this.eventName, this.wrappedListener);
		this.element = null;
		this.handler = null;
	}
}

class ContextListenerAttachment extends RenderAttachment {
	constructor (context, element, type) {
		super();
		this.context = context;
		this.element = element;
		this.type = type;
	}
	
	// set these optional listeners	
	// .onAttach?.(context, element)
	// .onUpdate?.(context, element)
	// .onRemove?.(context, element)
	// .onBroadcast?.(context, element, event, eventData)
	
	remove () {
		super.remove();
		this.onRemove?.(this, this.element);
	}
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
		if (className != null && className != '' && className != false) {
			newNames.add(className);
			if (!element.classList.contains(className)) {
				element.classList.add(className);
			}
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

function requestFrameTimer () {
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

function _animationFrame () {
	if (MONITOR_DOM_UPDATES) {
		REQUEST_ANIMATION_FRAME_COUNT++;
	}
	
	// set aside all actions now due
	const now = Date.now();
	const toBeActioned = [];
	const toBeRepeated = [];
	while (delayedActions.length > 0 && delayedActions[delayedActions.length - 1].time <= now) {
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
			delayed.time = now + (delayed.repeat * 1000);
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

// -------------------------------------------------------------------------------
// debug, monitoring for render efficiency
// -------------------------------------------------------------------------------

// log statistics on how many dom elements are being either created, or moved (since last log)
const MONITOR_DOM_UPDATES = false;
let CREATE_COUNT = 0;
let MOVE_COUNT = 0;
let REQUEST_ANIMATION_FRAME_COUNT = 0;

if (MONITOR_DOM_UPDATES) {
	function showCount() {
		console.log('create ' + CREATE_COUNT);
		console.log('move   ' + MOVE_COUNT);
		console.log('animationFramesRequest ' + REQUEST_ANIMATION_FRAME_COUNT);
		CREATE_COUNT = 0;
		MOVE_COUNT = 0;
		REQUEST_ANIMATION_FRAME_COUNT = 0;
	}
	setInterval(showCount, 10 * 1000);
}
