import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {parseAllTemplatePartLocations, TemplateBasis, TemplatePart, TemplatePartLocation, TemplatePartType} from '../template'
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
			let locations = parseAllTemplatePartLocations(part)

			for (let location of locations) {
				this.diagnosePartLocation(location, part, template, modifier)
			}
		}
	}

	private diagnosePartLocation(
		location: TemplatePartLocation,
		part: TemplatePart,
		template: TemplateBasis,
		modifier: DiagnosticModifier
	) {
		// `<A`
		if (part.type === TemplatePartType.Component) {
			diagnoseComponent(location, part, template, modifier, this.analyzer)
		}

		// `<lu:`
		else if (part.type === TemplatePartType.FlowControl) {
			diagnoseControl(location, part, template, modifier)
		}

		// `:xxx`
		else if (part.type === TemplatePartType.Binding) {
			diagnoseBinding(location, part, template, modifier, this.analyzer)
		}

		// `.xxx`
		else if (part.type === TemplatePartType.Property) {
			diagnoseProperty(location, part, template, modifier, this.analyzer)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			diagnoseEvent(location, part, template, modifier, this.analyzer)
		}

		return undefined
	}
}
