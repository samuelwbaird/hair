// hair.pixi.js - MIT license, copyright 2024 Samuel Baird
// =============================================================================================
// Incorporating pixi.js into the hair components list, with some convenient wrappers on pixi functionality
//
// Create a canvas in your dom heiracy, using CSS to set sizing, positioning and layering,
// adding a PixiCanvas component to manage the integration.
//
// This will be registeted in the render context tree, anywhere in the rest of the tree add
// a pixi_view, and control it using the timing and tweening and updates from hair
//
// import * as h from 'hair.js';
// import * as hp from 'hair-pixi.js';
//
// function gameView () {
//   return [
//    h.element('canvas', { class: 'game-canvas' }, hp.pixi_canvas(canvas) => {
//      canvas.setLogicalSize(480, 320);
//    }, ...reuseKeys),
//    hp.pixi_view([
//      // create spec
//    ], ...reuseKeys),
//    hp.pixi_view(() => { return new SceneView(); }, ...reuseKeys),
// ];
//
// Reference
//   pixi_canvas
//   pixi_view
//   assets
//
//   PixiCanvas    wraps the DOM canvas, handles sizing, render and dispatches touch events
//   PixiView      a pixi container view with convenience methods to quickly scaffold pixi display objects
//   PixiClip
//   TouchArea


// TODO:
// -- check that delays and tweens return an individually cancellable object, if not then implement a token(owner)
// -- how to set properties on the top level pixi view, in the create spec, apply a spec with no created object to the view itself, eg. { x: ?, y: ? }
// * create core.schedule(asycn (fiber) => { }), to run coroutines as async functions, fiber.wait() fiber.wait(time), fiber.wait(condition)
// * wrap delay, tween and schedule on PixiView to automatically set the view as the owner
// * how to correctly parent pixi views? unclear if pixi view can have child components, or use compose to achieve this

import * as core from './hair.core.js';
import * as html from './hair.html.js';

// -- public interface ----------------------------------------------------------------------

// -- create pixi elements within the hair render -----------------------------------------------

