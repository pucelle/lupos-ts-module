type EventCategory = 'global' | 'keyCode' | 'mouse' | 'change' | 'wheel'


const KeyCodes = [
	'Backspace',
	'Tab',
	'Clear',
	'Enter',
	'Control',
	'Alt',
	'CapsLock',
	'Escape',
	'PageUp',
	'PageDown',
	'End',
	'Home',
	'ArrowLeft',
	'ArrowUp',
	'ArrowRight',
	'ArrowDown',
	'Insert',
	'Delete',
	'Meta',
	'NumLock',
	'ControlLeft',
	'AltLeft',
	'Space',
	'MetaLeft',
	'MetaRight',
	'NumpadMultiply',
	'NumpadAdd',
	'NumpadSubtract',
	'NumpadDecimal',
	'NumpadDivide',
	'Semicolon',
	'Equal',
	'Comma',
	'Minus',
	'Period',
	'Slash',
	'Backquote',
	'BracketLeft',
	'Backslash',
	'BracketRight',
	'Quote',

	'F1',
	'F2',
	'F3',
	'F4',
	'F5',
	'F6',
	'F7',
	'F8',
	'F9',
	'F10',
	'F11',
	'F12',

	'Digit0',
	'Digit1',
	'Digit2',
	'Digit3',
	'Digit4',
	'Digit5',
	'Digit6',
	'Digit7',
	'Digit8',
	'Digit9',
	'KeyA',
	'KeyB',
	'KeyC',
	'KeyD',
	'KeyE',
	'KeyF',
	'KeyG',
	'KeyH',
	'KeyI',
	'KeyJ',
	'KeyK',
	'KeyL',
	'KeyM',
	'KeyN',
	'KeyO',
	'KeyP',
	'KeyQ',
	'KeyR',
	'KeyS',
	'KeyT',
	'KeyU',
	'KeyV',
	'KeyW',
	'KeyX',
	'KeyY',
	'KeyZ',
].map(v => v.toLowerCase())

//const ControlKeys = ['Ctrl+', 'Alt+', 'Shift+', 'Ctrl+Alt+', 'Ctrl+Shift+', 'Alt+Shift+', 'Ctrl+Alt+Shift+']


export const LuposDOMEventModifiers: Record<EventCategory, CompletionDataItem[]> = {
	global: [
		{name: 'capture', description: 'Trigger event only on capture phase, not bubble phase.'},
		{name: 'self', description: 'Trigger event only when event target is current element, not descendant elements.'},
		{name: 'once', description: 'Trigger event for only once.'},
		{name: 'prevent', description: 'Prevents default action for event.'},
		{name: 'stop', description: 'Stops event propagation.'},
		{name: 'passive', description: 'Browser will not wait listener to execute completed before painting.'},
	],
	//controlKey: ControlKeys.map(key => ({name: key, description: ''})),
	keyCode: KeyCodes.map(key => ({name: key, description: ''})),
	mouse: [
		{name: 'left', description: 'Trigger mouse event only when interact with left button.'},
		{name: 'middle', description: 'Trigger mouse event only when interact with middle button.'},
		{name: 'right', description: 'Trigger mouse event only when interact with right button.'},
		{name: 'main', description: 'Trigger mouse event only when interact with main button.'},
		{name: 'auxiliary', description: 'Trigger mouse event only when interact with auxiliary button.'},
		{name: 'secondary', description: 'Trigger mouse event only when interact with secondary button.'},
	],
	change: [
		{name: 'check', description: 'Trigger change event only when input becomes checked.'},
		{name: 'uncheck', description: 'Trigger change event only when input becomes unchecked.'},
	],
	wheel: [
		{name: 'up', description: 'Trigger wheel event only when wheel up.'},
		{name: 'down', description: 'Trigger wheel event only when wheel down.'},
	],
}


export const LuposDOMEventCategories: Record<string, EventCategory> = {
	keydown: 'keyCode',
	keyup: 'keyCode',
	keypress: 'keyCode',
	mousedown: 'mouse',
	mousemove: 'mouse',
	mouseup: 'mouse',
	click: 'mouse',
	dblclick: 'mouse',
	change: 'change',
	wheel: 'wheel',
}