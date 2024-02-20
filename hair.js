// hair.js
// ===============================================================================
//
// state/model object ----------------⌝----------------------⌝----------------------⌝
//                                    |                      |                      |
// DOM parent ------------|           |                      |                      |
//                        |--> [render context] --------------------------------------------->
// [component spec]  -----⌟        <render>              <update>                <update>
//                              [render phase]         [render phase]         [render phase]
//
// Component specs
// strings, numbers, arrays and functions are all treated transparently as component specifications
// arrays and functions are iterated or executed recursively to produce explicit component specifications
//
// Flexible arguments
// Component specs for elements let you supply up to 3 arguments flexibly in any order
// Objects arguments are assumed to be properties to apply to element eg { class: 'parent', disabled: true }
// Number or string arguments are assumed to be text content of the element
// Arrays or any single recognised component spec is assumed to be a child (recursively forming the full component spec)
//
// Special/active components
// Functions are provided to create "special" components specs, eg. compose, listen, onDelay, or onAttach
// These should be added as children of relevant elements, and allow callbacks to link functionality to the DOM at render time
// 
// Many components allow single or multiple "reuse keys" to provided in their spec
// These keys can be any value, including strings and objects
// When updating an already rendered view, DOM elements will only be reused if reuse keys match
// If no reuse keys are provided then DOM elements will be re-used optimistically
//
// hair.js file layout:
//
// Top level export public functions to render views
// 	render, element, compose, list
//	onAttach, onRemove, onUpdate, onContext
//	onBroadcast, onDelay, onTimer
//
// Component specification classes
//	These data objects capture the specifications that will be used to produce or update the DOM in a render pass
//
// RenderContext
//	captures the combination of a component spec and a DOM parent element and is created on first render
//	the context can be retained and used to update the render with update state
//	it will re-use and clean up elements as required to achieve this
//
// RenderPhase
//	is created for each recursive render or update pass of a context
//	tracks created and reused elements to merge and clean up changes at the end of each render
// 
// RenderAttachments
//	objects created during render or update that attach functionality to a rendered DOM view
//
// Property Handlers
//  eg. setPropertyHandler, applyClassList
//	specialised handling of matching property names when applied to DOM elements
//
// Watcher, watch, signal, removeWatcher
//	watch and signal allow components to "watch" any object for signals
//	signalling on a state or model object will trigger views to updates
//  can be used as simple event system, objects are tracked in WeakMaps to prevent interfering with garbage collection
//
// DelayedAction, delay, timer, onNextFrame, onEveryFrame
//  globally available timer and event callback
//  all callbacks occur during a requestAnimationFrame timeslot, but animation frames are only active when required
//
// Tweening
//	tween(target, properties, timing, owner)
//	transform, wrap a DOM element in a proxy object that can conveniently read and write the x,y,scale,rotation and opacity of a DOM object 
//
// Disposal markObjectAsDisposed, isObjectDisposed
//	arbitrarily mark any object as disposed
//	used to check where delayed actions and watched signals should be ignored if related to outdated renders
//	objects are tracked in a WeakSet to prevent interfering with garbage collection
//
// Debug
//	set MONITOR_DOM_UPDATES to true to trace a simple count of DOM objects created or moved during rendering
//
// ===============================================================================


// -- public interface of the library ---------------------------------

// top level request to render state to a parent using a component
export function render (parent, state, component, initialContextValues = null) {
	// create a context (attached to this parent)
	const context = new RenderContext(parent, component, initialContextValues);

	// recursively expand the component in element specs
	context.render(state);

	return context;
}

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
		watch(state, () => {
			this.updateIsRequested = state;
			onNextFrame(() => { this.consolidatedUpdateFromSignals(); }, this);
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
			subContext.update(component.state, renderPhase.parentOrder);

		} else if (component instanceof ListenSpecification) {
			renderPhase.findOrCreateDOMListener(this, parent, component.event, component.listener);
			
		} else if (component instanceof ContextListenerSpecification) {
			renderPhase.findOrCreateContextListener(this, parent, component.type, component.configurator, component.reuseKeys);

		} else if (typeof component === 'function') {
			this.#apply(parent, state, component(state), renderPhase);

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

	findOrCreateElement (type, parent, state) {
		if (!this.parentOrder.has(parent)) {
			this.parentOrder.set(parent, parent.firstChild);
		}
		const insertBefore = this.parentOrder.get(parent);
				
		const keys = [ type, parent, state ];
		const existing = this.find(ElementAttachment, keys);
		if (existing) {
			if (existing.element == insertBefore) {
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
			existing.listener = listener;
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
	constructor (context, element, eventName, handler) {
		super();
		this.element = element;
		this.eventName = eventName;
		this.handler = handler;
		this.wrappedHandler = (evt) => { this.handler(context, element, evt); }
		this.element.addEventListener(this.eventName, this.wrappedHandler);
	}

	remove () {
		super.remove();
		this.element.removeEventListener(this.eventName, this.wrappedHandler);
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

// -- tweening ----------------------------------------------------------------------

export function tween(target, properties, timing, owner = null) {
	if (typeof timing == 'number') {
		timing = linear(timing);
	}
	
	return new Tween(target, properties, timing, owner)
}

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
	const interpolateFunction = (v) => {
		return v;
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
			delay(timing.delay, () => { this.#begin(); }, owner);
		}
	}
	
	#begin () { 
		this.startTime = Date.now();
		this.properties = {}
		for (const k in this.propertiesRequested) {
			this.properties[k] = captureTweenProperty(this.target, k, this.propertiesRequested[k]);
		}
		this.timer = onEveryFrame(() => {
			const now = Date.now();
			this.#update(Math.max(0, Math.min(1, (now - this.startTime) / (this.timing.duration * 1000))));
		}, this.owner);
	}
	
	#update (transition) {
		if (isObjectDisposed(this) || isObjectDisposed(this.owner)) {
			return;
		}
		
		const ratio = this.timing.curveFunction(transition);
		const inverse = 1 - ratio;

		for (const k in this.properties) {
			const prop = this.properties[k];
			this.target[k] = ((prop.initial * inverse) + (prop.final * ratio)) + prop.suffix;
		}

		if (transition >= 1) {
			if (this.onComplete) {
				this.onComplete();
			}
			this.cancel();
			return;
		}
	}
	
	complete () {
		if (isObjectDisposed(this) || isObjectDisposed(this.owner)) {
			return;
		}
		this.#update(1);
	}
	
	cancel () {
		if (this.timer) {
			cancel(this.timer);
			this.timer = null;
		}
		this.target = null;
		this.onComplete = null;
		this.properties = null;
		markObjectAsDisposed(this);
	}
	
}

const _linearFunction = (v) => { return v; };
const _easeInFunction = (v) => { return v; };
const _easeOutFunction = (v) => { return v; };
const _easeInOutFunction = (v) => { return v; };

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

// -- debug monitoring for render efficiency ----------------------------------------

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
