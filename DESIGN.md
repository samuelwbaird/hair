# hair design notes

These notes capture the core design decisions behind hair, as a reference for the README rewrite and for bug fixes. They describe the HTML rendering model in `hair.js`. The tween and PIXI modules build on the same core.

## Flavour and scope

hair is for small applications with a long-lived, mutable model: tools, games, simulations, single-page utilities. It is not aimed at large codebases, large data sets, or teams that want the conventions of mainstream frameworks.

It keeps one benefit of modern frameworks, which is composable view code where the same code both creates and updates the DOM. It approaches state differently:

 * State lives in a **separate model** of ordinary JS objects, not inside components.
 * The view is mostly a function of that model.
 * Transient interaction state belongs to the view: the compose region's context and the DOM objects themselves.

When a choice comes up, prefer the one that is simple to explain and keeps that flavour clear over the one that is more general or faster at scale.

## Packaging

 * hair is a single project. The separate hair-mini project is retired.
 * `hair.js` consolidates core and HTML rendering into one file, so it also serves as the single-file, no-build version.
 * Optional modules (model, forms, tween, PIXI) stay separate, and import `hair.js`.

## Layers of state

| Layer | Holds | Examples | Lifetime |
|---|---|---|---|
| Model | Logical state: what would be saved or live on a server | todo items, quiz questions, game entities | As long as the app keeps the objects |
| Compose region (context + DOM) | Transient view state for one model object | selected tab, scroll position, focus, a partly typed input, an animation in progress | As long as that object is composed at that point in the view |
| Spec | Nothing persistent: rebuilt on every render | the output of view functions | One render |

"Model" means whatever object a compose region renders. That might be a data model, or an object shaped for the view. Real systems have many such layers and hair doesn't need to distinguish them. It only requires that the object **persists** and **signals**.

## The model contract

 * **Objects persist and identity matters.** The view attaches to model objects by identity, so update objects in place rather than replacing them. Identity is what makes `watch` / `signal` possible: you can only watch something that persists. It is the link between a separate model and an efficient view, not an optimisation detail.
 * **Objects signal their own changes.** An object signals when anything visible through it changes. If a parent's view depends on a child's state (eg. a count of completed items), the model also signals the parent. Keeping that dependency in the model is a deliberate choice.
 * **Fresh data is merged into the model, not handed to the view.** Data that arrives as new objects (eg. JSON from the network) is merged into existing model objects, matching on an id, so identity is preserved. `merge` in `hair.model.js` does this (see Merging data below). The merge is also the natural place to signal the objects that changed.

## Specs: functions, arrays and elements

Element functions (`div`, `p`, ... from `elements`), arrays and plain functions only **build the specification**. A function component has no lifecycle, identity, context or watch of its own. It runs inside whichever compose region includes it, and shares that region's context. Calling a function inline or passing it by reference only changes which state it receives.

How values in a spec render:

 * Strings and numbers render as text, including `0` and `''`.
 * `null` and `undefined` render nothing.
 * `true` and `false` are **reserved**. They don't render as text. Specs shouldn't rely on them rendering nothing either, because they may be given a meaning later.

## Compose boundaries

`compose(state, view)` is the real unit of encapsulation:

 * It binds a region of the view to one model object.
 * It watches that object, and re-renders the region when the object signals.
 * It owns a RenderContext holding the region's transient state and DOM references.
 * It is reused across renders while the same object is composed at the same point. When the object is replaced, the region and its transient state are discarded and rebuilt.
 * **The state object is always its key.** Compose regions don't accept other reuse keys. Forcing a different identity, or a rebuild, would work against the model being the identity. A new rendering of the region comes from a new object.

`compose` always passes its state through whole, whatever its type. An array, Map or iterable model given to `compose` is watched and rendered as one object.

Lists are explicit. `composeEach(items, view)` creates the same compose boundary once per item: each item is watched, has its own context, and is matched to its region by identity. Only `composeEach` iterates, and only over the collection it was given, so items that are themselves iterable (Map entries, tuples) are passed through whole. What a call does follows from the function called, not from the type of the state.

