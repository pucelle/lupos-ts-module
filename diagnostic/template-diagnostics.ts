import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {parseAllTemplatePartLocations, TemplateBasis, TemplatePart, TemplatePartLocation, TemplatePartType} from '../template'
import {DiagnosticModifier} from './diagnostic-modifier'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {LuposControlFlowTags} from '../complete-data'


/** Provide diagnostic service for a template. */
export class TemplateDiagnostics {

	readonly analyzer: Analyzer
	readonly helper: Helper

	constructor(analyzer: Analyzer) {
		this.analyzer = analyzer
		this.helper = analyzer.helper
	}

	diagnose(parts: TemplatePart[], template: TemplateBasis, modifier: DiagnosticModifier) {
		for (let part of parts) {
			let locations = parseAllTemplatePartLocations(part)

			for (let location of locations) {
				this.diagnosePartLocation(location, part, template, modifier)
			}
		}
	}

	private diagnosePartLocation(
		_location: TemplatePartLocation,
		part: TemplatePart,
		template: TemplateBasis,
		modifier: DiagnosticModifier
	) {
		let gloStart = template.localOffsetToGlobal(part.start)
		let length = part.end - part.start

		// `<A|`
		if (part.type === TemplatePartType.Component) {
			this.diagnoseComponent(part, gloStart, length, template, modifier)
		}

		// `<lu:|`
		else if (part.type === TemplatePartType.FlowControl) {
			this.diagnoseControl(part, gloStart, length, template, modifier)
		}

		return undefined
	}

	private diagnoseComponent(
		part: TemplatePart,
		start: number,
		length: number,
		template: TemplateBasis,
		modifier: DiagnosticModifier
	) {
		let tagName = part.node.tagName!

		if (TemplateSlotPlaceholder.isNamedComponent(tagName)) {
			let decl = template.getReferenceByName(tagName)
			if (decl) {
				modifier.deleteNeverRead(decl)
			}
			else {
				modifier.addMissingImport(start, length, `Component "<${tagName}>" is not imported or declared.`)
			}
		}
		else {
			let valueIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)
			if (valueIndex === null) {
				modifier.addMustBeComponent(start, length, `Must be a component!`)
			}
			else {
				let valueNode = template.valueNodes[valueIndex]
				if (!this.helper.ts.isClassDeclaration(valueNode) || !this.helper.class.isDerivedOf(valueNode, 'Component', '@pucelle/lupos.js')) {
					modifier.addMustBeComponent(start, length, `"${this.helper.getFullText(valueNode)}" is not a component.`)
				}
			}
		}
	}

	private diagnoseControl(
		part: TemplatePart,
		start: number,
		length: number,
		_template: TemplateBasis,
		modifier: DiagnosticModifier
	) {
		let tagName = part.node.tagName!

		if (!LuposControlFlowTags.find(item => item.name === tagName)) {
			modifier.addCustom(start, length, `"<${tagName}>" is not a valid control tag.`)
		}
		
		if (tagName === 'lu:await') {
			let promiseIndex = this.getAttrValueIndex(part.node)
			if (promiseIndex === null) {
				modifier.addCustom(start, length, '<lu:await ${...}> must accept a parameter as promise to await!')
			}
		}

	}

	/** Get value index of slot `<lu:xx ${...}>`. */
	protected getAttrValueIndex(node: HTMLNode): number | null {
		let attrName = node.attrs?.find(attr => TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name))?.name
		let index = attrName ? TemplateSlotPlaceholder.getUniqueSlotIndex(attrName) : null

		return index
	}
}
