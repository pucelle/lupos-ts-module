import {buildScope} from './build-scope'
import {buildControlFlow, isMirrorControl} from './build-control-flow'
import type TS from 'typescript'
import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {HTMLNode, HTMLRoot, TemplateSlotPlaceholder} from '../html-syntax'
import {ScopeTree} from '../scope'
import {TemplateBasis, TemplatePart, TemplatePartParser, TemplatePartType} from '../template'
import {AllCapabilities} from './mirror-builder'
import {MirrorInsertion, RelativeMapping} from './insertion-types'


/** Concrete template basis for non-mutating semantic parsing. */
class MirrorTemplate extends TemplateBasis {}


/**
 * Build the prefix that wraps a single `html`/`svg` expression.
 *
 * Conceptually:
 * `( (() => { let i = new Card(); i.count = value })(), html`...` )`
 *
 * The original tagged template is the final comma operand, so the mirror keeps
 * its value and contextual type. The IIFE supplies a statement scope for
 * reusable component instances without introducing names into user scope.
 */
export function buildTemplateInsertion(
	node: TS.TaggedTemplateExpression,
	helper: Helper,
	scopeTree: ScopeTree,
	analyzer: Analyzer,
	createIdentifier: () => string
): MirrorInsertion | null {

	// Resolve aliases as well as direct imports, and ignore unrelated tagged
	// templates so ordinary TypeScript files do not acquire mirror scaffolding.
	let imported = helper.symbol.resolveImport(node.tag)
	if (!imported
		|| imported.moduleName !== 'lupos.html'
		|| imported.memberName !== 'html' && imported.memberName !== 'svg'
	) {
		return null
	}

	let {string, mapper} = TemplateSlotPlaceholder.toTemplateContent(node.template)
	let values = TemplateSlotPlaceholder.extractTemplateValues(node.template)
	let root = HTMLRoot.fromString(string)

	let template = new MirrorTemplate(
		imported.memberName as 'html' | 'svg',
		node.template,
		string,
		root,
		values,
		mapper,
		scopeTree,
		helper
	)

	// Parsing is non-mutating. Parts are collected first because component tags
	// must own the property parts reported later for the same HTML node.
	let parts: TemplatePart[] = []

	let parser = new TemplatePartParser(root, values, false, part => {
		parts.push(part)
	}, helper)

	parser.parse()
	return buildTemplateChecks(node, template, parts, analyzer, createIdentifier)
}


/** Emit semantic checks in the lexical scopes established by control tags. */
function buildTemplateChecks(
	node: TS.TaggedTemplateExpression,
	template: TemplateBasis,
	parts: TemplatePart[],
	analyzer: Analyzer,
	createIdentifier: () => string
): MirrorInsertion | null {
	let {sourceFile, helper, valueNodes: values} = template

	// The first `(` begins the outer comma expression; the second begins the IIFE.
	let text = '((() => {'
	let mappings: RelativeMapping[] = []
	let checkSpans: MirrorInsertion['checks'] = []
	let sourceDiagnosticExclusions: TS.TextSpan[] = []

	let controlNodes = new Set(
		parts.filter(part => {
			return part.type === TemplatePartType.FlowControl
				&& isMirrorControl(part.node, values, helper)
		}).map(part => part.node)
	)

	let closestControl = (node: HTMLNode): HTMLNode | null => {
		for (let parent = node.parent; parent; parent = parent.parent) {
			if (controlNodes.has(parent)) {
				return parent
			}
		}
		return null
	}

	let copy = (value: TS.Expression) => {
		let start = text.length
		text += sourceFile.text.slice(value.getStart(sourceFile), value.getEnd())

		mappings.push({start,
			end: text.length,
			originalStart: value.getStart(sourceFile),
			originalEnd: value.getEnd(),
			kind: 'copied-expression',
			capabilities: AllCapabilities
		})

		sourceDiagnosticExclusions.push({start: value.getStart(sourceFile), length: value.getWidth(sourceFile)})
	}

	let allParts = parts

	let emitScope = (scope: HTMLNode | null) => {
		let parts = allParts.filter(part => closestControl(part.node) === scope)
		let checks = buildScope(parts, template, analyzer, createIdentifier)
		let offset = text.length
		text += checks.text

		mappings.push(...checks.mappings.map(mapping => ({
			...mapping,
			start: mapping.start + offset,
			end: mapping.end + offset,
		})))

		checkSpans.push(...checks.checks.map(check => ({
			...check,
			start: check.start + offset,
			end: check.end + offset,
		})))

		sourceDiagnosticExclusions.push(...checks.sourceDiagnosticExclusions)

		if (scope) {
			// Content and ordinary attribute expressions also need the loop's lexical scope.
			let checked = new Set(
				parts.filter(part => {
					return part.type === TemplatePartType.Binding
						|| part.type === TemplatePartType.Property
					}
				).flatMap(part => !part.strings ? part.valueIndices?.map(v => v.index) ?? [] : [])
			)
			
			for (let part of parts) {
				if (controlNodes.has(part.node)) {
					continue
				}

				let indices = part.valueIndices?.map(value => value.index) ?? []

				if (part.type === TemplatePartType.FlowControl) {
					indices.push(
						...(part.node.attrs ?? []).flatMap(
							attr =>
								TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name)
									? [TemplateSlotPlaceholder.getUniqueSlotIndex(attr.name)!]
									: []
						)
					)
				}

				for (let index of indices) {
					if (checked.has(index)) {
						continue
					}

					checked.add(index)
					text += 'void ('; copy(values[index]); text += ');'
				}
			}
		}
		for (let control of controlNodes) {
			if (closestControl(control) !== scope) {
				continue
			}

			buildControlFlow(control, values, helper, {
				write: value => { text += value },
				copy,
				position: () => text.length,
				check: (start, node) => {
					mappings.push({
						start,
						end: text.length,
						originalStart: node.getStart(sourceFile),
						originalEnd: node.getEnd(),
						kind: 'scaffold',
						capabilities: ['diagnostic']
					})

					checkSpans.push({
						start,
						end: text.length,
						fallbackStart: node.getStart(sourceFile),
						fallbackEnd: node.getEnd()
					})
				},
				exclude: node => {
					sourceDiagnosticExclusions.push({
						start: node.getStart(sourceFile),
						length: node.getWidth(sourceFile)
					})
				},
				children: emitScope,
				identifier: createIdentifier,
			})
		}
	}
	emitScope(null)
	if (text === '((() => {') {
		return null
	}
	// Close and invoke the IIFE, then leave a comma for the original template.
	text += '})(),'

	return {
		offset: node.getStart(sourceFile),
		endOffset: node.getEnd(),
		text,
		mappings,
		checks: checkSpans,
		sourceDiagnosticExclusions,
	}
}
