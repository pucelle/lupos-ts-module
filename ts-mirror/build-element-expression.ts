import {HTMLNode} from '../html-syntax'
import {TemplateBasis} from '../template'


/** A typed stand-in for the attached element, shared by properties and bindings. */
export function buildElementExpression(node: HTMLNode, template: TemplateBasis, componentName?: string): string {
	if (componentName) {
		return `${componentName}.el`
	}

	if (node.tagName === 'template' && template.component) {
		return 'this.el'
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

	return `(null! as (${mapName} & Record<string, ${svg ? 'SVGElement' : 'HTMLElement'}>)[${tagName}])`
}
