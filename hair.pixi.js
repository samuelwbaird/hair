// hair.pixi.js - MIT license, copyright 2024 Samuel Baird
// =============================================================================================
// Incorporating pixi.js into the hair components list, with some convenient wrappers on pixi functionality
//
// Create a canvas in your dom heiracy, using CSS to set sizing, positioning and layering,
// adding a PixiCanvas component to manage the integration.
//
// This will be registeted in the render context tree, anywhere in the rest of the tree add
// a pixi_node
//
// import * as h from 'hair.js';
// import * as hp from 'hair-pixi.js';
//
// function gameView () {
//   return [
//    h.element('canvas', { class: 'game-canvas' }, hp.pixi_canvas(canvas) => {
//      canvas.setLogicalSize(480, 320);
//    }, ...reuseKeys),
//    hp.pixi_node(() => {
//      // provide a constructor to add an associate pixi node, an object that extends PixiNode
//      return new GameScene();
//    }, ...reuseKeys),
//    hp.pixi_view((view) => {
//		// create or update a pixi view on each render
//    }, ...reuseKeys);
//    hp.pixi_begin((node) => {
//		// attach an anonymous pixi node and provide a begin method on first attach
//    }, ...reuseKeys);
// ];
//
// Reference
//   pixi_canvas
//   pixi_view
//   assets
//
//   PixiCanvas    wraps the DOM canvas, handles sizing, render and dispatches touch events
//
//   PixiNode      logical tree of objects operating a pixi node (each has a PixiView view)
//   PixiView      a pixi container view with convenience methods to quickly scaffold pixi display objects
//   PixiClip
//   TouchArea
//
//   NodeContext	forwards information through the pixi node heirarchy (which is separate to the html node heirarchy)
//   UpdateList			a list that can be safely updated during iteration

import * as core from './hair.core.js';
import * as html from './hair.html.js';
import * as tween_lib from './hair.tween.js';

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

// attach an object that is a subclass of PixiNode, the view is added to the canvas
export function pixi_node (nodeConstructor, ...reuseKeys) {
	return html.onContext((contextListener) => {
		const pixi_canvas = contextListener.context.get('pixi_canvas');
		if (!pixi_canvas) {
			throw new Error('There must be a pixi canvas within the context tree to create a node.');
		}

		let node = null;
		contextListener.onAttach = (context, element) => {
			pixi_canvas.withAvailableView(() => {
				node = nodeConstructor(context);
				pixi_canvas.addNode(node);
			}, contextListener);
		};
		contextListener.onBroadcast = (eventName, eventData) => {
			node.onBroadcast(eventName, eventData);
		};
		contextListener.onRemove = (context, element) => {
			if (node) {
				pixi_canvas.removeNode(node);
				node = null;
			}
		};
	}, ...reuseKeys);
}

// create or update a pixi view on each render
export function pixi_view (viewUpdateFunction, ...reuseKeys) {
	return html.onContext((contextListener) => {
		const pixi_canvas = contextListener.context.get('pixi_canvas');
		if (!pixi_canvas) {
			throw new Error('There must be a pixi canvas within the context tree to create a node.');
		}

		// if the view update function is an array, assume its a create spec
		if (Array.isArray(viewUpdateFunction)) {
			const createSpec = viewUpdateFunction;
			viewUpdateFunction = (view) => {
				view.create(createSpec);
			};
		}

		let node = null;
		contextListener.onAttach = (context, element) => {
			pixi_canvas.withAvailableView(() => {
				node = new PixiNode();
				pixi_canvas.addNode(node);
				viewUpdateFunction(node.view);
			}, contextListener);
		};
		contextListener.onUpdate = (context, element) => {
			if (node != null) {
				viewUpdateFunction(node.view);
			}
		};
		contextListener.onRemove = (context, element) => {
			if (node) {
				pixi_canvas.removeNode(node);
				node = null;
			}
		};
	}, ...reuseKeys);
}