For `composeEach` the identity that matters is each item's, not the collection's. The list's own region is matched by position, so the model can replace the collection (eg. with `filter`) and existing items keep their regions and DOM.

Regions for the same object in the same parent element are matched in order. That's rarely a problem, and wrapping each in its own element fixes it.

## Re-render semantics

**A signal re-renders from that compose region downwards, including all composed children**, whether or not the children's own objects signalled.

 * Child views often depend on parent state their own object doesn't hold, eg. `model.selectedItem === item`, filter or edit modes, or position in a list. Skipping unsignalled children would leave those views stale.
 * Rendering too much costs CPU that is rarely noticeable at the intended scale. Rendering too little shows stale UI and is hard to diagnose. hair picks the failure you can't see.
 * Because only props whose spec values changed are written (see DOM ownership), re-rendering an unchanged child costs building its spec plus a few comparisons, with almost no DOM writes.

The mental model has two parts:

 * **A signal picks the top of the re-render:** "something visible from here down changed".
 * **`compose` picks the granularity:** where a narrower signal can give a cheap local update.

To avoid broad re-renders, give the frequently changing part its own object and compose boundary (eg. `model.summary`), and signal just that object.

If a region and one of its descendants are both signalled in the same frame, the outer re-render covers the inner one, and the inner one does not render again.

An opt-in isolated compose (skip re-render unless its own object signals) is possible later, but is not planned.

## Context

Each compose region's RenderContext holds that region's transient state:

 * **Values and refs share one map.** `context_id` refs and `set` / `get` values live in the same map. `get` looks up through outer contexts, so a ref or value set in an outer region is visible to the regions inside it. Nothing is written as a property on the context object.
 * **A context can be signalled.** Signalling a context re-renders its region on the next frame, with the same consolidation as model signals. The view is then explicitly a function of (state, context), scoped to the compose boundary.
 * **`context.set(name, value, signal = false)`.** Setting a value does not signal by default. Most values are set during or just after a render, and signalling there would be circular or cause a second render. Pass `true` when the change should update the view, eg. `context.set('tab', name, true)`.
 * Simple transient state can instead stay entirely on the DOM, managed by listeners, with no re-render.
 * **Inner regions reach outer ones through the model or the context**, not through events going up. An outer region sets a callback with `context.set`, and inner regions call it with `context.get`. There is deliberately no `broadcastUp`: it would be a third way to do the same thing, and events going up are hard to follow.

## Merging data

`merge` in the optional `hair.model.js` brings fresh data into the model without replacing its objects. It doesn't impose a way of structuring the model, it only preserves identity:

 * **Identity is kept everywhere.** Matched objects are merged into, and arrays are updated in place, so watchers and compose regions stay attached. New objects come from `create(data, key, parent)`, so a model made of classes stays made of classes. `create` owns the subtree of the data it receives.
 * **Merging only adds and updates by default.** Properties missing from the source are never removed. Arrays only lose items or change order with `arrays: 'match'`, which declares that the source arrays are complete lists. `arrays` is a string, leaving room for other ways of ordering merged arrays later.
 * **Arrays of objects are matched by id, everything else is compared as values.** Matching objects without ids by position is easy to get wrong, so those arrays are replaced when they differ.
 * **Signals are sent once, after the merge.** Watchers never see a half-merged model, and only objects that actually changed are signalled. Dependencies beyond the changed objects stay the model's job, helped by the boolean result.
 * **Deliberately left out:** a hook for removed items, and automatic signalling through proxies. Removed items may be referenced elsewhere, and cleaning them up is the model's decision. Proxies would change object identity, and break private fields.

## Forms

