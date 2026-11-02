// hair.js - MIT license, copyright 2024 Samuel Baird
// ====================================================================================
// A single file module, the code is split into three main sections:
//  * component specifications, ie. describing the view to be rendered in a composable way
//  * render, creating or updating DOM elements to match that description
//  * signals and timers, watching for updated objects and requesting animation frames when required
// -----------------------------------------------------------------------------------
// Top level export public functions to define and render views
// 	 render, createElements
//
//   Functions to compose component specifications for render
//     elements, element, key, compose, composeEach, listen
//	   onPrepare, onAttach, onRemove, onUpdate, onContext
//	   onBroadcast, onDelay, onTimer, onFrame
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
//     can be used as simple event system, watched objects are WeakMap keys to prevent interfering with garbage collection
//
//   DelayedAction, delay, timer, onNextFrame, onEveryFrame, onAnyFrame
//     globally available timer and event callback
//     all callbacks occur during a requestAnimationFrame timeslot, but animation frames are only active when required
//
//   Fiber, wait, schedule, forever
//     sequence actions in async functions, using the same timers
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

export function createElements (parent, state, component, initialContextValues = null) {
	// create a context (attached to this parent)
	const context = new RenderContext(parent, component, initialContextValues);

	// recursively expand the component in element specs
	const renderPhase = context.render(state);

	// gather the top level HTML elements that were rendered and return those directly
	const elements = [];
	for (const attachment of renderPhase?.attachments ?? []) {
		if (attachment instanceof ElementAttachment) {
			if (attachment.element.parentElement == parent) {
				elements.push(attachment.element);
			}
		}
	}

	return elements;
}

// -------------------------------------------------------------------------------
// hair.component-specifications, describe your components for rendering
// -------------------------------------------------------------------------------

// construct an element spec for rendering with variable arguments
// arguments in any order can include text content, a property object, a key, and child components
export function element (type, ...args) {
	let properties = null;
	let reuseKey = null;
	const children = [];

	for (const arg of args) {
		if (arg == null || typeof arg === 'boolean') {
			// null and undefined are ignored, true and false are reserved
		} else if (typeof arg === 'string' || typeof arg === 'number') {
			// text content
			children.push(arg);
		} else if (Array.isArray(arg)) {
			children.push(...arg);
		} else if (arg instanceof ComponentSpecification) {
			children.push(arg);
		} else if (typeof arg === 'function') {
			children.push(arg);
		} else if (arg instanceof Key) {
			if (reuseKey != null) {
				throw new Error('multiple keys for HTML element');
			}
			reuseKey = arg;
		} else if (typeof arg === 'object') {
			if (properties != null) {
				throw new Error('multiple property objects for HTML element');
			}
			properties = arg;
		}
	}

	return new ElementSpecification(type, properties, children, keyValues(reuseKey));
}

// mark one or more values as a reuse key, for an element or a context listener
// something created with a key is only reused by a later render with an equal key (values compared in order by identity)
// without a key, things are reused in the order they are rendered
export function key (...values) {
	return new Key(values);
}

// check for a key, eg. when an integration accepts arguments in any order
export function isKey (value) {
	return value instanceof Key;
}

// mark a point within the render tree that is composed with its own render context
// the state is passed to the component whole, and watched for signals
// the composed context is reused while the same state object is composed at the same point
export function compose (state, component) {
	return new ComposeSpecification(state, component);
}

// compose each item of a list (or any iterable) with its own render context
// each item is passed to the component, watched for signals, and matched to its rendering by identity
// the list itself can be replaced with a new collection, and existing items will still be matched
export function composeEach (items, component) {
	return new ComposeEachSpecification(items, component);
}

// add a DOM event listener as a child of instantiated elements
export function listen (event, listener) {
	return new ListenSpecification(event, listener);
}

// context listeners are set up once when first created
// on later renders the listener is updated, so it always has the latest values from its render

export function onPrepare (listener, reuseKey = null) {
	// run once during render, when this component is first created
	return new ContextListenerSpecification('prepare', listener, (contextListener) => {
		contextListener.listener(contextListener.context, contextListener.element);
	}, reuseKey);
}

