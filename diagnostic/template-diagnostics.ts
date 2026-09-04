import type TS from 'typescript'
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

	/** A root `<template>` mutates the context element, so it can't be one of several function results. */
	diagnoseFunctionContextTemplate(template: TemplateBasis, modifier: DiagnosticModifier) {
		let rootTemplateNode = template.root.firstChild
		if (rootTemplateNode?.tagName !== 'template') {
			return
		}

		let ts = this.helper.ts
		let owner = this.helper.findOutward(template.node, this.helper.isFunctionLike)
		if (!owner?.body) {
			return
		}

		let taggedTemplate = template.node.parent
		if (!ts.isTaggedTemplateExpression(taggedTemplate)) {
			return
		}

		let returnedExpression: TS.Expression | undefined
		let returnCount = 0
		
		// () => html`...`.
		if (ts.isArrowFunction(owner) && !ts.isBlock(owner.body)) {
			returnedExpression = owner.body
			returnCount = 1
		}

		// function() {return html`...`}
		else {

			// Find the ancestral return statement.
			let containingReturn: TS.ReturnStatement | undefined
			for (let node: TS.Node | undefined = taggedTemplate.parent; node && node !== owner; node = node.parent) {
				if (ts.isReturnStatement(node)) {
					containingReturn = node
					break
				}
			}

			// A context template that is merely constructed inside a function isn't a result.
			if (!containingReturn) {
				return
			}

			let visit = (node: TS.Node) => {
				if (node !== owner.body && this.helper.isFunctionLike(node)) {
					return
				}

				if (ts.isReturnStatement(node)) {
					returnCount++
				}

				ts.forEachChild(node, visit)
			}

			visit(owner.body)
			returnedExpression = containingReturn.expression
		}

		// Resolve (...)
		while (returnedExpression && ts.isParenthesizedExpression(returnedExpression)) {
			returnedExpression = returnedExpression.expression
		}

		if (returnCount === 1 && returnedExpression === taggedTemplate) {
			return
		}

		let start = template.localOffsetToGlobal(rootTemplateNode.nameStart)
		let length = template.localOffsetToGlobal(rootTemplateNode.nameEnd) - start

		modifier.add(
			start,
			length,
			DiagnosticCode.ContextTemplateMustBeOnlyReturn,
			`A function that returns '<template>' must use it as its only return value.`
		)
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
			this.diagnosePartLocation(piece, part, template, modifier)
		}
	}

	private diagnosePartLocation(
		piece: TemplatePartPiece,
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
			diagnoseProperty(piece, part, template, modifier, this.analyzer)
		}

		// `@xxx` or `@@xxx`
		else if (part.type === TemplatePartType.Event) {
			diagnoseEvent(piece, part, template, modifier, this.analyzer)
		}

		return undefined
	}
}
