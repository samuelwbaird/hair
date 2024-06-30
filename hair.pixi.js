// hair.pixi.js - MIT license, copyright 2024 Samuel Baird
// =============================================================================================
// Incorporating pixi.js into the hair components list, with some convenient wrappers on pixi functionality
//
// Create a canvas in your dom heiracy, using CSS to set sizing, positioning and layering,
// adding a PixiCanvas component to manage the integration.
//
// This will be registeted in the render context tree, anywhere in the rest of the tree add
// a pixi_scene
//
// import * as h from 'hair.js';
// import * as hp from 'hair-pixi.js';
//
// function gameView () {
//   return [
//    h.element('canvas', { class: 'game-canvas' }, hp.pixi_canvas(canvas) => {
//      canvas.setLogicalSize(480, 320);
//    }),
//    hp.pixi_scene(() => {
//      // provide a constructor to add an associate pixi scene, an object that extends PixiNode
//      return new GameScene();
//    }),
// ];
//
// Considering the possiblity of creating PixiView direct from this component spec...
// eg. hp.pixi_view(create_spec),
//
// Reference
//   pixi_canvas
//   pixi_view
//   assets
//   PixiCanvas    wraps the DOM canvas, handles sizing, render and dispatches touch events
//   PixiNode      logical tree of objects operating a pixi scene (each has a PixiView view)
//   PixiView      a pixi container view with convenience methods to quickly scaffold pixi display objects
//   PixiClip
//   TouchArea

import * as hair from './hair.js';

// -- public interface ----------------------------------------------------------------------

// attach an HTML canvas to the DOM as part of a hair view component
// include a callback to configure that canvas when it is first added
export function pixi_canvas (withCanvas, ...reuseKeys) {
	return hair.onContext((contextListener) => {
		// create a pixi canvas object immediately
		// and set it in the context tree for remainder of render
		let pixi_canvas = new PixiCanvas();
		contextListener.context.set('pixi_canvas', pixi_canvas);
		contextListener.onAttach = (context, element) => {
			// wrap the canvas DOM element in a PixiCanvas object
			pixi_canvas.attach(element);
			// apply the users callback to configure the canvas
			withCanvas?.(pixi_canvas);
		};
		contextListener.onRemove = (context, element) => {
			if (pixi_canvas) {
				pixi_canvas.dispose();
				pixi_canvas = null;
			}
		};
	}, ...reuseKeys);
}

//
export function pixi_scene (sceneConstructor, ...reuseKeys) {
	return hair.onContext((contextListener) => {
		const pixi_canvas = contextListener.context.get('pixi_canvas');
		if (!pixi_canvas) {
			throw new Error('There must be a pixi canvas within the context tree to create a scene.');
		}

		let scene = null;
		contextListener.onAttach = (context, element) => {
			scene = sceneConstructor(context);
			pixi_canvas.addScene(scene);
		};
		contextListener.onBroadcast = (eventName, eventData) => {
			scene.onBroadcast(eventName, eventData);
		};
		contextListener.onRemove = (context, element) => {
			if (scene) {
				pixi_canvas.removeScene(scene);
				scene = null;
			}
		};
	}, ...reuseKeys);
}

export const animations = {};
export const fontStyles = {};

export const assets = {

	loadJson: async (name) => {
		const response = await fetch(name);
		return await response.json();
	},

	loadSpritesheet: async (name) => {
		const spritesheet = await PIXI.Assets.load(name);
		// check for additional animation data in the json
		// the data for the sprite gets typecast in pixi TS code and loses information, so we have to query it again
		const json = await assets.loadJson(name);
		if (json.clips) {
			for (const k in json.clips) {
				animations[k] = json.clips[k];
			}
		}
		return spritesheet;
	},

	// set named font style
	setFontStyle: (name, props) => {
		fontStyles[name] = props;
	},

	// set named colours
	// get and reuse plain colour textures

};

// set some default fonts
assets.setFontStyle('default', { align: 'center', fill: 0xffffff, fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 11, padding: 4 });
assets.setFontStyle('button', { align: 'center', fill: 0x000000, fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 11, padding: 4 });

export class PixiCanvas {

	constructor () {
		this.canvas = null;
		this.pixiApp = null;
		this.screen = null;
		
		// top level pixi nodes attached to the canvas
		this.scenes = new UpdateList();
	}

