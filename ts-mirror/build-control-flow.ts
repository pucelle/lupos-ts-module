import type TS from 'typescript'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {Helper} from '../helper'
import {parseForHeader} from '../template'


/** Operations shared with the template writer while emitting lexical scopes. */
export interface ControlFlowOutput {
	write(text: string): void
	copy(node: TS.Expression): void
	position(): number
	check(start: number, node: TS.Expression): void
	exclude(node: TS.Expression): void
	children(node: HTMLNode): void
	identifier(): string
}


/** Whether a control node has enough syntax to emit a valid mirror scope. */
export function isMirrorControl(node: HTMLNode, values: TS.Expression[], helper: Helper): boolean {
	if (node.tagName === 'lu:for') {
		return parseForHeader(node, values, helper) !== null
	}
	else if (node.tagName === 'lu:else' || node.tagName === 'lu:default' || node.tagName === 'lu:cache') {
		return true
	}
	else {
		return ['lu:if', 'lu:elseif', 'lu:switch', 'lu:case', 'lu:keyed'].includes(node.tagName!)
			&& conditionOf(node, values) !== null
	}
}

/** Emit the control construct around its component, binding, and expression checks. */
export function buildControlFlow(node: HTMLNode, values: TS.Expression[], helper: Helper, output: ControlFlowOutput) {
	if (node.tagName === 'lu:for') {
		buildFor(node, values, helper, output)
	}
	else {
		buildBranch(node, values, output)
	}
}

/** Model iteration with the iterable resolved in the enclosing scope. */
function buildFor(node: HTMLNode, values: TS.Expression[], helper: Helper, output: ControlFlowOutput) {
	let header = parseForHeader(node, values, helper)!
	let iterable = values[header.iterableIndex]
	let start = output.position()
	let name = output.identifier()

	output.write(`let ${name} = (`)
	output.copy(iterable)
	output.write(');for (let ')
	output.copy(header.names[0])
	output.write(` of ${name}) {`)
	output.check(start, iterable)
	output.write(`void ${header.names[0].text};`)

	if (header.names[1]) {
		output.write('let ')
		output.copy(header.names[1])
		output.write(` = 0; void ${header.names[1].text};`)
	}

	output.exclude(values[header.declarationIndex])
	output.children(node)
	output.write('}')
}

/** Preserve branch narrowing without evaluating mirror expressions at runtime. */
function buildBranch(node: HTMLNode, values: TS.Expression[], output: ControlFlowOutput) {
	let tag = node.tagName
	let condition = conditionOf(node, values)
	let previousTag = node.previousSibling?.tagName
	let followsIf = previousTag === 'lu:if' || previousTag === 'lu:elseif'
	let isCase = (tag === 'lu:case' || tag === 'lu:default') && node.parent?.tagName === 'lu:switch'

	if (tag === 'lu:else') {
		output.write(followsIf ? 'else {' : '{')
	}
	else if (isCase) {
		if (tag === 'lu:case') {
			output.write('case (')
			output.copy(condition!)
			output.write('): {')
		}
		else {
			output.write('default: {')
		}
	}
	else if (tag === 'lu:if' || tag === 'lu:elseif' || tag === 'lu:switch') {
		let prefix = tag === 'lu:switch' ? 'switch' : tag === 'lu:elseif' && followsIf ? 'else if' : 'if'
		output.write(`${prefix} (`)
		output.copy(condition!)
		output.write(') {')
	}
	else {
		output.write('{')

		if (condition) {
			output.write('void (')
			output.copy(condition)
			output.write(');')
		}
	}

	output.children(node)
	output.write(isCase ? 'break;}' : '}')
}

/** Read the expression supplied as the control tag's placeholder attribute. */
function conditionOf(node: HTMLNode, values: TS.Expression[]): TS.Expression | null {
	let attr = node.attrs?.find(attr => TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name))
	let index = attr ? TemplateSlotPlaceholder.getUniqueSlotIndex(attr.name) : null
	return index === null ? null : values[index]
}
