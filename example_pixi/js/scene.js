import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

export class LoadingScene extends hp.PixiScene {

	begin () {
		console.log('LoadingScene::begin');
		// tween a loading indicator
	}
		
}


export class CharacterScene extends hp.PixiScene {
	
	constructor (character) {
		super();
		this.character = character;
	}
	
	begin () {
		console.log('CharacterScene::begin', this.character.name);		
		// create the background
		
		// add the character and set the animation
		
		
		// register a touch handler to animate on tap
	}
	
	update (delta) {
		// reset the screen alignment or centering against logical size
		// 
		
	}
	
}