import {LUPOS_BINDING_MODIFIERS} from './lupos-binding-modifiers'
import {LUPOS_SIMULATED_EVENTS} from './lupos-simulated-events'


/** 
 * Filter completion items.
 * Must ensure item names are in lower-case.
 */
export function filterCompletionDataItems(items: CompletionDataItem[], label: string): CompletionDataItem[] {
	let lowerLabel = label.toLowerCase()
	return items.filter(item => item.name.startsWith(lowerLabel))
}


/** Find unique completion data item where name fully match. */
export function findCompletionDataItem<T extends CompletionDataItem>(items: T[], name: string): T | undefined {
	return items.find(item => item.name === name)
}


/** Get modifier completion items. */
export function getBindingModifierCompletionItems(mainName: string, modifiers: string[], available: string[] | null) {
	
	// Use known binding modifiers.
	if (!available) {
		available = LUPOS_BINDING_MODIFIERS[mainName]?.map(item => item.name)
	}

	// Filter out existing group when current modifier is empty.
	if (available && LUPOS_BINDING_MODIFIERS[mainName]) {
		let existingGroups = modifiers.map(m => LUPOS_BINDING_MODIFIERS[mainName].find(item => item.name === m)?.group).filter(v => v !== undefined)

		available = available.filter(m => {
			let group = LUPOS_BINDING_MODIFIERS[mainName].find(item => item.name === m)?.group
			if (group === undefined) {
				return true
			}

			return !existingGroups.includes(group)
		})
	}

	if (!available) {
		return []
	}

	// Make modifier completion items by names.
	let items: CompletionDataItem[] = available.map(m => {
		let luposBindingItem = LUPOS_BINDING_MODIFIERS[mainName].find(item => item.name === m)

		return {
			name: m,
			description: luposBindingItem?.description || '',
		}
	})

	return items
}


/** Test whether an event name represents a simulated event. */
export function isSimulatedEventName(name: string): boolean {
	return !!LUPOS_SIMULATED_EVENTS.find(item => item.name === name)
}
