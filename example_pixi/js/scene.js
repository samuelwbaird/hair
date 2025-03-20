import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

export class CharacterScene extends hp.PixiView {
	
	constructor (character) {
		super();
		this.character = character;
	}
	
	begin () {
		super.begin();
		
		// create the background
		this.create([
			{ x: 0, y: 320, scaleX: 3.2, scaleY: 1, sprite: 'green_gradient', id: 'gradient' },
			{ x: 0, y: 0, sprite: 'background_ruins' },
		]);
		this.prepare();
		
		// add the character and set the animation
		this.create([
			{ x: 30, y: 340, clip: this.character.idleAnimation(), scale: 4, id: 'character_clip', loop: true },
		])
		
		// set up an async coroutine fiber to play animations
		this.schedule((fiber) => { this.showRandomAnimations(fiber); });
	}
	
	// runs ahead of any frame render
	prepare () {
		// align this view with the center of the screen
		this.x = this.pixi_canvas.width * 0.5;
		this.gradient.scale.x = (this.pixi_canvas.width / 50);
		this.gradient.scale.y = (this.pixi_canvas.height - 320) / 50;		
	}
	
	async showRandomAnimations (fiber) {
		while (true) {
			// random delay
			await fiber.wait(1 + Math.random() * 4);
			// then an animation
			this.triggerRandomAnimation();
		}
	}
	
	triggerRandomAnimation () {
		// play a random animation, then revert to idle
		this.character_clip.play(this.character.randomAnimation(), () => {
			this.character_clip.play(this.character.idleAnimation(), true);
		});
	}
	
}