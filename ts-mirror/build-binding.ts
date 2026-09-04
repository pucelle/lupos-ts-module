import type TS from 'typescript'
import {Analyzer} from '../analyzer'
import {LuposKnownInternalBindings} from '../complete-data'
import {TemplateSlotPlaceholder} from '../html-syntax'
import {TemplateBasis, TemplatePart} from '../template'
import {AllCapabilities, MirrorCheck, RelativeMapping} from './mirror-builder'
import {buildElementExpression} from './build-element-expression'


/** Model the constructor and update operations performed by the binding parsers. */
export function buildBinding(
	part: TemplatePart,
	template: TemplateBasis,
	analyzer: Analyzer,
	instanceName: string,
	componentName: string | undefined,
	previousBinding: string | undefined,
	createIdentifier: () => string
): MirrorCheck {
	let {helper, sourceFile} = template
	let {ts, types} = helper
	let attr = part.attr!
	let name = part.mainName!
	let modifiers = [...part.modifiers ?? []]
	let internal = LuposKnownInternalBindings[name]
	let binding = analyzer.getBindingByName(name, template)
	let fallbackStart = template.localOffsetToGlobal(attr.nameStart)
	let fallbackEnd = template.localOffsetToGlobal(attr.nameEnd)
	let text = ''
	let mappings: RelativeMapping[] = []

	let rawValue = template.getPartUniqueValue(part)
	let value = rawValue

	if (value && ts.isParenthesizedExpression(value)) {
		value = value.expression
	}

	let parameters = value ? helper.pack.unPackCommaBinaryExpressions(value) : []
	let conditional = part.namePrefix === '?:'
	let condition = conditional ? parameters.shift() : undefined

	// The runtime supplies the attached element, which need not be this.el.
	// Tag maps retain concrete DOM types for both constructor and ref checks.
	let tagName = part.node.tagName!
	let element = buildElementExpression(part.node, template, componentName)
	let context = template.component ? 'this' : '(null! as any)'

	let refValue = rawValue

	if (refValue && ts.isNonNullExpression(refValue)) {
		refValue = refValue.expression
	}

	let refAssignment = name === 'ref' && refValue && (
		helper.access.isAccess(refValue) && !!helper.symbol.resolveDeclaration(refValue, helper.isPropertyLike)
		|| helper.isVariableIdentifier(refValue) && !!helper.symbol.resolveDeclaration(refValue, ts.isVariableDeclaration)
	)

	if (name === 'ref') {
		let beComponent = TemplateSlotPlaceholder.isComponent(tagName)

		if (refValue && beComponent && /^\w*?Element$/.test(types.getTypeFullText(types.typeOf(refValue)))) {
			modifiers = ['el']
		}

		if (modifiers.length === 0) {
			modifiers = [beComponent ? 'com' : 'el']
		}
	}

	// Return the conditional instance so a following :ref.binding can reuse its
	// inferred type, while update arguments remain inside the narrowing branch.
	let localInstance = conditional ? createIdentifier() : instanceName

	if (conditional) {
		text += `let ${instanceName} = (() => {if (`
		writeValue(condition)
		text += ') {'
	}

	writeConstructor()

	if (name === 'ref') {
		writeReference()
	}
	else {
		writeUpdate()
	}

	if (conditional) {
		text += `return ${localInstance};} return null;})();`
	}

	text += `void ${instanceName};`

	mappings.push({
		start: 0,
		end: text.length,
		originalStart: fallbackStart,
		originalEnd: fallbackEnd,
		kind: 'scaffold',
		capabilities: ['diagnostic']
	})

	return {
		text,
		mappings,
		fallbackStart,
		fallbackEnd
	}

	/** Construct the binding with its element, context, and modifiers. */
	function writeConstructor() {
		text += `let ${localInstance} = new `

		if (internal) {
			text += '(null! as typeof import("lupos.html").'
		}

		let nameStart = text.length
		text += internal?.name ?? name

		mappings.push({
			start: nameStart,
			end: text.length,
			originalStart: template.localOffsetToGlobal(attr.nameStart + (part.namePrefix?.length ?? 0)),
			originalEnd: template.localOffsetToGlobal(attr.nameStart + (part.namePrefix?.length ?? 0) + name.length),
			kind: 'symbol-anchor',
			capabilities: AllCapabilities
		})

		if (internal) {
			text += ')'
		}

		let constructorParameters = binding && helper.class.getConstructorParameters(binding.declaration, true)
		let parameterCount = internal?.parameterCount ?? constructorParameters?.length ?? 0

		text += '('

		if (parameterCount > 0) {
			text += element
		}

		if (parameterCount > 1) {
			text += `, ${context}`
		}

		if (parameterCount > 2 && modifiers.length > 0) {
			text += ', ['

			modifiers.forEach((modifier, index) => {
				if (index) {
					text += ', '
				}

				writeModifier(modifier, index)
			})

			text += ']'
		}

		text += ');'
	}

	/** Check a reference assignment or callback against the attached target. */
	function writeReference() {
		let target = modifiers.includes('el') ? element
			: modifiers.includes('com') ? componentName ?? '(null! as import("lupos.html").Component)'
			: modifiers.includes('binding') ? previousBinding ? `${previousBinding}!` : 'null'
			: element

		let targetName = createIdentifier()
		text += `let ${targetName}${target === 'null' ? ': null' : ''} = ${target};`

		if (refAssignment) {
			copy(refValue!)
			text += ` = ${targetName};`
		}
		else {

			// Contextually type inline callbacks with the actual referenced object.
			let callbackName = createIdentifier()
			text += `((${callbackName}: (value: typeof ${targetName}) => void) => ${callbackName}(${targetName}))(`
			writeValue(parameters[0])
			text += ');'
		}

		text += `void ${localInstance};`
	}

	/** Emit the binding update, including class and style special cases. */
	function writeUpdate() {
		let method = 'update'
		let special = name === 'class' || name === 'style'

		if (special) {
			let valueType = template.getPartValueType(part)

			if (modifiers.length) {
				method = 'updateObject'
			}
			else if (!part.valueIndices || part.strings || types.isValueType(valueType)) {
				method = 'updateString'
			}
			else if (name === 'class' && types.isArrayType(valueType)) {
				method = 'updateList'
			}
			else if (types.isObjectType(valueType)) {
				method = 'updateObject'
			}
		}

		text += `${localInstance}.${method}(`

		if (special && modifiers.length) {
			text += '{'
			writeModifier(modifiers[0], 0)
			text += ': '

			let unit = name === 'style' ? modifiers[1] : undefined

			if (unit === 'url') {
				text += '"url(" + '
			}

			writeValue(parameters[0])

			if (unit === 'url') {
				text += ' + ")"'
			}
			else if (unit === 'percent' || unit && /^\w+$/.test(unit)) {
				text += ' + ' + JSON.stringify(unit === 'percent' ? '%' : unit)
			}

			text += '}'
		}
		else if (rawValue) {
			let args = special ? parameters.slice(0, 1) : parameters

			args.forEach((parameter, index) => {
				if (index) {
					text += ', '
				}

				writeValue(parameter)
			})
		}
		else {
			writeValue(undefined)
		}

		text += ');'
	}

	/** Copy an expression with its original source mapping. */
	function copy(node: TS.Expression) {
		let start = text.length
		text += sourceFile.text.slice(node.getStart(sourceFile), node.getEnd())

		mappings.push({
			start,
			end: text.length,
			originalStart: node.getStart(sourceFile),
			originalEnd: node.getEnd(),
			kind: 'copied-expression',
			capabilities: AllCapabilities
		})
	}

	/** Write a modifier and map its name to the attribute. */
	function writeModifier(modifier: string, index: number) {
		let start = text.length
		text += JSON.stringify(modifier)

		let localStart = attr.nameStart + (part.namePrefix?.length ?? 0) + name.length + 1
			+ (part.modifiers ?? []).slice(0, index).reduce((length, value) => length + value.length + 1, 0)

		if (part.modifiers?.[index] === modifier) {
			mappings.push({
				start,
				end: text.length,
				originalStart: template.localOffsetToGlobal(localStart),
				originalEnd: template.localOffsetToGlobal(localStart + modifier.length),
				kind: 'symbol-anchor',
				capabilities: AllCapabilities
			})
		}
	}

	/** Write an argument using the template attribute value semantics. */
	function writeValue(node: TS.Expression | undefined) {
		if (node) {
			text += '('
			copy(node)
			text += ')'
		}
		else if (part.strings) {
			text += part.valueIndices ? '("" as string)' : JSON.stringify(part.strings[0].text)
		}
		else {
			text += 'true'
		}
	}
}
