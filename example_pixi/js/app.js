// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

import * as model from './model.js';
import * as scene from './scene.js';

// show an HTML loading scene while loading assets, (async load function)
// then display a TitleView
// the title view has an HTML button and a canvas
// and a CharacterView inside, which shows an animated, named character
// tap the button to create a new character (update via character object on the model)
// tap the character to show an animation (pixi touch events)

export async function loadAssetsAndLaunch (parent) {
	// show a loading view to begin with
	const context = h.render(parent, {}, loadingView);

	// load assets via pixi
	await hp.assets.loadSpritesheet('assets/backgrounds.json');
	await hp.assets.loadSpritesheet('assets/sprites.json');
	
	
	// // after loading signal the game is ready
	// state.assetsAreLoaded = true;
	// state.game = new GameModel();
	// h.signal(state);
}

// loading view encapsulates all the elements of the loading scene inline
function loadingView () {
	return [
		// a layer for 2D canvas
		h.div({ class: 'layer' }, [
			h.div({ class: 'scene' }, [
				h.element('canvas', hp.pixi_canvas((c) => {
					// set logical sizing of the canvas when its created
					
				})),
			]),
		]),
		// can attach the pixi view anywhere, as long as the canvas is in the prior render context
		hp.pixi_view([
			{ rect: 0x777777, x: 10, y: 10, width: 320, height: 320 },
			{ x: 160, y: 40, text: 'PIXI.js', align: 'center' },
		]),
		// a layer for dom elements
		h.div({ class: 'layer' }, [
			h.div({ class: 'loading-ui' }, [
				h.div(),
				h.div('Loading'),
			]),
		]),		
	];
}

/*

export function view (state) {
	// a two layer system is used throughout, with a canvas layer and DOM ui
	// the pixi canvas is set in the context, and automatically targetted by any pixi scene
	return [
		h.div({ class: 'layer' }, [
			h.div({ class: 'scene' }, [
				h.element('canvas', hp.pixi_canvas()),
			]),
		]),
		h.div({ class: 'layer' }, [
			h.div({ class: 'scene' }, [
				state.assetsAreLoaded ?
					h.compose(state.game, gameView) :
					loadingView
			]),
		]),
	];
}


function gameView (game) {
	return [
		hp.pixi_node(() => { return new scene.CharacterScene(game.character); }, game.character),
		h.div({ class: 'character-ui' }, [
			h.div(),
			h.div({ class: 'slug' }, game.character.name),
			h.div({ class: 'slug' }, game.character.role.name),
			h.div([
				h.button('Re-roll', h.listen('click', () => {
					game.actionCreateNewCharacter();
				})),
			]),
		]),
	];
}

// -- model -----------------------------------------------------------

*/