export function onAttach (listener, reuseKey = null) {
	// run once during render commit the first time this component is render
	return new ContextListenerSpecification('attach', listener, (contextListener) => {
		contextListener.onAttach = (context, element) => {
			contextListener.listener(context, element);
		};
	}, reuseKey);
}

export function onRemove (listener, reuseKey = null) {
	// run once when removed
	return new ContextListenerSpecification('remove', listener, (contextListener) => {
		contextListener.onRemove = (context, element) => {
			contextListener.listener(context, element);
		};
	}, reuseKey);
}

export function onUpdate (listener, reuseKey = null) {
	// run during render commit whenever this component is created or updated
	return new ContextListenerSpecification('update', listener, (contextListener) => {
		contextListener.onUpdate = (context, element) => {
			contextListener.listener(context, element);
		};
	}, reuseKey);
}

export function onBroadcast (specificEvent, listener, reuseKey = null) {
	// receive arbitrary events through the context tree
	return new ContextListenerSpecification('broadcast', listener, (contextListener) => {
		contextListener.onBroadcast = (event, eventData) => {
			if (event == specificEvent) {
				contextListener.listener(contextListener.context, contextListener.element, eventData);
			}
		}
	}, reuseKey);
}

export function onDelay (time, listener, reuseKey = null) {
	// action X seconds after this component exists (if it still exists)
	return new ContextListenerSpecification('delay', listener, (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = delay(time, () => {
				contextListener.listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, reuseKey);
}

export function onTimer (time, listener, reuseKey = null) {
	// repeat every X seconds while this component exists
	return new ContextListenerSpecification('timer', listener, (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = timer(time, () => {
				contextListener.listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, reuseKey);
}

export function onFrame (listener, reuseKey = null) {
	// run every animation while this component exists
	return new ContextListenerSpecification('frame', listener, (contextListener) => {
		let token = null;
		contextListener.onAttach = (context, element) => {
			token = onEveryFrame(() => {
				contextListener.listener(context, element);
			}, contextListener);
		};
		contextListener.onRemove = () => {
			cancel(token);
		};
	}, reuseKey);
}

export function onContext (configurator, reuseKey = null) {
	return new ContextListenerSpecification('general', null, (contextListener) => {
		// use contextListener, contextListener.context, and contextListener.element
		// and set onAttach, onRemove, onUpdate, onBroadcast handlers
		// the configurator is only run once, when the context listener is first created
		configurator(contextListener);
	}, reuseKey);
}

// element spec functions for any tag, created on first use and then reused
// eg. const { div, p } = elements;  or  elements['my-widget'] for names that are not valid identifiers
// any name is accepted, so a misspelt tag creates an unknown element rather than an error
const elementFunctions = new Map();
export const elements = new Proxy({}, {
	get (_, type) {
		// symbols and "then" are not tags, so the proxy isn't mistaken for a promise, iterator, etc.
		if (typeof type !== 'string' || type === 'then') {
			return undefined;
		}
		let elementFunction = elementFunctions.get(type);
		if (!elementFunction) {
			elementFunction = (...args) => element(type, ...args);
			elementFunctions.set(type, elementFunction);
		}
		return elementFunction;
	}
});


// -- Component Specification ---------------------------------------
// components are presented as text, a function, an array, _or_ as one of these known objects

class ComponentSpecification {
	// a base class to identify objects that should be treated as renderable specifications when encountered in arguments or components
}

// a data object that contains the spec for a DOM element to be rendered or updated
class ElementSpecification extends ComponentSpecification {
	constructor (type, properties, children, keyValues) {
		super();
		this.type = type;
		this.properties = properties;
		this.children = children;
		this.keyValues = keyValues;
	}
}

// a data object that specifies a sub-render of an object to be composed at a point in the render tree
class ComposeSpecification extends ComponentSpecification {
	constructor (state, component) {
		super();
		this.state = state;
		this.component = component;
	}
}

// a data object that specifies a sub-render of each item in a list to be composed at a point in the render tree
class ComposeEachSpecification extends ComponentSpecification {
	constructor (items, component) {
		super();
		this.items = items;
		this.component = component;
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
	constructor (type, listener, configurator, reuseKey) {
		super();
		this.type = type;
		this.listener = listener;
		this.configurator = configurator;
		this.keyValues = keyValues(reuseKey);
	}
}

// a reuse key, holding one or more values
class Key {
	constructor (values) {
		this.values = values;
	}
}

// the values of an optional reuse key, only values marked with key(...) are accepted
function keyValues (reuseKey) {
	if (reuseKey == null) {
		return [];
	}
	if (reuseKey instanceof Key) {
		return reuseKey.values;
	}
	throw new Error('reuse keys must be given using key(...)');
}

// the component of the render context created for composeEach, composing each item in its state
class EachItemComponent {
	constructor (component) {
		this.component = component;
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
		this.state = null;

		// how deeply nested is this context, outer contexts update first
		this.depth = 0;

		// created elements
		this.attachments = [];

		// consolidate updates
		this.updateIsRequested = false;

		// context reference values, ie. app and library integrations, DOM references, and transient view state
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
		child.depth = this.depth + 1;
		return child;
	}

	// set a value or reference at this level of the context
	// optionally signal this context, to update its rendering on the next frame
	set (name, value, signalUpdate = false) {
		this.contextValues.set(name, value);
		if (signalUpdate) {
			signal(this);
		}
	}

	// get a value stored in this or any parent context
	get (name, defaultValue = null) {
		if (this.contextValues.has(name)) {
			return this.contextValues.get(name);
		}
		if (this.parentContext) {
			return this.parentContext.get(name, defaultValue);
		}
		return defaultValue;
	}

	render (state, component = null) {
		this.clear();
		if (component != null) {
			this.component = component;
		}
		return this.update(state);
	}

	update (state, parentRenderInsertCursor = null) {
		// unwatch signals/updates, these are renewed after the render
		removeWatcher(this);
		this.updateIsRequested = false;
		this.state = state;

		// null and undefined render nothing
		if (state == null) {
			this.clear();
			return null;
		}

		// track the intended position of nodes as they are created or reused
		// an update that is not part of a parent update starts where this context's nodes already are
		if (!parentRenderInsertCursor) {
			parentRenderInsertCursor = new Map();
			this.#findInsertPositions(parentRenderInsertCursor);
		}

		// begin middle and end of render
		const renderPhase = new RenderPhase(this, parentRenderInsertCursor);
		try {
			this.#apply(this.parentDOMElement, state, this.component, renderPhase);
		} finally {
			// commit even a partial render, so the DOM and attachments remain consistent
			this.commit(renderPhase);

			// allow signals on the state, or on this context, to trigger an update
			if (typeof state == 'object' || typeof state == 'function') {
				watch(state, () => { this.requestUpdate(); }, this);
			}
			watch(this, () => { this.requestUpdate(); }, this);
		}

		return renderPhase;
	}

	// update on the next frame, consolidated with any other requested updates
	requestUpdate () {
		if (this.updateIsRequested || isObjectDisposed(this)) {
			return;
		}
		this.updateIsRequested = true;
		requestContextUpdate(this);
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

	// the first node rendered by this context (or its sub contexts) in each parent
	// is where rendering into that parent will begin on the next update
	#findInsertPositions (parentRenderInsertCursor) {
		for (const attachment of this.attachments) {
			if (attachment instanceof SubContextAttachment) {
				attachment.context.#findInsertPositions(parentRenderInsertCursor);
			} else if (attachment.node) {
				const parent = attachment.node.parentNode;
				if (parent && !parentRenderInsertCursor.has(parent)) {
					parentRenderInsertCursor.set(parent, attachment.node);
				}
			}
		}
	}

	// recursive process to expand the components and apply them to the DOM
	#apply (parent, state, component, renderPhase) {
		if (component == null || typeof component === 'boolean') {
			// null and undefined render nothing, true and false are reserved

		} else if (typeof component === 'string' || typeof component === 'number') {
			renderPhase.findCreateOrUpdateText(parent, String(component));

		} else if (Array.isArray(component)) {
			for (const c of component) {
				this.#apply(parent, state, c, renderPhase);
			}

		} else if (component instanceof ElementSpecification) {
			// find or make the element, and apply the properties of this element
			const attachment = renderPhase.findOrCreateElement(component.type, parent, state, component.keyValues);
			applyProperties(this, attachment, component.properties);

			// add the children of this element
			this.#apply(attachment.element, state, component.children, renderPhase);

		} else if (component instanceof ComposeSpecification) {
			// compose a sub component with its own context, reused for the same state object
			const subContext = renderPhase.findOrCreateSubContext(this, parent, component.component, [ 'compose', parent, component.state ]);
			subContext.update(component.state, renderPhase.parentRenderInsertCursor);

		} else if (component instanceof ComposeEachSpecification) {
			// a sub context for the list, which then composes each item with its own context
			// the list context is reused by position, so items are still matched if the collection is replaced
			const listContext = renderPhase.findOrCreateSubContext(this, parent, new EachItemComponent(component.component), [ 'each', parent ]);
			listContext.update(component.items, renderPhase.parentRenderInsertCursor);

		} else if (component instanceof EachItemComponent) {
			for (const item of state) {
				const itemContext = renderPhase.findOrCreateSubContext(this, parent, component.component, [ 'item', parent, item ]);
				itemContext.update(item, renderPhase.parentRenderInsertCursor);
			}

		} else if (component instanceof ListenSpecification) {
			renderPhase.findOrCreateDOMListener(this, parent, component.event, component.listener);

		} else if (component instanceof ContextListenerSpecification) {
			renderPhase.findOrCreateContextListener(this, parent, component.type, component.listener, component.configurator, component.keyValues);

		} else if (typeof component === 'function') {
			this.#apply(parent, state, component(state, this), renderPhase);

		} else if (component instanceof Key) {
			throw new Error('a key must be an argument of an element or listener, not a child');

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

// -- consolidated updates ------------------------------------
// contexts signalled for update are updated together on the next frame
// outer contexts are updated first, and their update includes any inner contexts

const contextsToUpdate = [];

function requestContextUpdate (context) {
	contextsToUpdate.push(context);
	if (contextsToUpdate.length == 1) {
		onNextFrame(updateRequestedContexts);
	}
}

function updateRequestedContexts () {
	const contexts = contextsToUpdate.splice(0).sort((a, b) => a.depth - b.depth);
	for (const context of contexts) {
		if (context.updateIsRequested && !isObjectDisposed(context)) {
			try {
				context.update(context.state);
			} catch (error) {
				reportException(error);
			}
		}
	}
}

class RenderPhase {

	constructor (context, parentRenderInsertCursor) {
		this.context = context;
		this.parentRenderInsertCursor = parentRenderInsertCursor;

		// take a copy of all existing sub elements and sub contexts
		// and attempt to re-use and update them during the render pass
		this.priorAttachments = [...context.attachments];

		// attachments created or in use this render
		this.attachments = [];

		// new attachments that need to be signalled on creation
		this.newAttachments = [];
	}

	findOrCreateSubContext (context, parent, component, keys) {
		const existing = this.find(SubContextAttachment, keys);
		if (existing) {
			existing.context.updateComponent(component);
			return existing.context;
		}

		const sub = context.derive(parent, component);
		this.addAttachment(new SubContextAttachment(sub), keys)
		return sub;
	}

	findOrCreateElement (type, parent, state, keyValues) {
		const keys = [ type, parent, state, ...keyValues ];
		const existing = this.find(ElementAttachment, keys);
		if (existing) {
			this.place(parent, existing.element);
			return existing;
		}

		if (MONITOR_DOM_UPDATES) {
			CREATE_COUNT++;
		}
		const element = document.createElement(type);
		this.place(parent, element);
		return this.addAttachment(new ElementAttachment(element), keys);
	}

	findCreateOrUpdateText (parent, text) {
		const keys = [ parent ];
		const existing = this.find(TextAttachment, keys);
		if (existing) {
			if (existing.text !== text) {
				existing.textNode.data = text;
				existing.text = text;
			}
			this.place(parent, existing.textNode);
			return existing;
		}

		const textNode = document.createTextNode(text);
		this.place(parent, textNode);
		return this.addAttachment(new TextAttachment(textNode, text), keys);
	}

	// put a node at the current insert position within its parent, only moving it if needed
	place (parent, node) {
		let insertBefore = this.parentRenderInsertCursor.get(parent) ?? null;
		if (insertBefore != null && insertBefore.parentNode !== parent) {
			// the expected position is no longer in this parent, so add to the end
			insertBefore = null;
		}

		if (node === insertBefore) {
			// already in position, the next node follows this one
			this.parentRenderInsertCursor.set(parent, node.nextSibling);
			return;
		}

		if (MONITOR_DOM_UPDATES && node.parentNode) {
			MOVE_COUNT++;
		}
		parent.insertBefore(node, insertBefore);
		this.parentRenderInsertCursor.set(parent, insertBefore);
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

	findOrCreateContextListener (context, element, type, listener, configurator, keyValues) {
		const keys = [ context, element, type, ...keyValues ];
		const existing = this.find(ContextListenerAttachment, keys);
		if (existing) {
			// set up is only run once, but keep the listener from the latest render
			existing.listener = listener;
			return existing;
		}

		const contextListener = new ContextListenerAttachment(context, element, type, listener);
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
				for (let j = 0; j < Math.max(attachment.keys.length, keys.length); j++) {
					if (keys[j] !== attachment.keys[j]) {
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

		// the properties applied from the spec on the last render
		this.properties = null;
	}

	get node () {
		return this.element;
	}

	remove () {
		super.remove();
		markObjectAsDisposed(this.element);
		clearContextReference(this.element);
		this.element.remove();
		this.element = null;
	}
}

class TextAttachment extends RenderAttachment {
	constructor (textNode, text) {
		super();
		this.textNode = textNode;
		this.text = text;
	}

	get node () {
		return this.textNode;
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
		this.wrappedListener = null;
	}
}

class ContextListenerAttachment extends RenderAttachment {
	constructor (context, element, type, listener) {
		super();
		this.context = context;
		this.element = element;
		this.type = type;

		// the listener from the latest render, if any
		this.listener = listener;
	}

	// set these optional listeners
	// .onAttach?.(context, element)
	// .onUpdate?.(context, element)
	// .onRemove?.(context, element)
	// .onBroadcast?.(event, eventData)

	// add a function, or object with a dispose method, to be called when this is removed
	addDisposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	remove () {
		super.remove();
		this.onRemove?.(this.context, this.element);
		if (this.disposables) {
			for (const disposable of this.disposables) {
				if (typeof disposable == 'function') {
					disposable();
				} else if (disposable.dispose) {
					disposable.dispose();
				} else {
					throw new Error('cannot dispose ' + disposable);
				}
			}
			this.disposables = null;
		}
	}
}

// -- setting properties ------------------------
// properties are set as JS properties on the element, compared with the spec from the previous render
// only properties with changed values are set, and properties no longer in the spec are reset to their default

function applyProperties (context, attachment, properties) {
	const element = attachment.element;
	const previous = attachment.properties;

	if (properties) {
		for (const [key, value] of Object.entries(properties)) {
			const previousValue = previous?.[key];
			// check for special purpose property handlers
			const handler = propertyHandlers[key];
			if (handler) {
				handler(context, element, key, value, previousValue);
			} else if (!previous || !Object.hasOwn(previous, key) || !Object.is(value, previousValue)) {
				// default handling
				element[key] = value;
			}
		}
	}

	if (previous) {
		for (const [key, previousValue] of Object.entries(previous)) {
			if (properties && Object.hasOwn(properties, key)) {
				continue;
			}
			const handler = propertyHandlers[key];
			if (handler) {
				handler(context, element, key, undefined, previousValue);
			} else {
				element[key] = defaultPropertyValue(element, key);
			}
		}
	}

	attachment.properties = properties;
}

// the default value of a property, taken from a fresh element of the same type
const defaultElements = new Map();
function defaultPropertyValue (element, key) {
	let defaultElement = defaultElements.get(element.tagName);
	if (!defaultElement) {
		defaultElement = document.createElement(element.tagName);
		defaultElements.set(element.tagName, defaultElement);
	}
	return defaultElement[key];
}

// -- property handlers ------------------------
// property names that have specific functionality to apply them
// handlers are called on every render with (context, element, key, value, previousValue)
// value is undefined when the property has been removed from the spec

const propertyHandlers = {
	context_id: applyContextReference,
	class: applyClassList,
	style: applyStyle,
	dataset: applyDataset,
	attributes: applyAttributes,
}

export function setPropertyHandler(name, handler) {
	propertyHandlers[name] = handler;
}

// store a reference to the element as a context value
const contextReferences = new WeakMap();
function applyContextReference (context, element, key, name, previousName) {
	if (previousName != null && previousName !== name) {
		clearContextReference(element);
	}
	if (name != null) {
		context.set(name, element);
		contextReferences.set(element, { context, name });
	}
}

function clearContextReference (element) {
	const reference = contextReferences.get(element);
	if (reference && reference.context.contextValues.get(reference.name) === element) {
		reference.context.contextValues.delete(reference.name);
	}
	contextReferences.delete(element);
}

// allow either a single class or array of class names, only adding or removing those that changed in the spec
function applyClassList (context, element, key, value, previousValue) {
	const classes = classNames(value);
	for (const className of classNames(previousValue)) {
		if (!classes.includes(className)) {
			element.classList.remove(className);
		}
	}
	for (const className of classes) {
		if (!element.classList.contains(className)) {
			element.classList.add(className);
		}
	}
}

function classNames (value) {
	// space separated names are split, and falsy values ignored
	const names = [];
	for (const entry of [value].flat()) {
		if (entry) {
			names.push(...String(entry).split(/\s+/).filter((name) => name));
		}
	}
	return names;
}

// merge an object of styles into element.style, or replace the whole inline style with a string
function applyStyle (context, element, key, value, previousValue) {
	const style = element.style;
	if (typeof value == 'string') {
		if (value !== previousValue) {
			style.cssText = value;
		}
		return;
	}
	if (typeof previousValue == 'string') {
		style.cssText = '';
		previousValue = null;
	}
	applyMergedValues(value, previousValue, (name, v) => {
		if (name.startsWith('--')) {
			style.setProperty(name, v ?? '');
		} else {
			style[name] = v ?? '';
		}
	});
}

// merge an object of values into element.dataset
function applyDataset (context, element, key, value, previousValue) {
	applyMergedValues(value, previousValue, (name, v) => {
		if (v == null) {
			delete element.dataset[name];
		} else {
			element.dataset[name] = v;
		}
	});
}

// set HTML attributes directly, for anything without a writable JS property
function applyAttributes (context, element, key, value, previousValue) {
	applyMergedValues(value, previousValue, (name, v) => {
		if (v == null || v === false) {
			element.removeAttribute(name);
		} else {
			element.setAttribute(name, (v === true) ? '' : v);
		}
	});
}

// call apply for values that have changed or been removed (with undefined) since the previous spec
function applyMergedValues (value, previousValue, apply) {
	const next = value ?? {};
	const prior = previousValue ?? {};
	for (const name of Object.keys(prior)) {
		if (!Object.hasOwn(next, name)) {
			apply(name, undefined);
		}
	}
	for (const [name, v] of Object.entries(next)) {
		if (!Object.hasOwn(prior, name) || !Object.is(prior[name], v)) {
			apply(name, v);
		}
	}
}

// -------------------------------------------------------------------------------
// hair.signals, callbacks and requestAnimationFrame updates as required
// -------------------------------------------------------------------------------

// report an exception from a callback, without interrupting other callbacks
function reportException (error) {
	if (typeof reportError == 'function') {
		reportError(error);
	} else {
		console.error(error);
	}
}

// -- watch / signal / removeWatcher -------------------------------------------
// a global signal/watch system, watched objects are held weakly
// watchers (and their owners) are held for as long as the watched object, or until removed

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
			try {
				watcher.action(...args);
			} catch (error) {
				reportException(error);
			}
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
// actions due in the same frame are run in the order they were requested

const delayedActions = [];
let delayedActionSequence = 0;

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

export function requireNextFrame () {
	if (!frameIsRequested) {
		requestFrameTimer(true);
	}
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
let frameStartTime = Date.now();
let isInFrameDuration = false;
export let frameDeltaSeconds = 0;

export function getFrameStartTime() {
	if (isInFrameDuration) {
		// if we're in the frame timer phase then use frameStartTime
		// then align with the start of those frame actions
		return frameStartTime;
	} else {
		// otherwise the time of the last frame start is unreliable
		return Date.now();
	}
}

function requestFrameTimer (force = false) {
	if (frameIsRequested || (!force && delayedActions.length == 0)) {
		return;
	}

	// cancel any current timeout
	if (longDelayTimeout) {
		clearTimeout(longDelayTimeout);
		longDelayTimeout = false;
	}

	// work out if a long delay or short delay is needed next
	let next = false;
	if (force) {
		next = 0;
	} else {
		let i = delayedActions.length;
		while (--i >= 0) {
			if (!delayedActions[i].doesNotRequestFrames) {
				next = delayedActions[i].time;
				break;
			}
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
	if (MONITOR_DOM_UPDATES) {
		REQUEST_ANIMATION_FRAME_COUNT++;
	}

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

	// ordered by phase, then the order requested, to allow more consistent dispatch ordering
	toBeActioned.sort((a, b) => { return (a.phase - b.phase) || (a.sequence - b.sequence); });

	// dispatch all actions (ignoring disposed owners)
	isInFrameDuration = true;
	for (const delayed of toBeActioned) {
		if (!isObjectDisposed(delayed.owner)) {
			try {
				delayed.action();
			} catch (error) {
				reportException(error);
			}
		}
	}
	isInFrameDuration = false;
}

class DelayedAction {
	constructor (time, action, owner) {
		this.time = time;
		this.action = action;
		this.owner = owner;

		// the order this action was requested
		this.sequence = delayedActionSequence++;

		// override this with a number to set a recurring delay to repeat the event after the first time it is called
		this.repeat = false;

		// override this with another number to control how timer events are sorted within the same timeslice
		this.phase = 0;
	}

	cancel () {
		cancel(this);
	}
}


// -- async fibers ---------------------------------------
// a fiber is a sequence of actions in an async function, that can be cancelled

// use this in async functions, eg. await hair.wait(10);
export function wait (timeOrCondition, owner, conditionCheckPeriod = 0) {
	const fiber = new Fiber(owner);
	return fiber.wait(timeOrCondition, conditionCheckPeriod);
}

// use this in async fnuction, eg. await hair.forever();
export function forever () {
	return new Promise((resume) => {
		// you can (not) resume
	});
}

export function schedule (asyncFiberFunction, owner) {
	const fiber = new Fiber(owner);
	asyncFiberFunction(fiber);
	return fiber;
}

class Fiber {
	constructor (owner) {
		this.owner = owner;
		this.delayedAction = null;
	}

	wait (timeOrCondition = null, conditionCheckPeriod = 0) {
		return new Promise((resume) => {
			if (timeOrCondition == null) {
				// wait one frame by default
				this.delayedAction = onNextFrame(resume, this.owner);
			} else if (typeof timeOrCondition == 'function') {
				this.delayedAction = timer(conditionCheckPeriod, () => {
					if (isObjectDisposed(this)) {
						return;
					}
					const result = timeOrCondition();
					if (result === false || result === undefined) {
						// false or undefined will continue to wait, return new Boolean(false) if needed
					} else {
						this.delayedAction.cancel();
						resume(result);
					}
				}, this.owner);
			} else {
				this.delayedAction = delay(timeOrCondition, resume, this.owner);
			}
		});
	}

	cancel () {
		if (this.delayedAction) {
			this.delayedAction.cancel();
			this.delayedAction = null;
		}
		markObjectAsDisposed(this);
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
