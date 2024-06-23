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
			scene = sceneConstructor(pixi_canvas);
			// canvas.addScene(scene);
			// scene.begin();
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
	}

	attach (canvas) {
		if (this.canvas) {
			throw new Error('PixiCanvas cannot be reattached');
		}
		this.canvas = canvas;
		
		// set up phased frame events
		hair.onAnyFrame(() => { this.phasePrepareFrame(); }, this).phase = PHASE_PREPARE_FRAME;
		hair.onAnyFrame(() => { this.phaseRenderFrame(); }, this).phase = PHASE_RENDER_FRAME;

		// then request at least one specific frame to trigger the first render
		hair.onNextFrame(() => { this.phaseConfig(); }, this).phase = PHASE_CONFIG;
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


export class PixiScene {

	constructor (pixi_canvas) {
		this.pixi_canvas = pixi_canvas;
	}

	begin () {

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

const PHASE_CONFIG = -10;
const PHASE_PREPARE_FRAME = -9;
const PHASE_RENDER_FRAME = 10;
