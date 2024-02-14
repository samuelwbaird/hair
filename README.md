# hair.js
A Javascript library for creation and update of DOM elements via component  function composition (but not purely FRP style)

Taking a few of the things I think people like about FRP libraries and removing others. Less concerned with managing a functional reactive component state isolated from the DOM, and more with responding to a separate model/world state. Some of these choices make more sense from the point of view of games, simulations, and long lived state, rather than more transactional websites with fresh queries per page.

hair.js is a single file module, that can be included in a project without any required build steps.

## Goals

 * Functions as composeable components that generate and update DOM state
 * The same component code can create or update the DOM
 * Direct access to the dom elements is supported by callbacks
 * Update via re-render of components OR via incremental change to DOM elements (ie. perhaps depending whether it is model state that has updated, or UI state)

## Trade offs / non-goals

 * Using a convention whereby the identity of state objects matters (ie. works better if updates to the base state or model are incremental updates to a mutable object, rather than a fresh state object returned from a query each time)
 * Not attempting to be a full or perfect implementation of a virtual dom or provide a genuine functional reactive paradigm
 

## Efficiency or reducing re-renders

 * If a component does not directly use the state passed to it to determine its output (perhaps only sub-components of that component use it), then execute that component function directly when including it (rather than add it by reference to be executed later).
 * Prefer to re-use state or model objects across updates to help the library re-use DOM elements, especially lists of objects
 
## Usage

The main usage is to create functions that describe an HTML layout using the functions provided by the library. These functions perform the basic work of creating and updating the DOM.

The output of the function can consist of single elements, or arrays of elements. Whenever elements are provided, they can be provided directly or as function references to create other components. The render process recursively resolves arrays and functions into direct elements.

All element functions allow three arguments in any order, a string for any text content, an object to set properties on the created element, and an array or single child element.

Event listeners are instantiated as a special kind of child element (hair.listen), and there is special handling for lists of objects (hair.compose).

See the included example TODO list to see examples of all of these in use.

Snippet:

	// bring the hair library in accessed as h.*
	import * as h from './js/hair.js';

	export default function app(model) {
		return [
			h.h1(model.name),
			
			h.div([
				
				// add this component in by immediately calling a function to return 
				itemCount(model.items.length),
				
				// use the compose function to request a managed render of a list of objects with a component
				h.ol({ _id: 'list' }, h.compose(model.items, (item) => displayItem(model, item))),
			]),
			
			h.div({ _class: 'add_item_area' }, [
				h.p('Add new items below'),
				
				// add this component in by providing a function to be called with the same state object
				addItem,
			]),
		];
	}

## Viewing the example project

Serve the root of repo using any local web server, eg.

	cd hair
	python3 -m http.server

Open the example folder in your browser

	open http://localhost:8000/example_todo_list/

	open http://localhost:8000/example_quiz/
 
## Special property handling

During instantiation or update of DOM elements, recognised property names are given special treatment when applied to the element.

 * \_id, this property sets a reference to the element on the context object, eg. \_id = "textbox" => sets a reference to this element at context.textbox
 * class, this property when given a name, or an array of names, will update the classList of the element to match
 * style, when an object value is applied to this property, the values of that object will be merged into the element style object, rather than replacing it

*setPropertyHandler* can be used to provide your own property handlers globally for your project.


## Status

Done

 * Determining the basic approach, include the interface for creating elements and context object related to DOM instantiation
 * First pass basic recursive render 
 * A centrally managed frame timer to request delayed frame updates in a consolidated manner
 * A globally available signal to trigger re-render on updates to model/state object
 * Initial rendering of HTML elements from a component tree
 * An approach to event listening and access to DOM elements
 * DOM updates without a full re-render
 * Property handling for different properties that need special treatment
 * Consider supplying an explicit list of dependency key objects when assigning callbacks (or more things?) to explicitly determine when reuse is appropriate
 * A typical TODO list as a working example
 * Ensure correct ordering of DOM elements when partially re-using content
 * Can we do more efficient moving through tracking the insert before target rather than the index
 * Dispose cycle through context tree

In progress

 * Add additional examples
 * Listening to component lifecycle events or arbitrary event dispatch
 * Information sharing through the context tree
 * Recurring timer or set number of repeats support?
 
To do

 * More efficient handling of long lists or large components (multi key dictionary instead of array)
 * Add JSDoc markup throughout
