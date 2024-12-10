
/** Modefiers to filter events by event actions. */
const GlobalEventModifiers = ['capture', 'self', 'once', 'prevent', 'stop', 'passive'] as const

/** Modefiers to filter key events. */
const ControlKeyModefiers = ['ctrl', 'shift', 'alt'] as const

/** Modefiers to filter change events. */
const ChangeEventModifiers = ['check', 'uncheck'] as const

/** Modefiers to filter wheel events. */
const WheelEventModifiers = ['up', 'down'] as const

/** Modefiers to filter click events. */
const ButtonNameModifiers = {
	left: 0,
	middle: 1,
	right: 2,
	main: 0,
	auxiliary: 1,
	secondary: 2
}

/** Valdiate event modifiers. */
function validateModifiers(propertyName: string, type: string, modifiers: string[]): boolean {

	// Exclude global modifiers.
	modifiers = modifiers.filter(m => !GlobalEventModifiers.includes(m as any))

	if (modifiers.length === 0) {
		return true
	}

	if (type === 'change') {
		if (modifiers.length > 1 || !ChangeEventModifiers.includes(modifiers[0] as any)) {
			throw new Error(`"${propertyName}" is valid, change event modifier must be only one of "${ChangeEventModifiers.join(',')}"!`)
		}
	}
	else if (type === 'wheel') {
		if (modifiers.length > 1 || !WheelEventModifiers.includes(modifiers[0] as any)) {
			throw new Error(`"${propertyName}" is valid, wheel event modifier must be only one of "${WheelEventModifiers.join(',')}"!`)
		}
	}
	else if (type === 'mousedown' || type === 'mousemove' || type === 'mouseup' || type === 'click') {
		modifiers = modifiers.filter(m => !ControlKeyModefiers.includes(m as any))

		if (!ButtonNameModifiers.hasOwnProperty(modifiers[0])) {
			throw new Error(`"${propertyName}" is valid, button filter for mouse event must be one of "${Object.keys(ButtonNameModifiers).join(',')}"!`)
		}
	}

	return true
}