// reference the hair library to hook into the signal/watch mechanism
import * as h from '../../hair.js';

/** The model is the list of saved accounts, forms edit drafts and only change the model when submitted */
export default class AccountsModel {
	constructor () {
		this.accounts = [];
	}

	addAccount (details) {
		const account = new Account(details);
		this.accounts.push(account);
		h.signal(this);
		return account;
	}
}

class Account {
	constructor (details) {
		this.update(details);
	}

	// copy the details in, so the draft used by a form is never part of the model
	update (details) {
		this.name = details.name;
		this.email = details.email;
		this.age = details.age;
		this.plan = details.plan;
		this.newsletter = details.newsletter;
		h.signal(this);
	}
}
