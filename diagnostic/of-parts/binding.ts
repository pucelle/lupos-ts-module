import {Analyzer} from '../../analyzer'
import {LuposBindingModifiers} from '../../complete-data'
import {TemplateBasis, TemplatePart, TemplatePartLocation, TemplatePartLocationType} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseBinding(
	location: TemplatePartLocation,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(location.start)
	let length = template.localOffsetToGlobal(location.end) - start
	let helper = template.helper
	let types = helper.types
	let ts = helper.ts
	let mainName = part.mainName!
	let modifiers = part.modifiers!

	if (location.type === TemplatePartLocationType.Name) {
		let ref = template.getReferenceByName(mainName)
		if (ref) {
			modifier.deleteNeverRead(ref)
		}

		let binding = analyzer.getBindingByName(mainName, template)
		if (!binding) {
			modifier.addMissingImport(start, length, `Binding class "${mainName}" is not imported or declared.`)
			return
		}
	}

	else if (location.type === TemplatePartLocationType.Modifier) {
		let modifierIndex = location.modifierIndex!
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

	else if (location.type === TemplatePartLocationType.AttrValue) {
		//let valueNodes: (TS.Expression | null)[] = [null]
		//let valueTypes = [template.getPartValueType(part)]

		// `?:binding=${a, b}`, `?:binding=${(a, b)}`
		if (!part.strings && part.valueIndices) {
			let valueNode = template.valueNodes[part.valueIndices[0].index]

			if (ts.isParenthesizedExpression(valueNode)) {
				valueNode = valueNode.expression
			}

			let splittedValueNodes = helper.pack.unPackCommaBinaryExpressions(valueNode)
			// valueNodes = splittedValueNodes
			// valueTypes = splittedValueNodes.map(node => types.typeOf(node))

			// // First value decides whether binding should be activated.
			// if (part.namePrefix === '?:') {
			// 	valueNodes = splittedValueNodes.slice(1)
			// 	valueTypes = valueTypes.slice(1)
			// }

			// May unused comma expression of a for `${a, b}`, here remove it.
			if (splittedValueNodes.length > 1) {
				for (let i = 0; i < splittedValueNodes.length - 1; i++) {
					modifier.deleteUnusedComma(splittedValueNodes[i])
				}
			}
		}

		// Currently we are not able to build a function type dynamically,
		// so can't test whether parameters match binding update method.

		// let binding = analyzer.getBindingByNameAndTemplate(mainName, template)
		// if (binding) {
		// 	let method = helper.class.getMethod(binding.declaration, 'update', true)
		// 	if (method) {
		// 		let paramTypes = method.parameters.map(param => types.typeOf(param))

		// 		for (let i = 0; i < valueTypes.length; i++) {
		// 			let valueType = valueTypes[i]
		// 			let paramType = paramTypes[i]
		// 			let valueNode = valueNodes[i]
		// 			let valueStart = valueNode ? valueNode.pos : start
		// 			let valueLength = valueNode ? valueNode.end - valueStart : length

		// 			if (!paramType) {
		// 				continue
		// 			}

		// 			if (!types.isAssignableTo(valueType, paramType)) {
		// 				modifier.addNotAssignable(valueStart, valueLength, '"renderer" of "<lu:for ${renderer}>" must return a "TemplateResult".')
		// 			}
		// 		}
		// 	}
		// }
	}
}