// hair.js - MIT license, copyright 2024 Samuel Baird
// ====================================================================================

// combine and export functions from all component libs

import * as core from './hair.core.js';
import * as html from './hair.html.js';
import * as tween_lib from './hair.tween.js';

// -- core functions ------------------------------------

export const watch = core.watch;
export const signal = core.signal;
export const removeWatcher = core.removeWatcher;

export const delay = core.delay;
export const timer = core.timer;
export const onNextFrame = core.onNextFrame;
export const onEveryFrame = core.onEveryFrame;
export const onAnyFrame = core.onAnyFrame;
export const cancel = core.cancel;

export const markObjectAsDisposed = core.markObjectAsDisposed;
export const isObjectDisposed = core.isObjectDisposed;

// -- html functions ------------------------------------

export const render = html.render;
export const element = html.element;
export const compose = html.compose;

export const listen = html.listen;
export const onAttach = html.onAttach;
export const onRemove = html.onRemove;
export const onUpdate = html.onUpdate;
export const onBroadcast = html.onBroadcast;
export const onDelay = html.onDelay;
export const onTimer = html.onTimer;
export const onFrame = html.onFrame;
export const onContext = html.onContext;

export const elementFactory = html.elementFactory;
export const setPropertyHandler = html.setPropertyHandler;

// create some common element tags for convenience
export const div = html.elementFactory('div');

export const h1 = html.elementFactory('h1');
export const h2 = html.elementFactory('h2');
export const h3 = html.elementFactory('h3');
export const h4 = html.elementFactory('h4');
export const h5 = html.elementFactory('h5');

export const p = html.elementFactory('p');
export const span = html.elementFactory('span');
export const b = html.elementFactory('b');
export const i = html.elementFactory('i');
export const em = html.elementFactory('em');
export const small = html.elementFactory('small');
export const u = html.elementFactory('u');
export const strike = html.elementFactory('strike');
export const strong = html.elementFactory('strong');
export const br = html.elementFactory('br');
export const hr = html.elementFactory('hr');

export const a = html.elementFactory('a');
export const img = html.elementFactory('img');

export const ol = html.elementFactory('ol');
export const ul = html.elementFactory('ul');
export const li = html.elementFactory('li');

export const form = html.elementFactory('form');
export const option = html.elementFactory('option');
export const button = html.elementFactory('button');
export const input = html.elementFactory('input');
export const label = html.elementFactory('label');

export const table = html.elementFactory('table');
export const tr = html.elementFactory('tr');
export const th = html.elementFactory('th');
export const td = html.elementFactory('td');

// -- tween functions ------------------------------------

export const tween = tween_lib.tween;
export const asyncTween = tween_lib.asyncTween;
export const cancelTweensOf = tween_lib.cancelTweensOf;

export const linear = tween_lib.linear;
export const easeIn = tween_lib.easeIn;
export const easeOut = tween_lib.easeOut;
export const easeInOut = tween_lib.easeInOut;
export const interpolate = tween_lib.interpolate;

export const transform = tween_lib.transform;




