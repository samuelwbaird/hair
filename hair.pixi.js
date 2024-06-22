// hair.pixi.js - MIT license, copyright 2024 Samuel Baird
// =============================================================================================
// Incorporating pixi.js into the hair components list, with some convenient wrappers on pixi functionality
// 
// Create a PixiCanvas, somewhere in the DOM heirachy, either full screen, using the DOM for sizing
// or matching to the size and position of another element.
//
// PixiView contains convenience methods for quickly building a pixi scene, and for handling
// touch and interaction within the logical sizing set on the PixiCanvas.
//
//
//
// import * as hp from 'hair-pixi.js';
// return [
//	hp.pixi_canvas((canvas) => {
//    // canvas.fullScreen();
//    canvas.followElementPosition(domElement);	
//    canvas.setLogicalSize(480, 320);
//  }),
//
//  hp.pixi_scene((canvas, context) => {
//		// provide a constructor for the scene, an object that extends PixiScene
//		return new GameScene();	
//  }),
// ];
//
// Considering the possiblity of creating PixiView direct from this component spec...
// hp.pixi_view(create_spec),
//
// Reference
//   PixiCanvas
//   PixiScene
//   PixiView

// Then add PixiClip later

// create a canvas somewhere in the context
// optionally... set or update logical sizing

// attach a pixi scene to that canvas (pixi)

// should there be a PixiNode, and a pair PixiView
// or should the this feel more like it lives in a view heirachy, not a dual heirachy
// is PixiScene just a sub class of pixi view
// or even just a particular compose function to put a particular view in place

// PixiCanvas emits touch events, and PixiViews can listen via context parent tree
// Sizing at the canvas level
// PixiViews must be added to a child of the pixi canvas
// Things not to do

// TouchArea and touch events emitted from the canvas to pixi view objects?


import * as hair from './hair.js';

// -- public interface ----------------------------------------------------------------------


// attach an HTML canvas to the DOM as part of a hair view component
// include a callback to configure that canvas when it is first added
export function pixi_canvas (withCanvas, ...reuseKeys) {
	return hair.onContext((contextListener) => {
		let canvas = null;
		contextListener.onAttach = (context, element) => {
			// wrap the canvas DOM element in a PixiCanvas object
			canvas = new PixiCanvas(element);
			// set a reference on the context for 
			console.log('set canvas');
			context.set('pixi_canvas', canvas);
			// apply the users callback to configure the canvas
			withCanvas?.(canvas);
		};
		contextListener.onRemove = (context, element) => {
			if (canvas) {
				canvas.dispose();
				canvas = null;
			}			
		};
	}, ...reuseKeys);
}

// 
export function pixi_scene (sceneConstructor, ...reuseKeys) {
	return hair.onContext((contextListener) => {
		let scene = null;
		contextListener.onAttach = (context, element) => {
			const pixi_canvas = context.get('pixi_canvas');
			if (!pixi_canvas) {
				throw new Error('There must be a pixi canvas within the context tree to create a scene.');
			}			
			scene = sceneConstructor(pixi_canvas);
			// canvas.addScene(scene);
			scene.begin();
		};
		contextListener.onBroadcast = (eventName, eventData) => {
			scene.onBroadcast(eventName, eventData);			
		};
		contextListener.onRemove = (context, element) => {
			if (scene) {
				scene.dispose();
				scene = null;
			}
		};		
	}, ...reuseKeys);
}

export class PixiCanvas {
	
	constructor (canvas) {
		this.canvas = canvas;
	}	
	
	dispose () {
		
	}
	
}

export class PixiScene {
	
	constructor (pixi_canvas) {
		this.pixi_canvas = pixi_canvas;
	}
	
	begin () {
		
	}
	
	update () {
		
	}
	
	onBroadcast (eventName, eventData) {
		
	}
	
	dispose () {
		
	}
	
}

export class PixiView {
	
}

export class PixiClip {
	
}

export class TouchArea {
	
}
