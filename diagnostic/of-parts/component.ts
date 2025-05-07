import {TemplateBasis, TemplatePart, TemplatePartPiece} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'
import {TemplateSlotPlaceholder} from '../../html-syntax'
import {Analyzer} from '../../analyzer'
import {DiagnosticCode} from '../codes'


export function diagnoseComponent(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let helper = template.helper
	let tagName = part.node.tagName!
	let ts = helper.ts

	if (TemplateSlotPlaceholder.isNamedComponent(tagName)) {
		let ref = template.getReferenceByName(tagName)
		if (ref) {
			modifier.deleteNeverReadFromNodeExtended(ref)
		}

		let component = analyzer.getComponentByTagName(tagName, template)
		if (!component) {
			modifier.add(start, length, DiagnosticCode.MissingImportOrDeclaration, `Component "<${tagName}>" is not imported or declared.`)
			return
		}
		else if (!helper.objectLike.isDerivedOf(component.declaration, 'Component', '@pucelle/lupos.js')) {
			modifier.add(start, length, DiagnosticCode.NotAssignable, `"<${tagName}>" is not a component.`)
			return
		}
	}
	else {
		let valueIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)
		if (valueIndex === null) {
			modifier.add(start, length, DiagnosticCode.NotAssignable, `Must be a component!`)
			return
		}
		else {
			let valueNode = template.valueNodes[valueIndex]

			let decl = helper.symbol.resolveDeclaration(valueNode, ts.isClassDeclaration)
			if (!decl || !helper.objectLike.isDerivedOf(decl, 'Component', '@pucelle/lupos.js')) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `"${helper.getFullText(valueNode)}" is not a component.`)
				return
			}
		}
	}
}