Form binding is an optional module, `hair.forms.js`, because it's a convenience built on context listeners rather than part of rendering:

 * **`bind(object)` owns the values of the controls it binds.** That follows the one-owner rule, so the spec doesn't also set `value` or `checked`. Like the property handlers, it writes a control only when the object's value has changed since it was last written or read.
 * **Bind a draft, not the model.** A form's values are transient view state until they are submitted. Binding a draft object, and copying it into the model on submit, keeps partial edits out of the model.
 * **Signalling is a choice per form.** With `{ signal: true }`, every change re-renders the views of the draft, for live validation or previews. Without it, nothing re-renders while the user types.
 * **A new object is a new binding.** The object is the binding's key, so giving `bind` a fresh draft resets the form.
 * Deliberately limited to single-value controls. Multiple selects, file inputs and groups of checkboxes sharing a name are left to listeners.

## DOM ownership

The DOM is shared between hair and the developer's own code. That is only safe with clear rules:

 * **hair writes only what the spec changed.** A prop is written when its spec value differs from the previous render's spec. Props that disappear from the spec are reset to their default. Anything the spec didn't change is left alone. The comparison is against the previous spec, not against the DOM.
 * **Each property has one owner.** A given property (a class, a style, `value`, ...) is set either by the spec or by the developer's DOM code, never both.
 * **Transient DOM state lives as long as the node.** A node survives while its compose region survives and it is matched to the same element in that region's spec. Moving elements is avoided where possible, because moves lose focus and restart animations.
 * **Elements can have reuse keys.** By default, elements within a region are matched by position. An element given a `key(...)` argument is matched by that key instead. Use it when an element's position in the spec isn't stable but its DOM state should follow it.

## Keys

`key(...values)` is the one mechanism for reuse keys, used by elements and by context listeners (and integrations such as PIXI views):

 * **Something created with a key is only reused by a later render with an equal key.** Values are compared in order, by identity. Without a key, things are reused in the order they are rendered.
 * For an element this gives **identity** among its siblings. For a listener it gives **invalidation**: the listener is created again when the key's values change. Both come from the same rule.
 * A key is a tagged value rather than a positional argument or a property. Element arguments are identified by type in any order, so a key has to identify itself. Keeping it out of the property object means properties only hold things applied to the element.
 * Nothing else acts as a hidden key. `id` and `context_id` don't affect matching, and a reused element given a new `context_id` simply moves its reference to the new name.
 * Compose regions don't take keys. Their state object is always their key.

## Properties: JS naming throughout

Element props are **JS properties at all times**, never HTML attribute names. For example `ariaExpanded` not `aria-expanded`, `htmlFor` not `for`, `tabIndex` not `tabindex`. One rule, with no switching between JS and HTML naming. Attribute behaviour is opt-in through the `dataset` and `attributes` handlers.

What this rule needs:

 * **Resetting removed props.** Without attributes there is no "remove". The default for a prop is the value from a fresh element of the same type (`document.createElement(type)[key]`), cached per type. Setting `null` is not safe: string props such as `title` become `"null"`.
 * **A `dataset` handler.** `element.dataset` can't be assigned, so `dataset: { state: 'open' }` is merged in the way `style` is. That keeps `[data-state=open]` CSS selectors available while staying in JS naming.
 * **An explicit `attributes` handler as the escape hatch** for things that have no writable property:
   * SVG geometry (properties are `SVGAnimated*` objects)
   * read-only properties such as `input.list` and `button.form`
   * ARIA element references (`aria-describedby` and similar take ids as attributes, but their properties take elements)
   * custom elements that only observe attributes

   An explicit handler keeps the rule clear ("everything is JS, except inside `attributes`"), rather than guessing from the name.
 * Modern browsers all reflect the `aria*` string properties and `role`. Firefox has done so since version 119 (late 2023).

## Timers and frames

 * Signal-driven re-renders, `delay`, `timer`, `wait` and frame callbacks all run on `requestAnimationFrame`, and frames are only requested when something is scheduled. This suits games and animation. The cost is that everything pauses in background tabs. This should be documented, not hidden.
 * Callbacks are owned. Timers and listeners belong to a context or attachment, and are cancelled or ignored when it is disposed.
 * Callbacks run first-in-first-out. An exception in one callback, or in one region's render, must not stop other callbacks or leave a region permanently un-watched.