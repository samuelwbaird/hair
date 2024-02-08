# hair.js
A Javascript library for creation and update of DOM elements via component  function composition (but not purely FRP style)

Taking a few of the things I think people like about FRP libraries and m

Less concerned with taking a functional reactive isolating component state from the DOM, and more c with responding to a separate model/world state

## Goals

 * Functions as composeable components that generate and update DOM state
 * The same component code can create or update the DOM
 * Direct access to the dom elements is supported by callbacks
 * Update via re-render of components OR via incremental change to DOM elements (ie. perhaps depending whether it is model state that has updated, or UI state)

## Trade offs / non-goals

 * Using a convention where by the identity of state objects matters (ie. works better if updates to the base state or model are updates to a mutable object, rather than a fresh state object each time)
 * Not attempting to be a full or perfect implementation of a virtual dom or provide a genuine functional reactive paradigm
 
## Usage

The main usage is to create functions that describe an HTML layout using the functions provided by the library.

The output of the function can consist of single elements, or arrays of elements. Whenever elements are provided, they can be provided directly or as function references to create other components. The render process recursively resolves these into direct elements.

All element functions allow three arguments in any order, a string for any text content, an object to set properties on the created element, and an array or single child element.

Event listeners are instantiated as a special kind of child element (hair.listen), and there is special handling for lists of objects (hair.compose).

See the included example TODO list to see examples of all of these.

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

Serve the root of repo using a local web server, eg.

	cd hair
	python3 -m http.server

Open the example folder in your browser

	open http://localhost:8000/example/
 

## Status

Done

 * Determining the basic approach, include the interface for creating elements and context object related to DOM instantian
 * First pass basic recursive render 

In progress

 * Initial rendering of HTML elements from a component tree
 * A typical TODO list as a working example
 * Approach to event listening and access to DOM elements
 * Property handling for applying 
 
To do

 * A globally available signal to trigger re-render on updates to model/state object
 * A centrally managed frame timer to request delayed frame updates in a consolidated manner
 * DOM updates without re-render
 * List specific render handling
 * Dispose cycle through context tree
 * Add JSDoc markup throughout
 * Add additional examples
