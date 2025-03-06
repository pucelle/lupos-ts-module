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
	
		// Can't compare types well, especially when have generic parameter.
		if (component && property) {
			let propertyType = property.type
			let valueType = template.getPartValueType(part)

			if (!helper.types.isAssignableTo(valueType, propertyType)) {
				let fromTypeSymbol = valueType.symbol
				let toTypeSymbol = propertyType.symbol
				
				// let fromTypeNode = helper.types.typeToTypeNode(valueType)
				// let ToTypeNode = helper.types.typeToTypeNode(propertyType)
				let fromText = helper.types.getTypeFullText(valueType)
				let toText = helper.types.getTypeFullText(propertyType)

				modifier.add(start, length, DiagnosticCode.NotAssignable, `Property type "${fromText}" is not assignable to "${toText}", ${fromTypeSymbol === toTypeSymbol}.`)
				return
			}
		}
	}
}