// attach an HTML canvas to the DOM as part of a hair view component
// include a callback to configure that canvas when it is first added
export function pixi_canvas (withCanvas, ...reuseKeys) {
	return html.onContext((contextListener) => {
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

// create or update a pixi view on each render
export function pixi_view (createSpecOrConstructor, ...reuseKeys) {
	return html.onContext((contextListener) => {
		const pixi_canvas = contextListener.context.get('pixi_canvas');
		if (!pixi_canvas) {
			throw new Error('There must be a pixi canvas within the context tree to create a node.');
		}

		// set the view in the context to be the parent
		let view = null;
		contextListener.onAttach = (context, element) => {
			pixi_canvas.withAvailableScreen(() => {
				let parent = context.get('pixi_parent');
				if (parent == null) {
					parent = pixi_canvas.screen;
				}

				if (Array.isArray(createSpecOrConstructor)) {
					view = new PixiView();
					view.attach(pixi_canvas, context);
					parent.addChild(view);
					view.create(createSpecOrConstructor);
				} else {
					view = createSpecOrConstructor(context);
					view.attach(pixi_canvas, context);
					parent.addChild(view);
					view.begin();
				}
			});
		};
		contextListener.onRemove = (context, element) => {
			if (view) {
				core.markObjectAsDisposed(view);
				view.parent.removeChild(view);
				view = null;
			}
		};
	}, ...reuseKeys);
}

// -- shared asset management --------------------------------------------------------------------

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

// -------------------------------------------------------------------------------------------------

// -- PixiCanvas renders canvas in the hair render heirarchy and integrates it into timers ------------

const PHASE_CONFIG = -10;
const PHASE_PREPARE_FRAME = -9;
const PHASE_LATE_PREPARE = -8;
const PHASE_RENDER_FRAME = 10;

export class PixiCanvas {

	constructor () {
		this.canvas = null;
		this.pixiApp = null;
		this.screen = null;

		// top level pixi nodes attached to the canvas
		this.listeners = [];
	}

	setLogicalSize (fitWidth = null, fitHeight = null, maxWidth = null, maxHeight = null, density = null) {
		this.fitWidth = fitWidth;
		this.fitHeight = fitHeight;
		this.maxWidth = maxWidth;
		this.maxHeight = maxHeight;
		this.density = density ?? window.devicePixelRatio;
		this.updateSizing();
	}

	attach (canvas, hairRenderContext) {
		if (this.canvas) {
			throw new Error('PixiCanvas cannot be reattached');
		}
		this.canvas = canvas;

		// set up phased frame events
		core.onAnyFrame(() => { this.phasePrepareFrame(); }, this).phase = PHASE_PREPARE_FRAME;
		core.onAnyFrame(() => { this.phaseRenderFrame(); }, this).phase = PHASE_RENDER_FRAME;

		// then request at least one specific frame to trigger the first render
		core.onNextFrame(() => { this.phaseConfig(); }, this).phase = PHASE_CONFIG;
	}

	withAvailableScreen (action, owner) {
		if (this.pixiApp) {
			action();
		} else {
			core.onNextFrame(() => {
				action();
			}, owner).phase = PHASE_LATE_PREPARE;
		}
	}

	phaseConfig () {
		// create pixi application
		const options = {
			view: this.canvas,
		};
		this.pixiApp = new PIXI.Application(options);

		// set up a screen fit top level container
		this.screen = new PixiView();
		this.pixiApp.stage.addChild(this.screen);

		// set scaling and sizing of the canvas element and logical sizing
		// set up touch listeners

		// assume if the window resizes we need to re-render
		this.listen(window, 'resize', () => {
			// do nothing, but this makes sure a render is triggered
			core.requireNextFrame();
		});
	}

	phasePrepareFrame () {
		// set scaling and sizing of the canvas element and logical sizing
		this.updateSizing();

		// prepare through the node tree
		this.walkViews(this.screen, 'prepare');

		// dispatch touch events

	}

	phaseRenderFrame () {
		this.pixiApp.render();

		// update animations
		let callbacks = [];
		this.walkViews(this.screen, 'updateAnimation', core.frameDeltaSeconds, (callback) => {
			callbacks.push(callback);
		});
		for (const callback of callbacks) {
			callback();
		}
	}

	updateSizing () {
		if (!this.pixiApp) {
			return;
		}

		// find out the dom sizing of the canvase element
		const bounds = this.pixiApp.view.getBoundingClientRect();

		const targetWidth = this.fitWidth ?? bounds.width;
		const targetHeight = this.fitHeight ?? bounds.height;

		// check if the screen spec is different
		const screenSpec = bounds.width + ':' + bounds.height + ' <- ' + targetWidth + ':' + targetHeight + ':' + this.density;
		if (screenSpec == this.screenSpec) {
			return;
		} else {
			this.screenSpec = screenSpec;
			console.log(screenSpec);
		}

		let useWidth = 0;
		let useHeight = 0;
		const ratio = bounds.width / bounds.height;
		const idealRatio = targetWidth / targetHeight;
		if (ratio > idealRatio) {
			useHeight = targetHeight;
			useWidth = useHeight * ratio;
		} else {
			useWidth = targetWidth;
			useHeight = useWidth / ratio;
		}

		// set up the canvas to be the pixel size we need
		this.pixiApp.renderer.resize(useWidth * this.density, useHeight * this.density);
		PIXI.Text.defaultResolution = this.density;
		PIXI.Text.defaultAutoResolution = false;

		// set up and position our screen parent
		this.screen.scale.set(this.density);

		// if we have a max width or max height then we need to center and mask the results
		let maskNeeded = false;
		if (this.screen.mask) {
			this.screen.mask.removeFromParent();
			this.screen.mask = null;
		}

		if (this.maxWidth && useWidth > this.maxWidth) {
			this.screen.x = ((useWidth - this.maxWidth) * 0.5) * this.density;
			useWidth = this.maxWidth;
			maskNeeded = true;
		} else {
			this.screen.x = 0;
		}

		if (this.maxHeight && useHeight > this.maxHeight) {
			this.screen.y = ((useHeight - this.maxHeight) * 0.5) * this.density;
			useHeight = this.maxHeight;
			maskNeeded = true;
		} else {
			this.screen.y = 0;
		}

		// create a mask
		if (maskNeeded) {
			// gets mispositioned over time?
			this.screen.mask = new PIXI.Graphics().beginFill(0x00ffff, 0.5).drawRect(0, 0, useWidth, useHeight);
			this.screen.addChild(this.screen.mask);
		}

		// set values in the context for nodes to understand the screen size
		this.width = useWidth;
		this.height = useHeight;
	}

	listen (target, event, action) {
		this.listeners.push({
			target: target,
			event: event,
			action: action,
		});
		target.addEventListener(event, action);
	}

	walkViews (view, method, ...args) {
		if (view[method]) {
			view[method](...args);
		}
		if (view.children) {
			for (const child of view.children) {
				this.walkViews(child, method, ...args);
			}
		}
	}

	dispose () {
		if (this.listeners) {
			for (const listener of this.listeners) {
				listener.target.removeEventListener(listener.event, listener.action);
			}
			this.listeners = null;
		}
	}
}

// PixiView
// a heavyweight pixi view object with convenience methods to construct child elements
// and quickly scaffold a set of pixi objects, integrating touch
// each pixiview is linked to a node which provides interaction, timers and lifecycle
export class PixiView extends PIXI.Container {

	constructor () {
		super();

		// created elements
		this.createdElements = [];

		// we're not using the pixi event system
		this.eventMode = 'none';
	}

	attach (pixi_canvas, context) {
		this.pixi_canvas = pixi_canvas;
		this.context = context;
	}

	begin () {
		// override this method to set up an action on first update after attaching
	}

	// prepare () {
	// 	// create this method to prepare during every triggered render cycle
	// }

	delay (seconds, action) {
		return core.delay(seconds, action, this);
	}

	tween (...args) {
		return core.tween();
	}
	
	tween(target, properties, timing) {
		return core.tween(target, properties, timing, this);
	}

	async asyncTween(target, properties, timing) {
		return core.asyncTween(target, properties, timing, this);
	}	

	get linearScale () {
		return (this.scale.x + this.scale.y) * 0.5;
	}

	set linearScale (value) {
		this.scale.set(value, value);
	}

	sendToBack (child) {
		if (child) {
			this.removeChild(child);
			this.addChildAt(child, 0);
		} else {
			this.parent.sendToBack(this);
		}

	}

	sendToFront (child) {
		if (child) {
			// forces to front
			this.addChild(child);
		} else {
			this.parent.sendToFront(this);
		}
	}

	addToSpec (pixiObj, spec) {
		// apply standard properties shared by most objects
		pixiObj.position.set(spec.x ?? 0, spec.y ?? 0);
		pixiObj.scale.set(spec.scaleX ?? spec.scale ?? 1, spec.scaleY ?? spec.scale ?? 1);
		pixiObj.alpha = spec.alpha ?? 1;
		pixiObj.rotation = spec.rotation ?? 0;
		pixiObj.visible = (spec.visible !== undefined ? spec.visible : true);

		if (pixiObj == this) {
			return;
		}
		
		// add to scene tree
		this.addChild(pixiObj);

		// set a reference if given
		if (spec.id && !this[spec.id]) {
			this[spec.id] = pixiObj;
		}
		// allow clean up
		this.createdElements.push({
			id: spec.id,
			display: pixiObj,
		});

		return pixiObj;
	}

	// individual creator/adder functions
	addSubview (spec) {
		return this.addToSpec(new PixiView(), spec);
	}

	addRect (spec) {
		const rectangle = this.addToSpec(PIXI.Sprite.from(PIXI.Texture.WHITE), spec);
		if (spec.width) {
			rectangle.width = spec.width;
		}
		if (spec.height) {
			rectangle.height = spec.height;
		}
		rectangle.tint = spec.rect ?? spec.color ?? 0xFFFFFF;
		return rectangle;
	}

	addSprite (spec) {
		return this.addToSpec(PIXI.Sprite.from(spec.sprite), spec);
	}

	addClip (spec) {
		const clip = this.addToSpec(new PixiClip(), spec);
		clip.play(spec.clip, spec.loop ?? spec.onComplete);
	}

	addText (spec) {
		// base font spec
		const style = Object.assign({}, fontStyles[spec.font ?? 'default']);
		// style object
		if (spec.style) {
			Object.assign(style, spec.style);
		}
		// overrides in the spec
		Object.assign(style, spec);

		if (spec.color) {
			style.fill = spec.color;
		}
		if (spec.wordWrap) {
			style.wordWrap = true;
			style.wordWrapWidth = spec.wordWrap;
			style.breakWords = true;
		}
		if (spec.lineHeight) {
			style.lineHeight = spec.lineHeight;
		}
		const text = this.addToSpec(new PIXI.Text(spec.text, style), spec);
		if (style.align == 'center') {
			text.anchor.set(0.5);
		} else if (style.align == 'right') {
			text.anchor.set(1, 0);
		} else if (style.align == 'left') {
			text.anchor.set(0, 0);
		}
		return text;
	}

	addFill (color, alpha) {
		const screen = this.node.screen;
		return this.addRect({ x: 0, y: 0, width: screen.screenWidth, height: screen.screenHeight, color: color, alpha: alpha });
	}

	// remove all created items and clear references
	clear () {
		for (const created of this.createdElements) {
			if (created.id && this[created.id] == created.display) {
				delete this[created.id];
			}
			created.display.removeFromParent();
		}
		this.createdElements = [];
	}

	// compount creation, either a single spec, or an array of specs
	create (spec) {
		// allow composition by array or function
		if (Array.isArray(spec)) {
			const results = [];
			for (const entry of spec) {
				results.push(this.create(entry));
			}
			return results;
		} else if (spec instanceof Function) {
			return this.create(spec());
		}

		if (spec.children !== undefined) {
			// if this spec has children then all its content must be in a new subview
			const view = this.addSubview(spec);
			view.create(spec.children);
			return view;

		} else if (spec.fill !== undefined) {
			spec.x = -this.x;
			spec.y = -this.y;
			spec.width = this.node.screen.screenWidth;
			spec.height = this.node.screen.screenHeight;
			spec.color = spec.fill;
			return this.addRect(spec);

		} else if (spec.rect !== undefined) {
			return this.addRect(spec);

		} else if (spec.sprite !== undefined) {
			return this.addSprite(spec);

		} else if (spec.clip !== undefined) {
			return this.addClip(spec);

		} else if (spec.text !== undefined) {
			return this.addText(spec);
			
		} else if (spec.parent) {
			this.addToSpec(this, spec);

		} else {
			console.assert('unrecognised pixiview spec');
		}
	}

	addTouchArea (target, boundsOrPadding) {
		// convert a canvas co-ord to target space
		const pointConversion = (point) => {
			return target.toLocal(point);
		};

		// how do we determine what points are in bounds
		let areaTest = null;
		if (boundsOrPadding instanceof PIXI.Rectangle) {
			areaTest = (point) => {
				return boundsOrPadding.contains(point.x, point.y);
			};

		} else {
			boundsOrPadding = boundsOrPadding ?? 0;
			areaTest = (point) => {
				const rect = target.getLocalBounds();
				rect.pad(boundsOrPadding);
				return rect.contains(point.x, point.y);
			};
		}

		return this.node.addDisposable(new ui.TouchArea(pointConversion, areaTest, this.node.context.get('event_dispatch')));
	}

	dispose () {
		this.removeFromParent();
	}
}

// PixiClip
// an animated view object, driven from loaded animation data
export class PixiClip extends PIXI.Container {

	constructor () {
		super();
		this.playbackSpeed = 1;
		this.playbackPosition = 0;
		this.playbackLength = 0;
		this.isPlaying = false;

		this.fps = 0;
		this.frames = [];
		this.currentFrame = null;
		this.loop = true;
	}

	stop () {
		this.isPlaying = false;
	}

	play (animation, loopOrOncomplete) {
		core.requireNextFrame();

		if (typeof animation == 'string') {
			animation = animations[animation];
		}

		this.fps = animation ? animation.fps : 1;
		this.frames = animation ? animation.frames : [];
		this.playbackPosition = 0;
		this.playbackLength = (this.frames.length / this.fps);
		this.isPlaying = this.frames.length > 0;

		if (typeof loopOrOncomplete == 'boolean') {
			this.loop = loopOrOncomplete;
			this.onComplete = null;
		} else {
			this.loop = false;
			this.onComplete = loopOrOncomplete;
		}

		this.setFrame(this.frames[0]);
	}

	randomOffsetLoop () {
		// random offset a looping animation
		this.playbackPosition = Math.random() * this.playbackLength;
		this.setFrame(this.frames[Math.floor(this.playbackPosition)]);
	}

	playNext (animation, loopOrOncomplete) {
		if (!this.isPlaying) {
			return this.play(animation, loopOrOncomplete);
		}

		// don't loop the current animation
		this.loop = false;
		const oldOncomplete = this.onComplete;
		this.onComplete = () => {
			oldOncomplete?.();
			this.play(animation, loopOrOncomplete);
		};
	}

	updateAnimation (delta, withCallbacks) {
		if (!this.isPlaying || this.playbackLength == 0) {
			return;
		}

		this.playbackPosition += (this.playbackSpeed * delta);
		let targetFrame = Math.floor(this.playbackPosition * this.fps);

		if (this.playbackPosition >= this.playbackLength) {
			if (this.loop) {
				while (this.playbackPosition > this.playbackLength) {
					this.playbackPosition -= this.playbackLength;
					targetFrame -= this.frames.length;
				}
			} else {
				this.playbackPosition = this.playbackLength;
				this.isPlaying = false;
				targetFrame = this.frames.length - 1;
			}
		}

		const frame = this.frames[targetFrame];
		if (frame != this.currentFrame) {
			this.setFrame(frame);
		}

		if (this.isPlaying) {
			core.requireNextFrame();
		} else {
			if (this.onComplete) {
				withCallbacks(this.onComplete);
				this.onComplete = null;
			}
		}
	}

	setFrame (frame) {
		if (!frame) {
			this.removeChildren();
			return;
		}
		this.currentFrame = frame;

		// if the frame is a simple single image frame
		if (typeof frame == 'string') {
			this.removeChildren();
			this.addChild(PIXI.Sprite.from(frame));
			return;
		}

		// TODO: port flash style animation (recursive tree) this from letter-js
		// create a map of all existing child objects (by instance name if given)
		// apply from back to front all specified children for this animation frame, reusing existing where instance name matches
		// setting transforms and frame number from animation data
		// remove any previous child objects not carried through
	}

}

class TouchArea {

}