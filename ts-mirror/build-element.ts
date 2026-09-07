import type TS from 'typescript'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {TemplateBasis} from '../template'


/** A typed stand-in for the attached element, shared by properties and bindings. */
export function buildElementExpression(node: HTMLNode, template: TemplateBasis, componentName?: string): string {
	if (componentName) {
		return `(${componentName}.el as ${buildElementType(node, template)})`
	}

	if (node.tagName === 'template' && template.component) {
		return `(this.el as ${buildElementType(node, template)})`
	}

	return `(null! as ${buildElementType(node, template)})`
}

/** Build the concrete attached element type for an element or component node. */
export function buildElementType(node: HTMLNode, template: TemplateBasis): string {
	if (node.tagName === 'template' && template.component) {
		return buildHTMLTagType(getComponentTagName(template.component, template))
	}

	if (TemplateSlotPlaceholder.isComponent(node.tagName!)) {
		let component = [...template.resolveComponentDeclarations(node.tagName!)][0]
		let tagName = component ? getComponentTagName(component, template) : 'div'

		return buildHTMLTagType(tagName)
	}

	let svg = template.tagName === 'svg'

	for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
		if (ancestor.tagName === 'foreignObject') {
			svg = false
			break
		}

		if (ancestor.tagName === 'svg') {
			svg = true
			break
		}
	}

	if (node.tagName === 'svg') {
		svg = true
	}

	let mapName = svg ? 'SVGElementTagNameMap' : 'HTMLElementTagNameMap'
	let tagName = JSON.stringify(node.tagName!)

	return `(${mapName} & Record<string, ${svg ? 'SVGElement' : 'HTMLElement'}>)[${tagName}]`
}

/** Get the first declared static tag name from a component class chain. */
function getComponentTagName(component: TS.ClassDeclaration, template: TemplateBasis): string {
	let {helper} = template
	let {ts} = helper

	for (let declaration of helper.class.walkSelfAndChainedSuper(component)) {
		for (let member of declaration.members) {
			if (!ts.isPropertyDeclaration(member)
				|| helper.objectLike.getMemberName(member) !== 'tagName'
				|| !helper.objectLike.hasModifier(member, 'static')
			) {
				continue
			}

			let type = member.type
			if (type
				&& ts.isLiteralTypeNode(type)
				&& ts.isStringLiteral(type.literal)
			) {
				return type.literal.text
			}

			return 'div'
		}
	}

	return 'div'
}

/** Map an HTML tag name to its concrete element type with an HTMLElement fallback. */
function buildHTMLTagType(tagName: string): string {
	return `(HTMLElementTagNameMap & Record<string, HTMLElement>)[${JSON.stringify(tagName)}]`
}
