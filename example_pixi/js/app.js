// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';
import * as ht from '../../hair.tween.js';
import * as hp from '../../hair.pixi.js';

import * as scene from './scene.js';

// show an HTML loading scene while loading assets, (async load function)
// then display a TitleView
// the title view has an HTML button and a canvas
// and a CharacterView inside, which shows an animated, named character
// tap the button to create a new character (update via character object on the model)
// tap the character to show an animation (pixi touch events)

export const state = {
	assetsAreLoaded: false,
	game: null,
};

export async function loadAssetsAndLaunch () {
	// load assets via pixi
	await hp.assets.loadSpritesheet('assets/backgrounds.json');
	await hp.assets.loadSpritesheet('assets/sprites.json');

	// after loading signal the game is ready
	state.assetsAreLoaded = true;
	state.game = new GameModel();
	h.signal(state);
}

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

function loadingView () {
	return [
		hp.pixi_scene(() => { return new scene.LoadingScene(); }),
		h.div({ class: 'loading-ui' }, [
			h.div(),
			h.div('Loading'),
		]),
	];
}

function gameView (game) {
	return [
		hp.pixi_scene(() => { return new scene.CharacterScene(game.character); }, game.character),
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

class GameModel {
	constructor () {
		this.character = new CharacterModel();
	}

	actionCreateNewCharacter () {
		this.character = new CharacterModel();
		h.signal(this);
	}
}

const firstNames = [ 'Mariana', 'Nettie', 'Jane', 'Belinda', 'Farrell', 'Elinore', 'Bradley', 'Elwin', 'Cono', 'Peggyann', 'Bess', 'Arvilla', 'Cecelia', 'Annamae', 'Attilio', 'Marylin', 'Leanne', 'Christine', 'Wendell', 'Abner', 'Lillyan', 'Miriam', 'Elayne', 'Abbie', 'Nestor', 'Laverne', 'Golda', 'Alberto', 'Patricia', 'Coral', 'Sheilah', 'Rupert', 'Dirk', 'Waneta', 'Emery', 'Bertha', 'Delano', 'Vincent', 'Stillman', 'Howard', 'Bonita', 'Ricardo', 'Stephania', 'Tess', 'Luz', 'Merlyn', 'Cedric', 'Zena', 'Enzo', 'Angeline', 'Stacia', 'Isadore', 'Allan', 'Ian', 'Wallace', 'Marcy', 'Jill', 'Joesph', 'Galen', 'Leontine', 'Serge', 'Retha', 'Giuseppe', 'Tillie', 'Monroe', 'Bunny', 'Beatrix', 'Freeman', 'Rina', 'Bettina', 'Jeri', 'Deirdre', 'Nadine', 'Debora', 'Winnifred', 'Rosemond', 'Portia', 'Noreen', 'Arlene', 'Marillyn', 'Selma', 'Benton', 'Antoinette', 'Valeria', 'Lonny', 'Julia', 'Ed', 'Natalina', 'Phylis', 'Leticia', 'Dolores', 'Karolyn', 'Glendon', 'Eli', 'Meredith', 'Erwin', 'Matt', 'Burr', 'Rita', 'Mayme', 'Barrie', 'Mervyn', 'Lucille', 'Enrique', 'Harvard', 'Alyce', 'Michael', 'Heinz', 'Peggy', 'Sabina', 'Fredericka', 'Mabel', 'Andy', 'Carroll', 'Thea', 'Ophelia', 'Freda', 'Joann', 'Bettylou', 'Vina', 'Sonia', 'Tema', 'Giovanni', 'Onofrio', 'Armand', 'Waverly', 'Carolann', 'Carmella', 'Pasquale', 'Ella', 'Ernestine', 'Erma', 'Seward', 'Patrick', 'Lorna', 'Ernie', 'Tobias', 'Sammy', 'Tania', 'Evalyn', 'Lulu', 'Archer', 'Harrison', 'Dawne', 'Pincus', 'Pearl', 'Gustaf', 'Harriett', 'Harlene', 'Roma', 'Sandra', 'Vinnie', 'Niels', 'Cortland', 'Eveline', 'Leland', 'Seymore', 'Marie', 'Wilfrid', 'Bridget', 'Harry', 'Calvin', 'Sinclair', 'Donna', 'Harriet', 'Leander', 'Dina', 'Alvah', 'Dinah', 'Gaetano', 'Myrtle', 'Archibald', 'Harvey', 'Winfred', 'Elisa', 'Gaston', 'Sven', 'Florette', 'Madeleine', 'Caryl', 'Tracy', 'Americo', 'Bertil', 'Antionette', 'Clark', 'Domenick', 'Grover', 'Julian', 'Plato', 'Olga', 'Edith', 'Aram', 'Maud', 'Lucien', 'Leonora', 'Lucretia', 'Terrence', 'Maxine', 'Denyse', 'Millard', 'Irving', 'Sheila', 'Florine', 'Larue', 'Philomena', 'Marshall', 'Jess', 'Moses', 'Doris', 'Newton', 'Majorie', 'Chauncey', 'Alexandra', 'Naomi', 'Emilia', 'Bruce', 'Stephanie', 'Trevor', 'Anibal', 'Eloise', 'Earl', 'Pierina', 'Laraine', 'Ismay', 'Bryan', 'Leonore', 'Harold', 'Phoebe', 'Adam', 'Sonja', 'Athena', 'Leona', 'Stella', 'Andre', 'Hope', 'Francesco', 'Dorotha', 'Lino', 'Maryanna', 'Rae', 'Evangeline', 'Rocco', 'Marc', 'Abbey', 'Marjorie', 'Frieda', 'Joni', 'Billie', 'Amos', 'Alan', 'Genevieve', 'Lana', 'Stewart', 'Loren', 'Maryellen', 'Luisa', 'Ceil', 'Annamarie', 'Rosary', 'Lillie', 'Byron', 'Suzann', 'Stephany', 'Lolita', 'Carmelo', 'Georgette', 'Roslyn', 'Flossie', 'Bea', 'Joyce', 'Jerry', 'Grant', 'Theo', 'Gale', 'Wilfred', 'Grayce', 'Rosalind', 'Ben', 'Isabelle', 'Abbott', 'Clorinda', 'Bayard', 'Minerva', 'Vivien', 'Maryetta', 'Meryl', 'Melvyn', 'Eugene', 'Erik', 'Heather', 'Juliet', 'Arden', 'Gaspar', 'Penny', 'Isidore', 'Elwyn', 'Willy', 'John', 'Roscoe', 'Pansy', 'Dewey', 'Carmin', 'Ivar', 'Althea', 'Emily', 'Danielle', 'Vernal', 'Marvin', 'Armen', 'Elisha', 'Billy', 'Claire', 'Leonard', 'Isidor', 'Laurene', 'Fredda', 'Oswald', 'Reina', 'Belle', 'Herman', 'Renee', 'Derek', 'Glenford', 'Velma', 'Carrie', 'Lucinda', 'Tamara', 'Suzette', 'Ward', 'Melinda', 'Alexander', 'Theodora', 'Marilynn', 'Russel', 'Alois', 'Thomas', 'Francine', 'Carolynn', 'Filippa', 'Susanna', 'Elden', 'Elvina', 'Merry', 'Milagros', 'Cindy', 'Clement', 'Abigail', 'Star', 'Eldred', 'Anson', 'Ethan', 'Steve', 'Wilhelmina', 'Gerry', 'Stephen', 'Philander', 'Abel', 'Hilda', 'Shirley', 'Eleonore', 'Nancy', 'Camille', 'Rosella', 'Lanny', 'Michelle', 'Anselmo', 'Gene', 'Raquel', 'Clive', 'Sharon' ];
const lastNames = [ 'Childers', 'Gooden', 'Wall', 'Guerrero', 'Seymour', 'Byrnes', 'Wagoner', 'Saavedra', 'Barlow', 'Kilpatrick', 'Gamez', 'Spencer', 'Chavarria', 'Wills', 'Cagle', 'Stewart', 'Alarcon', 'Yates', 'Robins', 'Obrien', 'Guidry', 'McDermott', 'Harwood', 'Cazares', 'Starkey', 'Sun', 'Maxwell', 'Nance', 'Collins', 'Cummings', 'Curran', 'Foley', 'Bynum', 'Watts', 'Kang', 'Head', 'McCracken', 'Arrington', 'Bower', 'Knight', 'Caballero', 'Braswell', 'Hawk', 'Mejia', 'Messina', 'Brownlee', 'Dailey', 'Barger', 'Francisco', 'Haney', 'Abraham', 'Gilliam', 'Spaulding', 'Kraus', 'Peralta', 'Stallings', 'Byrd', 'Kearns', 'Spears', 'Thurston', 'Daily', 'Champagne', 'Blue', 'Stevens', 'Hood', 'Boyce', 'Long', 'Ledesma', 'Hummel', 'Matson', 'Coe', 'Hoang', 'Minton', 'Lawson', 'Sanford', 'Emery', 'Grissom', 'Samuels', 'Hyatt', 'Edgar', 'Stack', 'Staples', 'Albrecht', 'Le', 'Humphrey', 'Andrew', 'Zepeda', 'Wiles', 'Alves', 'McMahan', 'Brock', 'Killian', 'Gregg', 'Thomas', 'Tirado', 'Morrell', 'Reaves', 'Valerio', 'Bacon', 'Walls', 'Foss', 'Phelan', 'Gallegos', 'Dickens', 'Winter', 'Caron', 'Davila', 'Crook', 'Todd', 'Compton', 'Rushing', 'Parrish', 'Posey', 'Gunn', 'Crabtree', 'Knowles', 'Thorne', 'Maurer', 'Cheney', 'Mireles', 'Power', 'Dietrich', 'Gordon', 'Zhou', 'Baumgartner', 'Connor', 'Duckworth', 'Conner', 'Deluca', 'Whitfield', 'Ma', 'Waters', 'Neff', 'Jansen', 'Broderick', 'Schaeffer', 'Blakely', 'Cox', 'Waller', 'Hunter', 'Trammell', 'Rico', 'Roberson', 'Cooper', 'Lynn', 'Parent', 'Ceja', 'Mace', 'Springer', 'Knox', 'Burleson', 'Riddle', 'Lenz', 'Trevino', 'Presley', 'Tabor', 'Bassett', 'Paris', 'Rock', 'Vela', 'Elias', 'Murillo', 'Cobb', 'Kuhn', 'Demarco', 'Bigelow', 'Hardwick', 'Pressley', 'Waldrop', 'McClain', 'Christopher', 'Solomon', 'Cordova', 'Schumacher', 'Gonzalez', 'Sauer', 'Edmonds', 'Vanhorn', 'Oswald', 'Roland', 'Morton', 'Schafer', 'Nunes', 'Jack', 'Carrington', 'Espino', 'McIntosh', 'Ewing', 'Aponte', 'Choate', 'Holder', 'McRae', 'Fournier', 'Houghton', 'Stubbs', 'Vernon', 'Schmid', 'Weathers', 'Burgos', 'Wilkes', 'Fortner', 'Chaney', 'Brockman', 'Benton', 'Duncan', 'Barney', 'Deal', 'Stanton', 'Mathews', 'Mohr', 'Creech', 'Law', 'Ponder', 'Burnette', 'Portillo', 'Shell', 'Lamb', 'Fine', 'Girard', 'Chow', 'Aldrich', 'Whitt', 'Coleman', 'Valadez', 'Hopkins', 'Magana', 'Dotson', 'Dial', 'Grimm', 'Kozlowski', 'Boston', 'Robles', 'Boykin', 'Hewitt', 'Barnett', 'Gentile', 'Oglesby', 'Paz', 'Wahl', 'Nolan', 'Lyle', 'Faulk', 'Grimes', 'Herron', 'Cooke', 'Crockett', 'Blum', 'Cason', 'Robert', 'Fox', 'Cheatham', 'Brubaker', 'Gossett', 'Bond', 'Blalock', 'Fritz', 'Starnes', 'Breen', 'Gee', 'Roberts', 'Weaver', 'McIntire', 'Nieves', 'Chappell', 'Holm', 'Wilcox', 'Hook', 'Holmes', 'Connors', 'Mayes', 'Link', 'Mullin', 'Escamilla', 'Scott', 'Simms', 'Perrin', 'Crosby', 'Lockwood', 'Trejo', 'Marshall', 'Rios', 'Pederson', 'Godfrey', 'Irwin', 'Krieger', 'Avery', 'Butts', 'Newby', 'Cuevas', 'Shepard', 'Millard', 'Montoya', 'Oneill', 'Wu', 'Tapia', 'Naylor', 'Noriega', 'Buckley', 'Pagan', 'Casillas', 'Fajardo', 'Davidson', 'Orellana', 'Tackett', 'Quiroz', 'Moss', 'Higginbotham', 'Randolph', 'Lozano', 'Dowdy', 'Fabian', 'Burkholder', 'Storey', 'Schaefer', 'Rains', 'Park', 'Erwin', 'Fitzgerald', 'High', 'Riggins', 'Dennison', 'Trujillo', 'Escalante', 'Dowd', 'Hughes', 'Case', 'Whitney', 'McCall', 'Drummond', 'Overstreet', 'Giles', 'Schuler', 'Arce', 'Victor', 'Rivera', 'Shaver', 'Harrington', 'Windham', 'Comstock', 'Lujan', 'Napier', 'Bruns', 'Lusk', 'Agee', 'Loyd', 'Muse', 'Marlow', 'Redding', 'Robertson', 'Stockton', 'Weston', 'Mackenzie', 'Dean', 'Collier', 'Carter', 'Ledford', 'Conrad', 'Newcomb', 'Liang', 'Ricks', 'Bolin', 'Macias', 'Swan', 'McKenzie', 'Connell', 'Costa', 'Franks', 'Meier', 'Tellez', 'Holden', 'Collazo', 'Samson', 'Rich', 'Santana', 'Stringer' ];
const roles = [
	{ name: 'Fighter', sprite:'woodcutter' },
	{ name: 'Paladin', sprite:'woodcutter' },
	{ name: 'Druid', sprite:'woodcutter' },
	{ name: 'Ranger', sprite:'graverobber' },
	{ name: 'Thaumaturge', sprite:'graverobber'} ,
	{ name: 'Wizard', sprite:'steamman' },
	{ name: 'Cleric', sprite:'steamman' },
	{ name: 'Warden', sprite:'steamman' },
];

function takeOne (list) {
	return list[Math.floor(Math.random() * list.length)];
}

class CharacterModel {
	// construct a random character each time
	constructor () {
		this.name = takeOne(firstNames) + ' ' + takeOne(lastNames);
		this.role = takeOne(roles);
	}
}