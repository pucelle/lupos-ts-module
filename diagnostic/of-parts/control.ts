import {TemplateBasis, TemplatePart, TemplatePartPiece, parseForHeader} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'
import {HTMLNode, HTMLNodeType, TemplateSlotPlaceholder} from '../../html-syntax'
import {LuposFlowControlTags} from '../../complete-data'
import {DiagnosticCode} from '../codes'


export function diagnoseControl(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let tagName = part.node.tagName!

	if (!LuposFlowControlTags.find(item => item.name === tagName)) {
		modifier.add(start, length, DiagnosticCode.ControlTagNotValid, `'<${tagName}>' is not a valid control tag.`)
	}
	
	if (tagName === 'lu:await') {
		diagnoseAwait(part, start, length, template, modifier)
	}

	else if (tagName === 'lu:for') {
		diagnoseFor(part, start, length, template, modifier)
	}

	else if (tagName === 'lu:if') {
		diagnoseIf(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:elseif') {
		diagnoseElseIf(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:else') {
		diagnoseElse(part, start, length, template, modifier)
	}

	else if (tagName === 'lu:keyed') {
		diagnoseKeyed(part, start, length, template, modifier)
	}

	else if (tagName === 'lu:cache') {}

	else if (tagName === 'lu:switch') {
		diagnoseSwitch(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:case') {
		diagnoseCase(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:default') {
		diagnoseDefault(part, start, length, template, modifier)
	}
}


function diagnoseAwait(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let promiseIndex = getAttrValueIndex(part.node)
	if (promiseIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:await \${...}>' must accept a parameter as promise to await.`)
		return
	}

	// let helper = template.helper
	// let types = helper.types
	// let valueNode = template.valueNodes[promiseIndex]
	// let valueType = types.typeOf(valueNode)
	// let typeReferenceText = types.getTypeReferenceName(valueType)

	// if (typeReferenceText && typeReferenceText !== 'Promise') {
	// 	let valueStart = valueNode.pos
	// 	let valueLength = valueNode.end - valueNode.pos

	// 	modifier.add(valueStart, valueLength, ''< DiagnosticCode.NotAssignable,lu:await ${promise}>' can only accept promise type of parameter.')
	// 	return
	// }
}


function diagnoseFor(
	part: TemplatePart,
	start: number,
	length: number,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	if (!parseForHeader(part.node, template.valueNodes, template.helper)) {
		modifier.add(start, length, DiagnosticCode.MissingArgument,
			"Use '<lu:for ${item} of ${list}>' or '<lu:for ${item, index} of ${list}>'.")
	}
}

function diagnoseIf(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:if \${...}>' must accept a parameter as condition.`)
		return
	}
}


function diagnoseElseIf(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:elseif \${...}>' must accept a parameter as condition.`)
		return
	}

	let previousNode = part.node.previousSibling
	if (!previousNode || (previousNode.tagName !== 'lu:if' && previousNode.tagName !== 'lu:elseif')) {
		modifier.add(start, length, DiagnosticCode.ControlTagMustFollowSpecified, `'<lu:elseif>' must follow '<lu:if>' or '<lu:elseif>'.`)
		return
	}
}


function diagnoseElse(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex !== null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:else \${...}>' can not accept any condition parameter.`)
		return
	}

	let previousNode = part.node.previousSibling
	if (!previousNode || (previousNode.tagName !== 'lu:if' && previousNode.tagName !== 'lu:elseif')) {
		modifier.add(start, length, DiagnosticCode.ControlTagMustFollowSpecified, `'<lu:else>' must follow '<lu:if>' or '<lu:elseif>'.`)
		return
	}
}


function diagnoseKeyed(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:keyed \${...}>' must accept a parameter as key.`)
		return
	}
}


function diagnoseSwitch(
	part: TemplatePart,
	start: number,
	length: number,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:switch \${...}>' must accept a parameter as switch expression.`)
		return
	}

	for (let child of part.node.children) {
		if (child.type !== HTMLNodeType.Tag || (child.tagName !== 'lu:case' && child.tagName !== 'lu:default')) {
			let start = template.localOffsetToGlobal(child.start)
			let length = template.localOffsetToGlobal(child.end) - start

			modifier.add(start, length, DiagnosticCode.ControlTagMustContainSpecified, `'<lu:switch>' can only contain '<lu:case>' or '<lu:default>'.`)
			return
		}
	}
}


function diagnoseCase(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:case \${...}>' must accept a parameter as case condition.`)
		return
	}

	let parentNode = part.node.parent
	if (!parentNode || parentNode.tagName !== 'lu:switch') {
		modifier.add(start, length, DiagnosticCode.ControlTagMustBeContainedIn, `'<lu:case>' must be contained in '<lu:switch>'.`)
		return
	}
}


function diagnoseDefault(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex !== null) {
		modifier.add(start, length, DiagnosticCode.MissingArgument, `'<lu:default \${...}>' can not accept any condition parameter.`)
		return
	}

	let parentNode = part.node.parent
	if (!parentNode || parentNode.tagName !== 'lu:switch') {
		modifier.add(start, length, DiagnosticCode.ControlTagMustBeContainedIn, `'<lu:default>' must be contained in '<lu:switch>'.`)
		return
	}

	let nextNode = part.node.nextSibling
	if (nextNode) {
		modifier.add(start, length, DiagnosticCode.ControlTagMustBeLastChild, `'<lu:default>' must be the last child of '<lu:switch>'.`)
		return
	}
}


/** Get value index of slot `<lu:xx ${...}>`. */
function getAttrValueIndex(node: HTMLNode): number | null {
	let attr = node.attrs?.find(attr => TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name))
	let index = attr ? TemplateSlotPlaceholder.getUniqueSlotIndex(attr.name) : null
	return index
}
