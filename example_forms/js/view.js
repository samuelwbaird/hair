// reference the hair library, and two way binding of form controls to an object
import * as h from '../../hair.js';
import { bind } from '../../hair.forms.js';

const { h1, h2, div, p, ul, li, span, form, label, input, button } = h.elements;

/** top level view, the saved accounts, then a form to edit an account, and a form to create one */
export default function appView (model, context) {
	return [
		h1('Accounts'),
		ul({ class: 'accounts' }, h.composeEach(model.accounts, (account) => accountRow(account, context))),
		editAccount,
		createAccount,
	];
}

function accountRow (account, appContext) {
	return li([
		span(account.name, { class: 'name' }),
		span(account.email, { class: 'email' }),
		span(account.plan),
		account.newsletter ? span('newsletter') : null,
		button('Edit', h.listen('click', () => {
			// editing is transient view state, held in the context of the app view, not in the model
			appContext.set('editing', { account, draft: accountDraft(account) }, true);
		})),
	]);
}

// -- editing an account, not signalling ------------------------------------------
// the draft is bound without signalling, so nothing re-renders while typing
// nothing shows the draft, and the list keeps showing the saved account until the draft is saved

function editAccount (model, context) {
	const editing = context.get('editing');
	if (!editing) {
		return null;
	}
	return div({ class: 'panel' }, [
		h2('Edit ' + editing.account.name),
		p('Changes are kept in a draft, the list above only changes when you save.', { class: 'note' }),
		form(bind(editing.draft), [
			accountFields(),
			button('Save', { type: 'submit' }),
			button('Cancel', { type: 'button' }, h.listen('click', () => {
				context.set('editing', null, true);
			})),
			h.listen('submit', (formContext, element, event) => {
				event.preventDefault();
				editing.account.update(editing.draft);
				context.set('editing', null, true);
			}),
		]),
	]);
}

// -- creating an account, signalling -----------------------------------------------
// the draft is bound with signalling, so the form re-renders as the user types
// showing live validation, and enabling the button once the draft is valid

function createAccount (model, context) {
	// keep the draft in the context, set during render, so without signalling
	let draft = context.get('newAccount');
	if (!draft) {
		draft = accountDraft();
		context.set('newAccount', draft);
	}

	return h.compose(draft, (draft) => {
		const problems = accountProblems(draft);
		return div({ class: 'panel' }, [
			h2('Create an account'),
			p('This form checks the draft as you type.', { class: 'note' }),
			form(bind(draft, { signal: true }), [
				accountFields(),
				ul({ class: 'problems' }, problems.map((problem) => li(problem))),
				button('Create account', { type: 'submit', disabled: problems.length > 0 }),
				h.listen('submit', (formContext, element, event) => {
					event.preventDefault();
					model.addAccount(draft);
					// a new draft creates a new binding, clearing the form
					context.set('newAccount', accountDraft(), true);
				}),
			]),
		]);
	});
}

// -- shared ----------------------------------------------------------------------

// form controls are matched to properties of the draft by name
function accountFields () {
	return [
		label(['Name', input({ name: 'name' })]),
		label(['Email', input({ name: 'email', type: 'email' })]),
		label(['Age', input({ name: 'age', type: 'number', min: 0 })]),
		div({ class: 'choices' }, [
			'Plan ',
			label([input({ name: 'plan', type: 'radio', value: 'free' }), ' Free']),
			label([input({ name: 'plan', type: 'radio', value: 'pro' }), ' Pro']),
		]),
		label([input({ name: 'newsletter', type: 'checkbox' }), ' Send me the newsletter']),
	];
}

// a plain object holding the values of the form, optionally copied from an account
function accountDraft (account = null) {
	return {
		name: account?.name ?? '',
		email: account?.email ?? '',
		age: account?.age ?? null,
		plan: account?.plan ?? null,
		newsletter: account?.newsletter ?? false,
	};
}

function accountProblems (draft) {
	const problems = [];
	if (draft.name.trim() == '') {
		problems.push('Enter a name');
	}
	if (!draft.email.includes('@')) {
		problems.push('Enter an email address');
	}
	if (draft.age == null || draft.age < 13) {
		problems.push('Enter an age of 13 or over');
	}
	if (draft.plan == null) {
		problems.push('Choose a plan');
	}
	return problems;
}