	attach (canvas, hairRenderContext) {
		if (this.canvas) {
			throw new Error('PixiCanvas cannot be reattached');
		}
		this.canvas = canvas;
		
		this.context = new Context(hairRenderContext, {
			app: this.pixiApp,
			screen: this.screen,
			canvas: this.canvas,
			pixiCanvas: this,
			// automatic attachment point for child objects
			pixiView: this.screen,
		});
		
		// set up phased frame events
		hair.onAnyFrame(() => { this.phasePrepareFrame(); }, this).phase = PHASE_PREPARE_FRAME;
		hair.onAnyFrame(() => { this.phaseRenderFrame(); }, this).phase = PHASE_RENDER_FRAME;

		// then request at least one specific frame to trigger the first render
		hair.onNextFrame(() => { this.phaseConfig(); }, this).phase = PHASE_CONFIG;
	}
	
	addScene (scene) {
		this.scenes.add(scene);
		scene.context = new Context(this.context);
		scene.begin();
	}
	
	removeScene (scene) {
		if (this.scenes.remove(scene)) {
			scene.dispose();
		}
	}

	phaseConfig () {
		// create pixi application
		const options = {
			view: this.canvas,
		};
		this.pixiApp = new PIXI.Application(options);
		
		// set up a screen fit top level container
		this.screen = new PIXI.Container();
		this.pixiApp.stage.addChild(this.screen);

		// set up touch listeners
	}

	phasePrepareFrame () {
		// resizeIfNeeded(true);

		// clear any previous scene if we're switching
		// set scaling and sizing of the canvas element and logical sizing
		// add in any scene if we're switching
		// dispatch touch events
		// update animations
		// update timers

		// app = new PIXI.Application(pixiOptions);
		// if (!app.view.parentNode) {
		// 	document.body.appendChild(app.view);
		// }
		// // set up a screen fit top level container
		// screen = new PIXI.Container();
		// app.stage.addChild(screen);
	}
	
	phaseRenderFrame () {
		this.pixiApp.render();		
	}

	dispose () {
		if (this.scenes) {
			this.scenes.update((scene) => {
				scene.dispose();
			});
			this.scenes = null;
		}
	}

}

// PixiNode
// canvas
// context (render context, shared for broadcast events and info)
// begin (subclass overrides and sets behaviour here on first real frame)
// dispose (lots of automatic disposable stuff)

// children
// add (begin)
// remove (dispose)

// animation tree (if there are any animations present)


export class PixiNode {
	
	// set subclass specific values in the constructor
	// but wait for begin to act when all supporting values are in place
	
	constructor () {
		
	}

	begin () {
		this.pixiView = new PixiView(this);
		// add to the parent by default
		const parent = this.context.get('pixiView');
		if (parent) {
			parent.addChild(this.pixiView);
		} else {
			screen.addChild(this.pixiView);
		}
		node.context.set('pixiView', this.pixiView);
		node.addDisposable(this.pixiView);
	}

	add (child) {
		if (!this.children) {
			this.children = new UpdateList();
		}
		this.children.add(child);

		child.context = this.context.derive();
		child.begin();

		return child;
	}

	remove (child) {
		if (!this.children) {
			return;
		}
		if (this.children.remove(child)) {
			child.dispose();
		}
	}

	removeAllChildren () {
		if (this.children) {
			const oldList = this.children;
			this.children = null;
			for (const updateListEntry of oldList.list) {
				updateListEntry.obj.dispose();
			}
		}
	}

	tween () {
		// wrap hair.tween with this as the owner
	}

	delay () {
		// wrap hair.delay wih this as the owner
	}

	hook () {
		// wrap hair.onEveryFrame with this as the owner
	}
	
	// timer
	// coroutines...
	
	// update (delta) pre any render
	// some kind of tree walk, or tree walk for views updating animations (maybe from canvas)

	onBroadcast (eventName, eventData) {

	}

	addDisposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	dispose () {
		if (this.children) {
			this.children.update((child) => {
				child.dispose();
			});
			this.children = null;
		}

		if (this.disposables) {
			for (const disposable of this.disposables) {
				if (typeof disposable == 'function') {
					disposable();
				} else if (disposable.dispose) {
					disposable.dispose();
				} else {
					throw 'cannot dispose ' + disposable;
				}
			}
			this.disposables = null;
		}
	}
	
}

