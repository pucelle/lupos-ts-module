export interface ModifierCompletionDataItem extends CompletionDataItem {
	group?: number
}


/** 
 * Lupos binding which get compiled by compiler.
 * Other binding modifiers will detect by binding constructor.
 */
export const LuposBindingModifiers: Record<string, ModifierCompletionDataItem[]> = {
	style: [
		{name: 'px', description: 'Add `px` unit to value.', group: 1},
		{name: 'percent', description: 'Add `%` unit to value.', group: 1},
		{name: 'url', description: 'Wrap computed value with `url()`.', group: 1},
	],
	ref: [
		{name: 'el', description: 'Force reference current element.', group: 1},
		{name: 'com', description: 'Force reference current component.', group: 1},
		{name: 'binding', description: 'Force reference previous binding.', group: 1},
	],
	transition: [
		{name: 'global', description: 'Play transition only when element itself get inserted or removed.', group: 1},
		{name: 'local', description: 'Play transition when element or any ancestral element get inserted or removed, this is default action.', group: 1},
		{name: 'immediate', description: 'Play transition immediately after element get initialized.', group: 2},
	],
}