import {Analyzer} from '../../analyzer'
import {findCompletionDataItem, LuposDOMEventCategories, LuposDOMEventModifiers} from '../../complete-data'
import {TemplateSlotPlaceholder} from '../../html-syntax'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseEvent(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let mainName = part.mainName!
	let tagName = part.node.tagName!
	let modifiers = part.modifiers!

	let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
	let component = isComponent ? analyzer.getComponentByTagName(tagName, template) : null
	let comEvent = component ? analyzer.getComponentEvent(component, mainName) : null
	
	// `@click`, complete event name.
	if (piece.type === TemplatePartPieceType.Name) {
		if (component) {
			if (part.namePrefix === '@@' && !comEvent) {
				modifier.addNotExistOn(start, length, `"<${component.name}>" does not support event "${mainName}".`)
				return
			}
		}
	}

	// `@click.`, complete modifiers.
	else if (piece.type === TemplatePartPieceType.Modifier) {
		if (!comEvent && part.namePrefix === '@') {
			let modifierIndex = piece.modifierIndex!
			let modifierValue = modifiers[modifierIndex]
	
			// `.passive`, `.stop`, ...
			let beGlobal = !!findCompletionDataItem(LuposDOMEventModifiers.global, modifierValue)
	
			// `@keydown.enter`, `@click.left`.
			// Not provide control keys completion.
			if (!beGlobal && LuposDOMEventCategories[mainName]) {
				let category = LuposDOMEventCategories[mainName]
				let inCategory = !!findCompletionDataItem(LuposDOMEventModifiers[category], modifierValue)

				if (!inCategory) {
					modifier.addNotExistOn(start, length, `Modifier "${modifierValue}" is not supported by event "${mainName}".`)
				}
			}
		}
	}
}