import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

export class CharacterScene extends hp.PixiNode {
	
	constructor (character) {
		super();
		this.character = character;
	}
	
	begin () {
		super.begin();
		console.log('CharacterScene::begin', this.character.name);		
		// create the background
		this.view.create([
			{ x: 160, y: 160, scaleX: 3.2, scaleY: 1, sprite: 'green_gradient' },
			{ x: 160, y: -160, sprite: 'background_ruins' },
		]);
		// add the character and set the animation
		
		
		// register a touch handler to animate on tap
	}
	
	update (delta) {
		// reset the screen alignment or centering against logical size
		// 
		
	}
	
}