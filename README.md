# hair.js

## Overview

A Javascript library for creating and updating DOM elements from composable view functions, driven by a separate, long-lived model.

Taking a few of the things I think people like about modern frontend libraries and removing others. The main thing kept is composable view code, where the same code both creates and updates the DOM. The main thing changed is where state lives. Rather than state held inside components, hair presupposes an app model: ordinary JS objects, maintained and updated over the life of the program in response to user actions or network driven updates. Views are mostly a function of that model. Some of these choices make more sense for games, simulations, tools and other long-lived state, rather than transactional websites with fresh queries per page.

hair.js is a single file module, that can be included in a project without any build step or dependencies.

The reasoning behind these choices is in [DESIGN.md](DESIGN.md).

### How it fits together

 * **The model** holds the logical state, what would be saved or live on a server. Model objects persist (their identity matters), and they **signal** when anything visible through them changes.
 * **View functions** build a *specification* of the view from the model, using element functions (`div`, `p`, ... from `elements`), arrays and other functions. Functions only build the spec. They have no lifecycle or state of their own.
 * **`compose` and `composeEach`** are the boundaries within the view. Each binds a region of the view to one model object, watches that object, and re-renders the region when it signals. Each region has a **render context** holding its transient view state and references to its DOM elements.
 * **The DOM** belongs to you as well. hair only writes what the spec changed, so transient state such as focus, scroll position, a partly typed input, or a style set by your own code is left alone.

### Scope

 * Suited to small applications with a clear model, not large codebases or large data sets.
 * Updates to the model should be incremental updates to persistent objects, rather than fresh objects each time. Data arriving as new objects (eg. JSON from the network) should be merged into the existing model objects, matching on an id.
 * Not attempting to be a virtual DOM, or to provide automatic dependency tracking. The model decides what to signal.

## Usage

Snippet:

	// bring in the hair functions used, and element functions for the tags used
	import { render, composeEach, listen, elements } from './js/hair.js';

	const { h1, div, p, ol, input, button } = elements;

	export default function app (model) {
		return [
			h1(model.name),

			div([
				// add this component in by immediately calling a function to return its spec
				itemCount(model.items.length),

				// compose each item in a list with its own region, watching that item for signals
				ol(composeEach(model.items, (item) => displayItem(model, item))),
			]),

			div({ class: 'add-item-area' }, [
				p('Add new items below'),

				// add this component in by providing a function to be called with the same state object
				addItem,
			]),
		];
	}

	function addItem (model) {
		return div([
			// context_id stores a reference to this element in the render context
			input({ context_id: 'new_item' }),
			button('Add', listen('click', (context, element, event) => {
				model.addItem(context.get('new_item').value);
				context.get('new_item').value = '';
			})),
		]);
	}

	// render the app into a DOM element, the returned context can be used to update or dispose the view
	const context = render(document.getElementById('app'), model, app);

	// later, the model signals when it changes, and the view updates on the next frame
	model.addItem('feed the cat');		// calls signal(this) internally

### Viewing the example projects

Serve the root of repo using any local web server, eg.

	cd hair
	python3 -m http.server

Open the example folders in your browser

	open http://localhost:8000/example_todo_list/
	open http://localhost:8000/example_quiz/
	open http://localhost:8000/example_tweening/
	open http://localhost:8000/example_pixi/

### Running the tests

The tests use Node's built in test runner, with jsdom as the only development dependency.

	npm install
	npm test

## Reference

	state/model object ----------------*-----------------*----------------*-->
	                                   |                 |                |
	DOM parent -------------- -|       |                 |                |
	                           |--> RenderContext -------------------------------------->
	[ComponentSpecifications] -|    <render>         <update>         <update>
	                               RenderPhase      RenderPhase      RenderPhase

### Building specifications

`elements` provides a function for any tag, created the first time it is used, eg. `const { div, p, progress } = elements;`. Use bracket access for names that aren't valid identifiers, eg. `elements['my-widget']`. Any name is accepted, so a misspelt tag (`elements.dvi`) creates an unknown element rather than an error.

`element(type, ...args)` does the same without the proxy, eg. `element('div', 'text')`.

Arguments can be given in any order:

 * A string or number is text content.
 * An object is the element's properties, eg. `{ class: 'parent', disabled: true }`. Only one property object is allowed.
 * An array, function or other spec is a child.

How values within a spec render:

 * Strings and numbers render as text, including `0` and `''`.
 * `null` and `undefined` render nothing.
 * `true` and `false` are reserved. They don't render as text, but don't rely on them rendering nothing either.
 * Functions are called with `(state, context)` and their result is rendered in their place.

### compose and composeEach

 * `compose(state, component, reuseKey)` renders `component(state, context)` in its own region. The state is passed whole, whatever its type, and watched for signals.
 * `composeEach(items, component, reuseKey)` creates the same kind of region for each item in a list (or any iterable). Each item is passed to the component, watched for signals, and matched to its existing DOM by identity, so reordered or inserted items reuse their elements.

A region is reused across renders while the same object is composed at the same point. When the object is replaced, the region (and its transient state) is discarded and rebuilt. Pass a `reuseKey` to match on something other than the state object.

