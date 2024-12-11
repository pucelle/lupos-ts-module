import {TemplateBasis, TemplatePart, TemplatePartLocation} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'
import {TemplateSlotPlaceholder} from '../../html-syntax'
import {Analyzer} from '../../analyzer'


export function diagnoseComponent(
	location: TemplatePartLocation,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(location.start)
	let length = template.localOffsetToGlobal(location.end) - start
	let helper = template.helper
	let tagName = part.node.tagName!
	let ts = helper.ts

	if (TemplateSlotPlaceholder.isNamedComponent(tagName)) {
		let ref = template.getReferenceByName(tagName)
		if (ref) {
			modifier.deleteNeverRead(ref)
		}

		let component = analyzer.getComponentByTagName(tagName, template)
		if (!component) {
			modifier.addMissingImport(start, length, `Component "<${tagName}>" is not imported or declared.`)
			return
		}
		else if (!helper.class.isDerivedOf(component.declaration, 'Component', '@pucelle/lupos.js')) {
			modifier.addNotAssignable(start, length, `"<${tagName}>" is not a component.`)
			return
		}
	}
	else {
		let valueIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)
		if (valueIndex === null) {
			modifier.addNotAssignable(start, length, `Must be a component!`)
			return
		}
		else {
			let valueNode = template.valueNodes[valueIndex]

			let decl = helper.symbol.resolveDeclaration(valueNode, ts.isClassDeclaration)
			if (!decl || !helper.class.isDerivedOf(decl, 'Component', '@pucelle/lupos.js')) {
				modifier.addNotAssignable(start, length, `"${helper.getFullText(valueNode)}" is not a component.`)
				return
			}
		}
	}
}