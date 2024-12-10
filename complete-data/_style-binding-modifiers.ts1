/** All modifiers for style binding. */
const AllowedStyleModifiers = ['px', 'percent', 'url']


	constructor(el: Element, _context: any, modifiers?: string[]) {
		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers (as style name property value modifier) can be specified for ":style"!`)
			}

			if (modifiers.length === 2 && !AllowedStyleModifiers.includes(modifiers[1])) {
				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${AllowedStyleModifiers.join(', ')}!`)
			}

			if (!/^[\w-]+$/.test(modifiers[0]) || AllowedStyleModifiers.includes(modifiers[0])) {
				throw new Error(`Modifier "${modifiers[0]}" is not a valid style property!`)
			}
		}