constructor(el: Element, _context: any, modifiers?: string[]) {
	if (modifiers) {
		if (modifiers.length > 1) {
			throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most one modifier as class name can be specified for ":class"!`)
		}

		if (!/^\$?[\w-]+$/.test(modifiers[0])) {
			throw new Error(`Modifier "${modifiers[0]}" is not a valid class name!`)
		}
	}

	this.el = el
	this.modifiers = modifiers
}