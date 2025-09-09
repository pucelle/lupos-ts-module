import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {parseAllTemplatePartPieces, TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartType} from '../template'
import {DiagnosticModifier} from './diagnostic-modifier'
import {diagnoseComponent, diagnoseControl, diagnoseBinding, diagnoseProperty, diagnoseEvent} from './of-parts'


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
			let pieces = parseAllTemplatePartPieces(part)

			for (let piece of pieces) {
				this.diagnosePartLocation(piece, pieces, part, template, modifier)
			}
		}
	}

	private diagnosePartLocation(
		piece: TemplatePartPiece,
		pieces: TemplatePartPiece[],
		part: TemplatePart,
		template: TemplateBasis,
		modifier: DiagnosticModifier
	) {
		// `<A`
		if (part.type === TemplatePartType.Component) {
			diagnoseComponent(piece, part, template, modifier, this.analyzer)
		}

		// `<lu:`
		else if (part.type === TemplatePartType.FlowControl) {
			diagnoseControl(piece, part, template, modifier)
		}

		// `:xxx`
		else if (part.type === TemplatePartType.Binding) {
			diagnoseBinding(piece, part, template, modifier, this.analyzer)
		}

		// `.xxx`
		else if (part.type === TemplatePartType.Property) {
			diagnoseProperty(piece, pieces, part, template, modifier, this.analyzer)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			diagnoseEvent(piece, part, template, modifier, this.analyzer)
		}

		return undefined
	}
}
