import {Analyzer} from '../../analyzer'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticCode} from '../codes'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseProperty(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let mainName = part.mainName!
	let tagName = part.node.tagName!
	let helper = template.helper

	if (piece.type === TemplatePartPieceType.Name) {
		let component = analyzer.getComponentByTagName(tagName, template)
		let property = component ? analyzer.getComponentProperty(component, mainName) : null

		if (component && !property) {
			modifier.add(start, length, DiagnosticCode.NotExistOn, `"${mainName}" is not exist on "<${tagName}>".`)
			return
		}
	
		// Can't compare types correctly, especially when have generic parameter.
		if (component && property) {
			let propertyType = helper.types.typeOf(property.nameNode)
			let valueType = template.getPartValueType(part)

			if (!helper.types.isAssignableTo(valueType, propertyType)) {
				let fromText = helper.types.getTypeFullText(valueType)
				let toText = helper.types.getTypeFullText(propertyType)

				modifier.add(start, length, DiagnosticCode.NotAssignable, `Property value "${fromText}" is not assignable to "${toText}".`)
				return
			}
		}
	}
}