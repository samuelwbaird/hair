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
		
		// create the background
		this.view.create([
			{ x: 0, y: 320, scaleX: 3.2, scaleY: 1, sprite: 'green_gradient', id: 'gradient' },
			{ x: 0, y: 0, sprite: 'background_ruins' },
		]);
		this.prepare();
		
		// add the character and set the animation
		this.view.create([
			{ x: 30, y: 340, clip: this.character.idleAnimation(), scale: 4, id: 'character', loop: true },
		])
		
		// register a touch handler to animate on tap
		this.delay(Math.random() * 3, () => { this.randomAnimation(); });
	}
	
	randomAnimation () {
		this.view.character.play(this.character.randomAnimation(), () => {
			this.view.character.play(this.character.idleAnimation(), true);
			this.delay(Math.random() * 3, () => { this.randomAnimation(); });
		});
	}
	
	// runs ahead of any frame render
	prepare () {
		// align this view with the center of the screen
		this.view.x = this.context.get('screenWidth') * 0.5;
		this.view.gradient.scale.x = this.context.get('screenWidth') / 50;
		this.view.gradient.scale.y = (this.context.get('screenHeight') - 320) / 50;
		
	}
	
}