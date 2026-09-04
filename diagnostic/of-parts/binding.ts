import {Analyzer} from '../../analyzer'
import {LuposKnownInternalBindings} from '../../complete-data'
import {TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartPieceType} from '../../template'
import {DiagnosticCode} from '../codes'
import {DiagnosticModifier} from '../diagnostic-modifier'


export function diagnoseBinding(
	piece: TemplatePartPiece,
	part: TemplatePart,
	template: TemplateBasis,
	modifier: DiagnosticModifier,
	analyzer: Analyzer
) {
	let start = template.localOffsetToGlobal(piece.start)
	let length = template.localOffsetToGlobal(piece.end) - start
	let helper = template.helper
	let mainName = part.mainName!

	if (piece.type === TemplatePartPieceType.Name) {
		let binding = analyzer.getBindingByName(mainName, template)
		if (!binding && !LuposKnownInternalBindings[mainName]) {
			modifier.add(start, length, DiagnosticCode.MissingImportOrDeclaration, `Binding class '${mainName}' is not existing.`)
			return
		}

		if (part.namePrefix === '?:') {
			let implementsPart = true
			if (binding) {
				implementsPart = binding.declaration && helper.class.isImplementedOf(binding.declaration, 'Part', 'lupos.html')
			}
			else if (LuposKnownInternalBindings[mainName]) {
				implementsPart = LuposKnownInternalBindings[mainName].implementsPart
			}

			if (!implementsPart) {
				modifier.add(start, length, DiagnosticCode.NotAssignable, `Binding class '${mainName}' must implement 'Part' to work with partial identifier '?:'.`)
			}
		}
	}
}
