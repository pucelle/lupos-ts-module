import {Analyzer} from '../../analyzer'
import {TemplateBasis, TemplatePart, TemplatePartLocation, TemplatePartLocationType} from '../../template'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseProperty(
	location: TemplatePartLocation,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(location.start)
	let length = template.localOffsetToGlobal(location.end) - start
	let mainName = part.mainName!
	let tagName = part.node.tagName!

	if (location.type === TemplatePartLocationType.Name) {
		let component = analyzer.getComponentByTagName(tagName, template)
		let property = component ? analyzer.getComponentProperty(component, mainName) : null

		if (component && !property) {
			modifier.addNotExistOn(start, length, `"${mainName}" is not exist on "<${tagName}>".`)
			return
		}

		// Can't compare types well, especially when have generic parameter.
		// if (component && property) {
		// 	let propertyType = property.type
		// 	let valueType = template.getPartValueType(part)

		// 	if (!helper.types.isAssignableTo(valueType, propertyType)) {
		// 		let fromText = helper.types.getTypeFullText(valueType)
		// 		let toText = helper.types.getTypeFullText(propertyType)

		// 		modifier.addNotAssignable(start, length, `Property type "${fromText}" is not assignable to "${toText}".`)
		// 		return
		// 	}
		// }
	}
}