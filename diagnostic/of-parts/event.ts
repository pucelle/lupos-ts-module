import {Analyzer} from '../../analyzer'
import {findCompletionDataItem, LuposDOMEventCategories, LuposDOMEventModifiers} from '../../complete-data'
import {TemplateSlotPlaceholder} from '../../html-syntax'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticCode} from '../codes'
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
	let helper = template.helper

	let isComponent = TemplateSlotPlaceholder.isComponent(tagName)
	let component = isComponent ? analyzer.getComponentByTagName(tagName, template) : null
	let comEvent = component ? analyzer.getComponentEvent(component, mainName) : null

	// Validate component events.
	if (piece.type === TemplatePartPieceType.Name) {
		if (component) {
			if (part.namePrefix === '@@' && !comEvent) {
				modifier.add(start, length, DiagnosticCode.NotExistOn, `"<${component.name}>" does not support event "${mainName}".`)
				return
			}

			// Component Events.
			if (comEvent) {
				let eventType = helper.types.typeOf(comEvent.nameNode)
				let handlerType = template.getPartValueType(part)

				if (!helper.types.isAssignableToExtended(handlerType, eventType)) {
					let fromText = helper.types.getTypeFullText(handlerType)
					let toText = helper.types.getTypeFullText(eventType)
	
					modifier.add(start, length, DiagnosticCode.NotAssignable, `Property type "${fromText}" is not assignable to type "${toText}".`)
					return
				}
			}
		}
	}

	// Validate modifiers, `@click.xxx`.
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
					modifier.add(start, length, DiagnosticCode.NotExistOn, `Modifier "${modifierValue}" is not supported by event "${mainName}".`)
				}
			}
		}
	}

	// Validate event handlers `@click=${...}`.
	else if (piece.type === TemplatePartPieceType.AttrValue) {
		if (!comEvent) {
			let handlerType = template.getPartValueType(part)

			if (!helper.types.isFunctionType(handlerType)) {
				let fromText = helper.types.getTypeFullText(handlerType)
				modifier.add(start, length, DiagnosticCode.NotAssignable, `"${fromText}" is not a event handler.`)
				return
			}
		}
	}
}