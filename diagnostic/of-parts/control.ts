import type * as TS from 'typescript'
import {TemplateBasis, TemplatePart, TemplatePartLocation} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'
import {HTMLNode, HTMLNodeType, TemplateSlotPlaceholder} from '../../html-syntax'
import {LuposControlFlowTags} from '../../complete-data'


export function diagnoseControl(
	location: TemplatePartLocation,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let start = template.localOffsetToGlobal(location.start)
	let length = template.localOffsetToGlobal(location.end) - start
	let tagName = part.node.tagName!

	if (!LuposControlFlowTags.find(item => item.name === tagName)) {
		modifier.addCustom(start, length, `"<${tagName}>" is not a valid control tag.`)
	}
	
	if (tagName === 'lu:await') {
		diagnoseAwait(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:then') {
		diagnoseThen(part, start, length, template, modifier)
	}
	else if (tagName === 'lu:catch') {
		diagnoseCatch(part, start, length, template, modifier)
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
		modifier.addMissingArgument(start, length, '"<lu:await ${...}>" must accept a parameter as promise to await.')
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

	// 	modifier.addNotAssignable(valueStart, valueLength, '"<lu:await ${promise}>" can only accept promise type of parameter.')
	// 	return
	// }
}


function diagnoseThen(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let previousNode = part.node.previousSibling
	if (!previousNode || previousNode.tagName !== 'lu:await') {
		modifier.addCustom(start, length, '"<lu:then>" must follow "<lu:await>".')
		return
	}
}


function diagnoseCatch(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let previousNode = part.node.previousSibling
	if (!previousNode || (previousNode.tagName !== 'lu:await' && previousNode.tagName !== 'lu:then')) {
		modifier.addCustom(start, length, '"<lu:catch>" must follow "<lu:await>" or "<lu:then>".')
		return
	}
}


function diagnoseFor(
	part: TemplatePart,
	start: number,
	length: number,
	template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let helper = template.helper
	let types = helper.types

	let ofValueIndex = getAttrValueIndex(part.node)
	let fnValueIndex = getUniqueChildValueIndex(part.node)
	let dataItemsType: TS.Type | undefined

	if (ofValueIndex === null) {
		modifier.addMissingArgument(start, length, '"<lu:for ${...}>" must accept a parameter as loop data.')
		return
	}

	let ofValueNode = template.valueNodes[ofValueIndex]
	let ofValueStart = ofValueNode.pos
	let ofValueLength = ofValueNode.end - ofValueNode.pos

	dataItemsType = types.typeOf(ofValueNode)

	if (!types.isIterableType(dataItemsType)) {
		modifier.addNotAssignable(ofValueStart, ofValueLength, '"<lu:for ${iterable}>" can only accept iterable type of parameter.')
		return
	}

	if (fnValueIndex === null) {
		modifier.addMissingArgument(start, length, '"<lu:for>${...}</>" must accept a child item renderer as parameter.')
		return
	}

	let fnValueNode = template.valueNodes[fnValueIndex]
	let decl = helper.isFunctionLike(fnValueNode) ? fnValueNode : helper.symbol.resolveDeclaration(fnValueNode, helper.isFunctionLike)

	if (!decl) {
		let fnValueStart = fnValueNode.pos
		let fnValueLength = fnValueNode.end - fnValueNode.pos

		modifier.addNotAssignable(fnValueStart, fnValueLength, '"<lu:for>${renderer}</>" must accept a render function as parameter.')
		return
	}

	// let fnValueNode = template.valueNodes[fnValueIndex]
	// let fnValueStart = fnValueNode.pos
	// let fnValueLength = fnValueNode.end - fnValueNode.pos
	// let decl = helper.isFunctionLike(fnValueNode) ? fnValueNode : helper.symbol.resolveDeclaration(fnValueNode, helper.isFunctionLike)
	// let returnType = decl ? types.getReturnType(decl) : undefined
	// let parameterTypes = decl ? decl.parameters.map(param => types.typeOf(param)) : undefined

	// if (!decl) {
	// 	modifier.addNotAssignable(fnValueStart, fnValueLength, '"<lu:for>${renderer}</>" must accept a render function as parameter.')
	// 	return
	// }

	// let returnedTypeName = returnType ? types.getTypeReferenceName(returnType) : undefined
	// if (returnedTypeName && returnedTypeName !== 'TemplateResult' && returnedTypeName !== 'any') {
	// 	modifier.addNotAssignable(fnValueStart, fnValueLength, '"renderer" of "<lu:for ${renderer}>" must return a "TemplateResult".')
	// 	return
	// }

	// if (parameterTypes) {

	// 	// Always return `any`...
	// 	let dataItemType = dataItemsType ? types.getTypeParameters(dataItemsType)?.[0] : undefined
	// 	let dataItemParamType1 = parameterTypes[0]
	// 	let dataItemParamType2 = parameterTypes[1]

	// 	if (dataItemType && dataItemParamType1 && !types.isAssignableTo(dataItemParamType1, dataItemType)) {
	// 		let fromText = types.getTypeFullText(dataItemParamType1)
	// 		let toText = types.getTypeFullText(dataItemType)

	// 		modifier.addNotAssignable(fnValueStart, fnValueLength, `Render item parameter "${fromText}" is not assignable to "${toText}".`)
	// 		return
	// 	}

	// 	if (dataItemParamType2 && !types.isAssignableTo(dataItemParamType2, typeChecker.getNumberType())) {
	// 		let fromText = types.getTypeFullText(dataItemParamType2)
	// 		modifier.addNotAssignable(fnValueStart, fnValueLength, `Render index parameter "${fromText}" is not assignable to "number".`)
	// 	}
	// }
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
		modifier.addMissingArgument(start, length, '"<lu:if ${...}>" must accept a parameter as condition.')
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
		modifier.addMissingArgument(start, length, '"<lu:elseif ${...}>" must accept a parameter as condition.')
		return
	}

	let previousNode = part.node.previousSibling
	if (!previousNode || (previousNode.tagName !== 'lu:if' && previousNode.tagName !== 'lu:elseif')) {
		modifier.addCustom(start, length, '"<lu:elseif>" must follow "<lu:if>" or "<lu:elseif>".')
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
		modifier.addMissingArgument(start, length, '"<lu:else ${...}>" can not accept any condition parameter.')
		return
	}

	let previousNode = part.node.previousSibling
	if (!previousNode || (previousNode.tagName !== 'lu:if' && previousNode.tagName !== 'lu:elseif')) {
		modifier.addCustom(start, length, '"<lu:else>" must follow "<lu:if>" or "<lu:elseif>".')
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
		modifier.addMissingArgument(start, length, '"<lu:keyed ${...}>" must accept a parameter as key.')
		return
	}
}


function diagnoseSwitch(
	part: TemplatePart,
	start: number,
	length: number,
	_template: TemplateBasis,
	modifier: DiagnosticModifier
) {
	let conditionIndex = getAttrValueIndex(part.node)
	if (conditionIndex === null) {
		modifier.addMissingArgument(start, length, '"<lu:switch ${...}>" must accept a parameter as switch expression.')
		return
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
		modifier.addMissingArgument(start, length, '"<lu:case ${...}>" must accept a parameter as case condition.')
		return
	}

	let parentNode = part.node.parent
	if (!parentNode || parentNode.tagName !== 'lu:switch') {
		modifier.addCustom(start, length, '"<lu:case>" must be contained by "<lu:switch>".')
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
		modifier.addMissingArgument(start, length, '"<lu:default ${...}>" can not accept any condition parameter.')
		return
	}

	let parentNode = part.node.parent
	if (!parentNode || parentNode.tagName !== 'lu:switch') {
		modifier.addCustom(start, length, '"<lu:default>" must be contained by "<lu:switch>".')
		return
	}
}


/** Get value index of slot `<lu:xx ${...}>`. */
function getAttrValueIndex(node: HTMLNode): number | null {
	let attr = node.attrs?.find(attr => TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name))
	let index = attr ? TemplateSlotPlaceholder.getUniqueSlotIndex(attr.name) : null
	return index
}


/** Get value index of slot `<lu:xx>${...}<>`. */
function getUniqueChildValueIndex(node: HTMLNode): number | null {
	if (node.children.length === 0) {
		return null
	}

	let childNode = node.children.find(n => {
		return n.type === HTMLNodeType.Text
			&& TemplateSlotPlaceholder.isCompleteSlotIndex(n.text!.trim())
	})

	let index = childNode ? TemplateSlotPlaceholder.getUniqueSlotIndex(childNode.text!.trim()) : null

	return index
}

