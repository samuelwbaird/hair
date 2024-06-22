import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

export class LoadingScene extends hp.PixiScene {

	begin () {
		console.log('LoadingScene::begin');
	}
	
	
}


export class CharacterScene extends hp.PixiScene {
	
	constructor (character) {
		super();
		this.character = character;
	}
	
	begin () {
		console.log('CharacterScene::begin', this.character.name);
	}
	
}