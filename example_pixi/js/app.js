// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

import * as model from './model.js';
import * as scene from './scene.js';

// show an HTML loading scene while loading assets, (async load function)
// then show a CharacterView, with an animated named character
// tap the button to create a new character (update via character object on the model)
// tap the character to show an animation (pixi touch events)

export async function loadAssetsAndLaunch (parent) {
	// show a loading view to begin with
	let app = new App();
	app.setView(loadingView);
	
	const context = h.render(parent, app, appView);
	context.set('app', app);

	// load assets via pixi
	await hp.assets.loadSpritesheet('assets/backgrounds.json');
	const sprites = await hp.assets.loadSpritesheet('assets/sprites.json');
	sprites.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
		
	const game = new model.GameModel();
	app.setView(() => h.compose(game, () => { return characterView(game); }));
}

class App {
	constructor () {
		this.currentScene = null;
		this.currentView = null;
	}
		
	setView (view) {
		this.currentView = view;
		h.signal(this);
	}	
}

// loading view encapsulates all the elements of the loading scene inline
function appView (app) {
	return [
		// a layer for 2D canvas
		h.div({ class: 'layer' }, [
			h.div({ class: 'scene' }, [
				h.element('canvas', hp.pixi_canvas((c) => {
					// set logical sizing of the canvas when its created
					c.setLogicalSize(240, 480, 540);
				})),
			]),
		]),
		// a layer for dom elements
		h.div({ class: 'layer' }, [
			h.compose(app, app.currentView),
		]),
	];
}

function loadingView (model, context) {
	return h.div({ class: 'loading-ui' }, [
		hp.pixi_view([
			{ rect: 0x777777, x: 0, y: 0, width: 540, height: 480 },
			{ x: 10, y: 10, text: 'PIXI.js', align: 'left' },
		]),
		h.div(),
		h.div('Loading'),
	]);
}

function characterView(model) {
	return [
		hp.pixi_view(() => { return new scene.CharacterScene(model.character); }, model.character),
		h.div({ class: 'character-ui' }, [
			h.div(),
			h.div({ class: 'slug' }, model.character.name),
			h.div({ class: 'slug' }, model.character.role.name),
			h.div([
				h.button('Re-roll', h.listen('click', () => {
					model.actionCreateNewCharacter();
				})),
			]),
		]),			
	];
}