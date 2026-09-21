import type TS from 'typescript'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {Helper} from '../helper'


/** Declaration and iterable interpolations in `<lu:for ${item, index} of ${list}>`. */
export interface ForHeader {

	/** Index of ${item, index}. */
	declarationIndex: number

	/** Index of ${list}. */
	iterableIndex: number

	/** 
	 * Generated first callback parameter, converted from expression to binding name.
	 * `for ${[...]} of` -> `function([...]) {}`
	 */
	bindingName: TS.BindingName

	/** Source expression representing the first for parameter `lu:for ${...}`. */
	declaration: TS.Expression

	/** All names declared by the `lu:for ${..., index?}` value pattern and optional index. */
	names: TS.Identifier[]

	/** Names declared by the `lu:for ${...}` value pattern. */
	valueNames: TS.Identifier[]

	/** Optional iteration index from `lu:for ${..., index?}` of .... */
	indexName: TS.Identifier | null
}


/** Iterable and render callback in `<lu:for ${items}>${render}</lu:for>`. */
export interface ForRenderer {

	/** Index of the iterable expression. */
	iterableIndex: number

	/** Index of the render callback expression. */
	rendererIndex: number
}

/** Parse `<lu:for ${item, index} of ${list}>` for headers. */
export function parseForHeader(node: HTMLNode, values: TS.Expression[], helper: Helper): ForHeader | null {
	let attrs = node.attrs ?? []
	if (attrs.length !== 3 || attrs[1].name !== 'of' || attrs.some(attr => attr.value !== null)) {
		return null
	}

	let declarationIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(attrs[0].name)
	let iterableIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(attrs[2].name)

	if (declarationIndex === null || iterableIndex === null
		|| !TemplateSlotPlaceholder.isCompleteSlotIndex(attrs[0].name)
		|| !TemplateSlotPlaceholder.isCompleteSlotIndex(attrs[2].name)
	) {
		return null
	}

	let declaration = values[declarationIndex]
	if (helper.ts.isParenthesizedExpression(declaration)) {
		declaration = declaration.expression
	}

	let declarations = helper.pack.unPackCommaBinaryExpressions(declaration)
	if (declarations.length < 1 || declarations.length > 2) {
		return null
	}

	let bindingName = makeBindingName(declarations[0], helper)
	let indexName = declarations[1] ?? null

	// Deconstructed for all declaration variable names.
	let valueNames = [...helper.parameter.walkDeconstructedArgumentTypeItemsOf(declarations[0], undefined)]
		.map(item => item.arg)

	if (!bindingName || valueNames.length === 0 || !valueNames.every(helper.ts.isIdentifier)
		|| indexName !== null && !helper.ts.isIdentifier(indexName)
	) {
		return null
	}

	let names = [...valueNames, ...indexName ? [indexName] : []] as TS.Identifier[]
	if (new Set(names.map(name => name.text)).size !== names.length) {
		return null
	}

	return {
		declarationIndex,
		iterableIndex,
		bindingName,
		declaration: declarations[0],
		names,
		valueNames: valueNames as TS.Identifier[],
		indexName: indexName as TS.Identifier | null,
	}
}

/** 
 * Convert an expression-shaped template parameter to a callback binding name.
 * It converts the `${[...]}` or `${{...}}` from expression to parameter binding name.
 */
function makeBindingName(expression: TS.Expression, helper: Helper): TS.BindingName | null {
	let {ts, factory} = helper

	if (ts.isParenthesizedExpression(expression)) {
		return makeBindingName(expression.expression, helper)
	}
	else if (ts.isIdentifier(expression)) {
		return expression
	}
	else if (ts.isArrayLiteralExpression(expression)) {
		let elements: (TS.BindingElement | TS.OmittedExpression)[] = []

		for (let i = 0; i < expression.elements.length; i++) {
			let element = expression.elements[i]

			if (ts.isOmittedExpression(element)) {
				elements.push(element)
				continue
			}

			let rest: boolean
			let value: TS.Expression

			if (ts.isSpreadElement(element)) {
				rest = true
				value = element.expression
			}
			else {
				rest = false
				value = element
			}

			let parsed = parseBindingValue(value, helper)
			if (!parsed || rest && (parsed.initializer || i !== expression.elements.length - 1)) {
				return null
			}

			elements.push(factory.createBindingElement(
				rest ? factory.createToken(ts.SyntaxKind.DotDotDotToken) : undefined,
				undefined,
				parsed.name,
				parsed.initializer
			))
		}

		return factory.createArrayBindingPattern(elements)
	}
	else if (ts.isObjectLiteralExpression(expression)) {
		let elements: TS.BindingElement[] = []

		for (let i = 0; i < expression.properties.length; i++) {
			let property = expression.properties[i]

			if (ts.isShorthandPropertyAssignment(property)) {
				elements.push(factory.createBindingElement(
					undefined,
					undefined,
					property.name,
					property.objectAssignmentInitializer
				))
			}
			else if (ts.isPropertyAssignment(property)) {
				let parsed = parseBindingValue(property.initializer, helper)
				if (!parsed) {
					return null
				}

				elements.push(factory.createBindingElement(
					undefined,
					property.name,
					parsed.name,
					parsed.initializer
				))
			}
			else if (ts.isSpreadAssignment(property)) {
				let name = makeBindingName(property.expression, helper)
				if (!name || !ts.isIdentifier(name) || i !== expression.properties.length - 1) {
					return null
				}

				elements.push(factory.createBindingElement(
					factory.createToken(ts.SyntaxKind.DotDotDotToken),
					undefined,
					name,
					undefined
				))
			}
			else {
				return null
			}
		}

		return factory.createObjectBindingPattern(elements)
	}

	return null
}

/** Parse a binding name with an optional assignment fallback. */
function parseBindingValue(
	expression: TS.Expression,
	helper: Helper
): {name: TS.BindingName, initializer: TS.Expression | undefined} | null {
	let {ts} = helper

	if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
		let name = makeBindingName(expression.left, helper)

		return name
			? {name, initializer: expression.right}
			: null
	}

	let name = makeBindingName(expression, helper)
	return name ? {name, initializer: undefined} : null
}


/** Parse the shorthand with one iterable attribute and one callback body. */
export function parseForRenderer(node: HTMLNode): ForRenderer | null {
	let attrs = node.attrs ?? []
	let content = node.getContentString().trim()

	if (attrs.length !== 1 || attrs[0].value !== null
		|| !TemplateSlotPlaceholder.isCompleteSlotIndex(attrs[0].name)
		|| !TemplateSlotPlaceholder.isCompleteSlotIndex(content)
	) {
		return null
	}

	return {
		iterableIndex: TemplateSlotPlaceholder.getUniqueSlotIndex(attrs[0].name)!,
		rendererIndex: TemplateSlotPlaceholder.getUniqueSlotIndex(content)!,
	}
}
