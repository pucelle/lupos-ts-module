import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {parseAllTemplatePartPieces, TemplateBasis, TemplatePart, TemplatePartPiece, TemplatePartType} from '../template'
import {DiagnosticModifier} from './diagnostic-modifier'
import {diagnoseComponent, diagnoseControl, diagnoseBinding, diagnoseProperty, diagnoseEvent} from './of-parts'
import {HTMLSyntaxErrorType} from '../html-syntax'
import {DiagnosticCode} from './codes'


/** Provide diagnostic service for a template. */
export class TemplateDiagnostics {

	readonly analyzer: Analyzer
	readonly helper: Helper

	constructor(analyzer: Analyzer) {
		this.analyzer = analyzer
		this.helper = analyzer.helper
	}

	/** Diagnose structural HTML errors before template parsers modify the tree. */
	diagnoseHTMLSyntax(template: TemplateBasis, modifier: DiagnosticModifier) {
		let category = this.helper.ts.DiagnosticCategory.Warning

		for (let error of template.root.syntaxErrors) {
			let start = template.localOffsetToGlobal(error.start)
			let length = Math.max(1, template.localOffsetToGlobal(error.end) - start)

			if (error.type === HTMLSyntaxErrorType.TagNotClosed) {
				modifier.add(start, length, DiagnosticCode.HTMLTagNotClosed, `Tag '<${error.tagName}>' is not closed.`, category)
			}
			else if (error.expectedTagName) {
				modifier.add(
					start,
					length,
					DiagnosticCode.HTMLTagNotMatched,
					`Closing tag '</${error.tagName}>' does not match opening tag '<${error.expectedTagName}>'.`,
					category
				)
			}
			else {
				let closingTag = error.tagName ? `</${error.tagName}>` : '</>'
				modifier.add(start, length, DiagnosticCode.HTMLTagNotMatched, `Closing tag '${closingTag}' has no matching opening tag.`, category)
			}
		}
	}

	diagnose(parts: TemplatePart[], template: TemplateBasis, modifier: DiagnosticModifier) {
		for (let part of parts) {
			this.diagnosePart(part, template, modifier)
		}
	}

	/** Diagnose one part before a compiler callback can modify it. */
	diagnosePart(part: TemplatePart, template: TemplateBasis, modifier: DiagnosticModifier) {
		let pieces = parseAllTemplatePartPieces(part)

		for (let piece of pieces) {
			this.diagnosePartLocation(piece, pieces, part, template, modifier)
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
