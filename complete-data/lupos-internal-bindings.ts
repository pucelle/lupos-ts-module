/** Known bindings existing in `lupos.html`. */
export const LUPOS_KNOWN_INTERNAL_BINDINGS: Record<string, {name: string, parameterCount: number, implementsPart: boolean}> = {
	class: {name: 'ClassBinding', parameterCount: 1, implementsPart: false},
	html: {name: 'HTMLBinding', parameterCount: 1, implementsPart: false},
	ref: {name: 'RefBinding', parameterCount: 3, implementsPart: true},
	style: {name: 'StyleBinding', parameterCount: 1, implementsPart: false},
	transition: {name: 'TransitionBinding', parameterCount: 3, implementsPart: true},
}


/** `ClassBinding`-> `class` */
export const LUPOS_KNOWN_INTERNAL_BINDING_NAMES_MAP = new Map(Object.entries(LUPOS_KNOWN_INTERNAL_BINDINGS).map(v => [v[1].name, v[0]]))