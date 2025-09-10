import {Analyzer, LuposBinding} from '../../analyzer'
import {LuposBindingModifiers, LuposKnownInternalBindings} from '../../complete-data'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticCode} from '../codes'
import {DiagnosticModifier} from '../diagnostic-modifier'
import type * as TS from 'typescript'


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
			modifier.add(start, length, DiagnosticCode.MissingImportOrDeclaration, `Binding class '${mainName}' is not existing.`)
			return
		}
	}

	else if (piece.type === TemplatePartPieceType.Modifier) {
		let modifierIndex = piece.modifierIndex!
		let modifierText = modifiers[modifierIndex]

		if (mainName === 'class') {
			if (modifierIndex > 0) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier '${modifierText}' is not allowed, only one modifier as class name can be specified.`)
				return
			}
		}
		else if (mainName === 'style') {
			if (modifierIndex > 1) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier '${modifierText}' is not allowed, at most two modifiers can be specified for ':style'.`)
				return
			}

			if (modifierIndex === 1 && !LuposBindingModifiers.style.find(item => item.name === modifierText)) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier '${modifierText}' is not allowed, it must be one of '${LuposBindingModifiers.style.map(item => item.name).join(', ')}'.`)
				return
			}
		}
		else if (LuposBindingModifiers[mainName]) {
			if (!LuposBindingModifiers[mainName].find(item => item.name === modifierText)) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier '${modifierText}' is not allowed, it must be one of '${LuposBindingModifiers[mainName].map(item => item.name).join(', ')}'.`)
				return
			}
		}
		else {
			let binding = analyzer.getBindingByName(mainName, template)
			if (binding) {
				let bindingClassParams = helper.class.getConstructorParameters(binding.declaration, true)
				let modifiersParamType = bindingClassParams && bindingClassParams.length === 3 ? bindingClassParams[2].type : null
				
				let availableModifiers = modifiersParamType ?
					types.splitUnionTypeToStringList(types.typeOfTypeNode(modifiersParamType)!)
					: null

				if (availableModifiers && availableModifiers.length > 0) {
					if (!availableModifiers.find(name => name === modifierText)) {
						modifier.add(start, length, DiagnosticCode.NotAssignable, `Modifier '${modifierText}' is not allowed, it must be one of '${availableModifiers.join(', ')}'.`)
						return
					}
				}
			}
		}
	}

	else if (piece.type === TemplatePartPieceType.AttrValue) {
		let valueNodes: (TS.Expression | null)[] = [null]
		let valueTypes = [template.getPartValueType(part)]

		let valueNode = template.getPartUniqueValue(part)
		if (valueNode) {

			// `?:binding=${a, b}`, `?:binding=${(a, b)}`
			if (ts.isParenthesizedExpression(valueNode)) {
				valueNode = valueNode.expression
			}

			let splittedValueNodes = helper.pack.unPackCommaBinaryExpressions(valueNode)
			
			valueNodes = splittedValueNodes
			valueTypes = splittedValueNodes.map(node => types.typeOf(node))

			// First value decides whether binding should be activated.
			if (part.namePrefix === '?:') {
				valueNodes = splittedValueNodes.slice(1)
				valueTypes = valueTypes.slice(1)
			}

			// May unused comma expression of a for `${a, b}`, here remove it.
			if (splittedValueNodes.length > 1) {
				for (let i = 0; i < splittedValueNodes.length - 1; i++) {
					modifier.deleteByNode(splittedValueNodes[i], [DiagnosticCode.UnUsedComma])
				}
			}
		}

		// Currently we are not able to build a function type dynamically,
		// so can't test whether parameters match binding update method.

		let binding = analyzer.getBindingByName(mainName, template)
		if (binding) {
			if (mainName === 'class') {
				diagnoseClassUpdateParameter(binding, valueNodes, valueTypes, start, length, part, template, modifier)
			}
			else if (mainName === 'style') {
				diagnoseStyleUpdateParameter(binding, valueNodes, valueTypes, start, length, part, template, modifier)
			}
			else if (mainName === 'ref') {}
			else {
				diagnoseOtherUpdateParameter(binding, valueNodes, valueTypes, start, length, template, modifier)
			}
		}
	}
}


function diagnoseClassUpdateParameter(
	binding: LuposBinding,
	valueNodes: (TS.Expression | null)[],
	valueTypes: TS.Type[],
	start: number,
	length: number,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	// `:class.class-name=${...}`
	if (part.modifiers && part.modifiers.length > 0) {
		return
	}

	diagnoseOtherUpdateParameter(binding, valueNodes, valueTypes, start, length, template, modifier)
}


function diagnoseStyleUpdateParameter(
	binding: LuposBinding,
	valueNodes: (TS.Expression | null)[],
	valueTypes: TS.Type[],
	start: number,
	length: number,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let helper = template.helper

	// `:style.style-name=${...}`
	if (part.modifiers && part.modifiers.length > 0) {
		let valueType = valueTypes[0]
		let valueNode = valueNodes[0]

		if (valueType && !helper.types.isValueType(valueType)) {
			let valueStart = valueNode ? valueNode.pos : start
			let valueLength = valueNode ? valueNode.end - valueStart : length
			let fromText = helper.types.getTypeFullText(valueType)

			modifier.add(valueStart, valueLength, DiagnosticCode.NotAssignable, `Type '${fromText}' is not assignable to ':style' Binding Parameter.`)
		}

		return 
	}

	diagnoseOtherUpdateParameter(binding, valueNodes, valueTypes, start, length, template, modifier)
}


function diagnoseOtherUpdateParameter(
	binding: LuposBinding,
	valueNodes: (TS.Expression | null)[],
	valueTypes: TS.Type[],
	start: number,
	length: number,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let helper = template.helper
	let updateMethod = helper.class.getMethod(binding.declaration, 'update', true)

	if (!updateMethod) {
		return
	}
		
	let paramTypes = updateMethod.parameters.map(param => helper.types.typeOf(param))

	for (let i = 0; i < valueTypes.length; i++) {
		let valueType = valueTypes[i]
		let paramType = paramTypes[i]
		let valueNode = valueNodes[i]
		let valueStart = valueNode ? valueNode.pos : start
		let valueLength = valueNode ? valueNode.end - valueStart : length

		if (!paramType) {
			continue
		}

		if (!helper.types.isAssignableToExtended(valueType, paramType)) {
			let fromText = helper.types.getTypeFullText(valueType)
			let toText = helper.types.getTypeFullText(paramType)

			modifier.add(valueStart, valueLength, DiagnosticCode.NotAssignable, `Type '${fromText}' is not assignable to Binding Parameter type '${toText}'.`)
		}
	}
}