class Context {
	
	constructor (parent, initialValues = null) {
		this.parent = parent;
		this.contextValues = new Map();
		if (initialValues) {
			for (const [k, v] of Object.entries(initialValues)) {
				this.set(k, v);
			}			
		}
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
			return this.parentContext.get(name, defaultValue);
		}
		return defaultValue;
	}	
	
}

class UpdateList {
	
	constructor () {
		this.list = [];

		// control updates during iteration
		this.isIterating = false;
		this.iterationIndex = 0;

		// these are only create if an interruption to fast path occurs
		this.slowPathToComplete = null;
		this.slowPathToIgnore = null;
	}

	add (obj, tag) {
		// capture the slow path here before objects are added this update cycle
		this.enableSlowPathIterationIfRequired();

		this.list.push({
			obj: obj,
			tag: tag,
		});

		return obj;
	}

	remove (objOrTag) {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		let didRemove = false;
		let i = 0;
		while (i < this.list.length) {
			const entry = this.list[i];
			if (entry.obj == objOrTag || entry.tag == objOrTag) {
				this.list.splice(i, 1);
				didRemove = true;
			} else {
				i++;
			}
		}

		return didRemove;
	}

	clear () {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		// clear our actual list
		this.list = [];
	}

	isClear () {
		return this.list.length == 0;
	}

	first () {
		return this.list[0].obj;
	}

	last () {
		return this.list[this.list.length - 1].obj;
	}

	update (updateFunction, removeONReturnTrue) {
		// if we're already in an iteration, don't allow it to recurse
		if (this.isIterating) {
			return;
		}

		// markers to begin the iteration in fast path
		this.isIterating = true;

		// begin on a fast path, iterating by index and removing complete updates as required
		// avoid creation of temporary objects unless update during iteration requires it
		let i = 0;
		let length = this.list.length;
		while (i < length && this.slowPathToComplete == null) {
			// save this marker in case we drop off the fast path
			this.iterationIndex = i;

			// check this entry, update and remove if required
			const entry = this.list[i];
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
				// if we've jumped onto the slow path during the update then be careful here
				if (this.slowPathToComplete != null) {
					const postUpdateIndex = this.list.indexOf(entry);
					if (postUpdateIndex >= 0) {
						this.list.splice(postUpdateIndex, 1);
					}
				} else {
					this.list.splice(i, 1);
					length--;
				}
			} else {
				i++;
			}
		}

		// if we've dropped off the fast path then complete the iteration on the slow path
		if (this.slowPathToComplete != null) {
			// complete all that haven't been removed since we started the slow path
			for (const entry of this.slowPathToComplete) {
				// first check this entry is still in the real list
				const currentIndex = this.list.indexOf(entry);
				if (currentIndex >= 0) {
					if (updateFunction(entry.obj) === true && removeONReturnTrue) {
						// find and remove it from the original list, if its still in after the update function
						const postUpdateIndex = this.list.indexOf(entry);
						if (postUpdateIndex >= 0) {
							this.list.splice(postUpdateIndex, 1);
						}
					}
				}
			}
		}

		// clear flags and data that can be accumulated during iteration
		this.slowPathToComplete = null;
		this.isIterating = false;
	}

	enableSlowPathIterationIfRequired () {
		// only do this if we haven't already for this iteration
		if (!this.isIterating || this.slowPathToComplete != null) {
			return;
		}

		// capture a copy of everything we need to complete on the remainder of the fast path
		this.slowPathToComplete = [];
		for (let i = this.iterationIndex + 1; i < this.list.length; i++) {
			this.slowPathToComplete.push(this.list[i]);
		}
	}

	cloneUpdate (updateFunction, removeONReturnTrue) {
		const clone = this.list.concat();
		for (const entry of clone) {
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
				const index = this.list.indexOf(entry);
				if (index > -1) {
					this.list.splice(index, 1);
				}
			}
		}
	}
}


export class PixiView {

}

export class PixiClip {

}

export class TouchArea {

}

const PHASE_CONFIG = -10;
const PHASE_PREPARE_FRAME = -9;
const PHASE_RENDER_FRAME = 10;