// attach an anonymous pixi node and provide a begin method on first attach
export function pixi_begin (nodeBeginFunction, ... reuseKeys) {
	return pixi_node(() => {
		return new AdhocPixiNode(nodeBeginFunction);
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
assets.setFontStyle('button', { align: 'center', fill: 0x000000, fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 11, padding: 4 });

// -------------------------------------------------------------------------------------------------



// -- PixiCanvas renders canvas in the hair render heirarchy and integrates it into timers ------------

const PHASE_CONFIG = -10;
const PHASE_PREPARE_FRAME = -9;
const PHASE_ADD_NODE = -8;
const PHASE_RENDER_FRAME = 10;

export class PixiCanvas {

	constructor () {
		this.canvas = null;
		this.pixiApp = null;
		this.screen = null;

		// top level pixi nodes attached to the canvas
		this.nodes = new UpdateList();
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

		this.context = new NodeContext(hairRenderContext, {
			canvas: this.canvas,
			pixiCanvas: this,
		});

		// set up phased frame events
		core.onAnyFrame(() => { this.phasePrepareFrame(); }, this).phase = PHASE_PREPARE_FRAME;
		core.onAnyFrame(() => { this.phaseRenderFrame(); }, this).phase = PHASE_RENDER_FRAME;

		// then request at least one specific frame to trigger the first render
		core.onNextFrame(() => { this.phaseConfig(); }, this).phase = PHASE_CONFIG;
	}

	addNode (node) {
		this.nodes.add(node);
		node.context = new NodeContext(this.context);
		node.begin();
	}

	removeNode (node) {
		if (this.nodes.remove(node)) {
			node.dispose();
		}
	}

	withAvailableView (action, owner) {
		if (this.pixiApp) {
			action();
		} else {
			core.onNextFrame(() => {
				action();
			}, owner).phase = PHASE_ADD_NODE;
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

		// set scaling and sizing of the canvas element and logical sizing
		// set up touch listeners

		// assume if the window resizes we need to re-render
		this.listen(window, 'resize', () => {
			core.onNextFrame(() => {
				// do nothing, but this makes sure a render is triggered
			});
		});

		this.context.set('app', this.pixiApp);
		this.context.set('screen', this.screen);
		this.context.set('view', this.screen);
	}

	phasePrepareFrame () {
		this.updateSizing();

		// set scaling and sizing of the canvas element and logical sizing
		// add in any node if we're switching
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
			this.screen.mask = new PIXI.Graphics().beginFill(0x00ffff, 0.33).drawRect(0, 0, useWidth, useHeight);
			this.screen.addChild(this.screen.mask);
		}

		// set values in the context for nodes to understand the screen size
		this.width = useWidth;
		this.height = useHeight;
		this.context.set('screenWidth', useWidth);
		this.context.set('screenHeight', useHeight);
	}

	listen (target, event, action) {
		this.listeners.push({
			target: target,
			event: event,
			action: action,
		});
		target.addEventListener(event, action);
	}

	dispose () {
		if (this.listeners) {
			for (const listener of this.listeners) {
				listener.target.removeEventListener(listener.event, listener.action);
			}
			this.listeners = null;
		}
		if (this.nodes) {
			this.nodes.update((node) => {
				node.dispose();
			});
			this.nodes = null;
		}
	}

}

// -- enhanced PIXI functionality ---------------------------------------------------------
// From here onwards the code is aware of Pixi but not hair.js
// it provides rich wrappers around pixi functionality, that are then easy to integrate
// ----------------------------------------------------------------------------------------

// PixiNode, main building block of interactive scenes
// subclass and override the begin method to set up the node behaviour
// or create instances of AdhocPixiNode

export class PixiNode {

	begin () {
		this.view = new PixiView(this);
		// add to the parent by default
		this.context.get('view').addChild(this.view);
		this.context.set('view', this.view);
		this.addDisposable(this.view);
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
		// TODO: wrap hair.tween with this as the owner
	}

	delay () {
		// TODO: wrap hair.delay wih this as the owner
	}

	hook () {
		// TODO: wrap hair.onEveryFrame with this as the owner
	}

	// TODO: coroutines...
	// TODO: update (delta) pre any render
	// TODO: some kind of tree walk, or tree walk for views updating animations (maybe from canvas)

	// TODO: send or respond to events within the context tree
	broadcast (eventName, eventData) {

	}

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

// a convenience for when a node only requires a custom begin method and no other specific functionality
export class AdhocPixiNode extends PixiNode {

	constructor (adhocBeginMethod) {
		super();
		this.adhocBeginMethod = adhocBeginMethod;
	}

	begin () {
		super.begin();
		this.adhocBeginMethod(this);
	}

}

// PixiView
// a heavyweight pixi view object with convenience methods to construct child elements
// and quickly scaffold a set of pixi objects, integrating touch
// each pixiview is linked to a node which provides interaction, timers and lifecycle
class PixiView extends PIXI.Container {

	constructor (node) {
		super();
		this.app = app;
		this.assets = assets;
		this.node = node;

		// created elements
		this.createdElements = [];

		// we're not using the pixi event system
		this.eventMode = 'none';
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
		return this.addToSpec(new PixiView(this.node), spec);
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

	createButton (spec) {
		// convenient greybox buttons
		if (spec.greyboxButton) {
			spec.text = spec.greyboxButton;
			spec.colorUp = 0xeeeeee;
			spec.colorDown = 0xbbbbbb;
			spec.font = spec.font ?? 'button';
			spec.color = spec.color ?? 'black';
		}

		// create a button with up and down states as child elements
		const button = this.addSubview({
			// the id will be the button id
			id: spec.id ?? spec.button,
			x: spec.x,
			y: spec.y,
			alpha: spec.alpha,
			visible: spec.visible,
			scale: spec.scale,
			rotation: spec.rotation,
		});

		// button expects two child views
		const down = button.addSubview({ id: 'down', visible : false });
		const up = button.addSubview({ id: 'up' });

		// what width and height are we using (default, or set by the image if not given)
		let width = spec.width;
		let height = spec.height;
		if (spec.imageUp) {
			const imageUp = up.addSprite({
				sprite: spec.imageUp,
			});
			width = width ?? imageUp.width;
			height = height ?? imageUp.height;
		}
		if (spec.imageDown) {
			down.addSprite({ sprite: spec.imageDown });
		}

		// set a default/debug width and height if not given
		width = width ?? 120;
		height = height ?? 30;

		// add plain colour backing if called for
		if (spec.colorDown) {
			down.addRect({ rect: spec.colorDown, width: width, height: height });
		}
		if (spec.colorUp) {
			up.addRect({ rect: spec.colorUp, width: width, height: height });
		}

		// add text label if called for
		if (spec.text) {
			const textSpec = { ...spec, id: 'text' };
			textSpec.x = width * 0.5;
			textSpec.y = height * 0.5;
			textSpec.align = 'center';
			up.addText(textSpec);
			down.addText(textSpec);
		}

		if (spec.action) {
			button.button = this.addButton(button, spec.action);
		}
		return button;
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

		if (spec.button !== undefined || spec.greyboxButton !== undefined) {
			return this.createButton(spec);

		} else if (spec.children !== undefined) {
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

	addButton (target, onClick) {
		const touchArea = this.addTouchArea(target);
		return this.node.addDisposable(new ui.Button(target, touchArea, this.node.getFrameDispatch(), onClick));
	}

	dispose () {
		this.removeFromParent();
	}
}

// PixiClip
// an animated view object, driven from loaded animation data
// currently limited to
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

		if (!this.isPlaying) {
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

// -- internal utilities ---------------------------------------------------------------------
// From here below, code is not aware of Pixi or hair specifics

// NodeContext, forwards information down a node heirarchy
class NodeContext {

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
		if (this.parent) {
			return this.parent.get(name, defaultValue);
		}
		return defaultValue;
	}

}

// a list that allows update during iteration in an ordered manner
class UpdateList {

	constructor () {
		this.list = [];

		// control updates during iteration
		this.isIterating = false;
		this.iterationIndex = 0;

		// these are only create if an interruption to fast path occurs
		this.slowPathToComplete = null;
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

	length () {
		return this.list.length;
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
