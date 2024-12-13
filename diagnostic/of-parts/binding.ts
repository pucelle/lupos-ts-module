import {Analyzer} from '../../analyzer'
import {LuposBindingModifiers, LuposKnownInternalBindings} from '../../complete-data'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseBinding(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let helper = template.helper
	let types = helper.types
	let ts = helper.ts
	let mainName = part.mainName!
	let modifiers = part.modifiers!

	if (piece.type === TemplatePartPieceType.Name) {
		let ref = template.getReferenceByName(mainName)
		if (ref) {
			modifier.deleteNeverRead(ref)
		}

		let binding = analyzer.getBindingByName(mainName, template)
		if (!binding && !LuposKnownInternalBindings[mainName]) {
			modifier.addMissingImport(start, length, `Binding class "${mainName}" is not imported or declared.`)
			return
		}
	}

	else if (piece.type === TemplatePartPieceType.Modifier) {
		let modifierIndex = piece.modifierIndex!
		let modifierText = modifiers[modifierIndex]

		if (mainName === 'class') {
			if (modifierIndex > 0) {
				modifier.addNotAssignable(start, length, `Modifier "${modifierText}" is not allowed, only one modifier as class name can be specified.`)
				return
			}
		}
		else if (mainName === 'style') {
			if (modifierIndex > 1) {
				modifier.addNotAssignable(start, length, `Modifier "${modifierText}" is not allowed, at most two modifiers can be specified for ":style".`)
				return
			}

			if (modifierIndex === 1 && !LuposBindingModifiers.style.find(item => item.name === modifierText)) {
				modifier.addNotAssignable(start, length, `Modifier "${modifierText}" is not allowed, it must be one of "${LuposBindingModifiers.style.map(item => item.name).join(', ')}".`)
				return
			}
		}
		else if (LuposBindingModifiers[mainName]) {
			if (!LuposBindingModifiers[mainName].find(item => item.name === modifierText)) {
				modifier.addNotAssignable(start, length, `Modifier "${modifierText}" is not allowed, it must be one of "${LuposBindingModifiers[mainName].map(item => item.name).join(', ')}".`)
				return
			}
		}
		else {
			let binding = analyzer.getBindingByName(mainName, template)
			if (binding) {
				let bindingClassParams = helper.class.getConstructorParameters(binding.declaration)
				let modifiersParamType = bindingClassParams && bindingClassParams.length === 3 ? bindingClassParams[2].type : null
				
				let availableModifiers = modifiersParamType ?
					types.splitUnionTypeToStringList(types.typeOfTypeNode(modifiersParamType)!)
					: null

				if (availableModifiers && availableModifiers.length > 0) {
					if (!availableModifiers.find(name => name === modifierText)) {
						modifier.addNotAssignable(start, length, `Modifier "${modifierText}" is not allowed, it must be one of "${availableModifiers.join(', ')}".`)
						return
					}
				}
			}
		}
	}

	else if (piece.type === TemplatePartPieceType.AttrValue) {

		// `?:binding=${a, b}`, `?:binding=${(a, b)}`
		if (!part.strings && part.valueIndices) {
			let valueNode = template.valueNodes[part.valueIndices[0].index]

			if (ts.isParenthesizedExpression(valueNode)) {
				valueNode = valueNode.expression
			}

			let splittedValueNodes = helper.pack.unPackCommaBinaryExpressions(valueNode)

			// May unused comma expression of a for `${a, b}`, here remove it.
			if (splittedValueNodes.length > 1) {
				for (let i = 0; i < splittedValueNodes.length - 1; i++) {
					modifier.deleteUnusedComma(splittedValueNodes[i])
				}
			}
		}
	}
}