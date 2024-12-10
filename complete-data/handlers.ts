import {LuposBindingModifiers} from './lupos-binding-modifiers'
import {LuposSimulatedEvents} from './lupos-simulated-events'


/** Find unique completion data item where name fully match. */
export function findCompletionDataItem<T extends CompletionDataItem>(items: T[], name: string): T | undefined {
	return items.find(item => item.name === name)
}


/** Get modifier completion items. */
export function getBindingModifierCompletionItems(mainName: string, modifiers: string[], available: string[] | null) {
	
	// Use known binding modifiers.
	if (!available) {
		available = LuposBindingModifiers[mainName]?.map(item => item.name)
	}

	// Filter out existing group when current modifier is empty.
	if (available && LuposBindingModifiers[mainName]) {
		let existingGroups = modifiers.map(m => LuposBindingModifiers[mainName].find(item => item.name === m)?.group).filter(v => v !== undefined)

		available = available.filter(m => {
			let group = LuposBindingModifiers[mainName].find(item => item.name === m)?.group
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
		let luposBindingItem = LuposBindingModifiers[mainName].find(item => item.name === m)

		return {
			name: m,
			description: luposBindingItem?.description || '',
		}
	})

	return items
}


/** Test whether an event name represents a simulated event. */
export function isSimulatedEventName(name: string): boolean {
	return !!LuposSimulatedEvents.find(item => item.name === name)
}