### Re-rendering

 * A render context watches the object it renders. When that object is signalled, the region re-renders on the next animation frame.
 * A re-render covers everything within that region, including composed children, whether or not the children's own objects signalled. This keeps views that depend on parent state (eg. a selected item) correct.
 * To keep updates small, signal the most specific object whose view changed. Give frequently changing parts of the model their own object and their own compose boundary, eg. a `model.summary` object holding a total.
 * Updates requested in the same frame are consolidated. Outer regions update first, and an inner region already updated by its parent doesn't update again.
 * `context.update(state)` updates a region immediately, and `context.dispose()` removes it.

### Render contexts

Each region has a RenderContext, holding transient view state for that region:

 * `context.set(name, value, signalUpdate = false)` stores a value at this level. Pass `true` to also re-render the region on the next frame.
 * `context.get(name, defaultValue)` reads a value from this context or the closest outer context that has it.
 * `signal(context)` re-renders the region on the next frame.
 * `context.broadcast(event, data)` sends an event to all `onBroadcast` listeners in this context and the regions within it.
 * Initial values can be passed to `render(parent, state, component, initialContextValues)`.

### Properties

Element properties are JS properties at all times, never HTML attribute names, eg. `ariaExpanded` not `aria-expanded`, `htmlFor` not `for`, `tabIndex` not `tabindex`.

On each render, properties are compared with the spec from the previous render:

 * Only properties whose spec value changed are written.
 * Properties no longer in the spec are reset to their default value.
 * Anything the spec didn't change is left alone, so DOM code can safely manage other properties.

Each property should have one owner: set either by the spec, or by your own DOM code, not both.

Recognised property names are given special treatment:

 * `context_id`: stores a reference to the element as a context value, eg. `context_id: 'textbox'` then `context.get('textbox')`.
 * `key`: a reuse key for the element. By default elements within a region are matched by position. With a key they are matched by key, so their DOM state follows them when their position in the spec changes.
 * `class`: a class name, space separated names, or an array of names (falsy entries are ignored). Only classes from the previous spec are removed, so classes added by DOM code stay.
 * `style`: an object merged into `element.style` (including `--custom` properties), or a string replacing the whole inline style.
 * `dataset`: an object merged into `element.dataset`, eg. `dataset: { state: 'open' }` gives `data-state="open"`.
 * `attributes`: an object of HTML attributes, for anything without a writable JS property (SVG, `list`, ARIA element references, custom elements). `null` or `false` removes an attribute, and `true` sets it empty.

`setPropertyHandler(name, handler)` adds your own handler. Handlers are called on every render with `(context, element, key, value, previousValue)`, where `value` is undefined when the property has been removed from the spec.

### Listeners and lifecycle

These are added as children of an element, and given `(context, element)` where element is that parent element.

 * `listen(event, listener)` a DOM event listener, called with `(context, element, event)`.
 * `onPrepare(listener)` called during render, when first created.
 * `onAttach(listener)` called after the render that first creates it.
 * `onUpdate(listener)` called after every render.
 * `onRemove(listener)` called when removed.
 * `onBroadcast(event, listener)` called with `(context, element, data)` for broadcast events.
 * `onDelay(seconds, listener)`, `onTimer(seconds, listener)`, `onFrame(listener)` timers that are cancelled when removed.
 * `onContext(configurator)` called once with the context listener, to set `onAttach`, `onUpdate`, `onRemove` and `onBroadcast` together, and `addDisposable` for anything to be disposed on removal.

Listeners are set up once, when first created, but always call the listener from the latest render. Optional reuse keys can be passed after the listener, to only reuse a listener with matching keys.

### Signals

 * `watch(object, action, owner)`
 * `signal(object, ...args)`
 * `removeWatcher(ownerOrWatcher)`

Watched objects are held weakly. Watchers (and their owners) are held for as long as the watched object, or until removed. Watchers of disposed owners are ignored. An exception in one watcher is reported, and does not stop the others.

### Timers

 * `delay(seconds, action, owner)`
 * `timer(seconds, action, owner)`
 * `onNextFrame(action, owner)`
 * `onEveryFrame(action, owner)`
 * `onAnyFrame(action, owner)` runs on any frame that happens, without requesting frames
 * `cancel(owner)`
 * `await wait(secondsOrCondition, owner)`
 * `schedule((fiber) => {}, owner)`

All timers run on `requestAnimationFrame`, and frames are only requested when something is scheduled. Actions due in the same frame run in the order they were requested, and an exception in one is reported without stopping the others. Note that browsers pause animation frames in background tabs, so timers and signalled updates also pause until the tab is visible.

Actions with a disposed owner are ignored.

### Disposal

 * `markObjectAsDisposed(obj)`
 * `isObjectDisposed(obj)`

### Optional modules

 * `hair.tween.js` tweening any object property, and a transform wrapper for DOM elements.
 * `hair.pixi.js` integrating pixi.js views within the render context tree.

## License

MIT License, Copyright (c) 2026 Samuel Baird
