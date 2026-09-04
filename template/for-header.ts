import type TS from 'typescript'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {Helper} from '../helper'


/** Declaration and iterable interpolations in `<lu:for ${item, index} of ${list}>`. */
export interface ForHeader {

	/** Index of ${item, index}. */
	declarationIndex: number

	/** Index of ${list}. */
	iterableIndex: number

	names: TS.Identifier[]
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

	let names = helper.pack.unPackCommaBinaryExpressions(declaration)
	if (names.length < 1 || names.length > 2 || !names.every(helper.ts.isIdentifier)
		|| new Set(names.map(name => name.text)).size !== names.length
	) {
		return null
	}

	return {declarationIndex, iterableIndex, names}
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
