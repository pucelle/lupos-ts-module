import type TS from 'typescript'
import {Analyzer, LuposComponent} from '../analyzer'
import {helperOfContext, Helper} from '../helper'
import {HTMLNode, HTMLRoot, TemplateSlotPlaceholder} from '../html-syntax'
import {ScopeTree} from '../scope'
import {TemplateBasis, TemplatePart, TemplatePartParser, TemplatePartType, parseForHeader} from '../template'
import {MirrorCapability, MirrorCheckSpan, MirrorDocument, MirrorMapping, MirrorMappingKind} from './types'
import {buildBindingCheck} from './binding-check'
import {buildPropertyCheck} from './property-check'
import {buildElementExpression} from './element-expression'
import {LuposKnownInternalBindings} from '../complete-data'


/** Exact source copies, property names, and values are safe for every consumer. */
export const AllCapabilities: readonly MirrorCapability[] = ['diagnostic', 'completion', 'definition', 'hover', 'references', 'rename']

/**
 * Component/binding anchors exist to give TypeScript a real symbol reference.
 * Diagnostics on those generated anchors are artificial and must be discarded.
 */
const NavigationCapabilities: readonly MirrorCapability[] = ['completion', 'definition', 'hover', 'references', 'rename']

/** Mapping whose mirror offsets are relative to the start of one insertion. */
export interface RelativeMapping {
	start: number
	end: number
	originalStart: number
	originalEnd: number
	kind: MirrorMappingKind
	capabilities: readonly MirrorCapability[]
}

/** Generated assignment plus its mappings and original diagnostic fallback. */
export interface MirrorCheck {
	text: string
	fallbackStart: number
	fallbackEnd: number
	mappings: RelativeMapping[]
}

/**
 * Prefix inserted before one tagged template. `endOffset` is later converted
 * to a separate `)` suffix insertion, allowing nested templates to compose
 * without replacing or duplicating their original text.
 */
interface MirrorInsertion {
	offset: number
	endOffset: number
	text: string
	mappings: RelativeMapping[]
	checks: {start: number, end: number, fallbackStart: number, fallbackEnd: number}[]
	sourceDiagnosticExclusions?: TS.TextSpan[]
}

/** One component element and the generated instance shared by its properties. */
interface ComponentUse {
	node: HTMLNode
	tagName: string
	component: LuposComponent
	instanceName: string
	constructorValue?: TS.Expression
}

class MirrorTemplate extends TemplateBasis {}


/**
 * Build one mirror for a complete source file.
 *
 * The traversal only records insertions. `applyInsertions` subsequently merges
 * all prefixes and suffixes with the untouched source, so nested tagged
 * templates remain structurally valid and retain precise source mappings.
	 * Returns `null` when the file has no component, property, binding, or loop use
 * requiring a mirror Program.
 */
export function buildTypeScriptMirror(
	ts: typeof TS,
	program: TS.Program,
	sourceFile: TS.SourceFile
): MirrorDocument | null {

	// TemplateSlotPlaceholder is shared with the transformer, but this public
	// builder must also work when called directly by a language-service plugin.
	TemplateSlotPlaceholder.initialize(ts)

	// ScopeTree and Analyzer are intentionally shared by every template in this
	// source file. Imported component/binding resolution is otherwise expensive.
	let checker = program.getTypeChecker()
	let helper = helperOfContext(ts, () => checker)
	let scopeTree = new ScopeTree(helper)

	scopeTree.visitSourceFile(sourceFile)

	let analyzer = new Analyzer(helper)
	let insertions: MirrorInsertion[] = []
	let createIdentifier = createIdentifierFactory(sourceFile.text)

	// Collect every template before modifying text. Descending into a tagged
	// template also discovers tagged templates nested inside `${...}` values.
	let visit = (node: TS.Node) => {
		if (ts.isTaggedTemplateExpression(node)) {
			let insertion = buildTemplateInsertion(node, sourceFile, helper, scopeTree, analyzer, createIdentifier)
			if (insertion) {
				insertions.push(insertion)
			}
		}

		ts.forEachChild(node, visit)
	}

	visit(sourceFile)

	if (insertions.length === 0) {
		return null
	}

	return applyInsertions(sourceFile, composeCopiedTemplates(sourceFile, insertions))
}


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
function buildTemplateInsertion(
	node: TS.TaggedTemplateExpression,
	sourceFile: TS.SourceFile,
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

	// The first `(` begins the outer comma expression; the second begins the IIFE.
	let text = '((() => {'
	let mappings: RelativeMapping[] = []
	let checkSpans: MirrorInsertion['checks'] = []
	let sourceDiagnosticExclusions: TS.TextSpan[] = []

	let loopNodes = new Set(parts.filter(part => part.type === TemplatePartType.FlowControl
		&& part.node.tagName === 'lu:for' && parseForHeader(part.node, values, helper)).map(part => part.node))
	let closestLoop = (node: HTMLNode): HTMLNode | null => {
		for (let parent = node.parent; parent; parent = parent.parent) {
			if (loopNodes.has(parent)) return parent
		}
		return null
	}
	let copy = (value: TS.Expression) => {
		let start = text.length
		text += sourceFile.text.slice(value.getStart(sourceFile), value.getEnd())
		mappings.push({start, end: text.length, originalStart: value.getStart(sourceFile), originalEnd: value.getEnd(),
			kind: 'copied-expression', capabilities: AllCapabilities})
		sourceDiagnosticExclusions.push({start: value.getStart(sourceFile), length: value.getWidth(sourceFile)})
	}
	let allParts = parts
	let emitScope = (scope: HTMLNode | null) => {
		let parts = allParts.filter(part => closestLoop(part.node) === scope)
		// First pass: allocate one generated instance per component element. Even a
		// property-less `<Card />` gets an instance, making template-only imports and
		// local declarations visible to TypeScript's unused-symbol analysis.
		let componentUses: ComponentUse[] = []
		let componentByNode: Map<HTMLNode, ComponentUse> = new Map()

		for (let part of parts) {
			if (part.type !== TemplatePartType.Component && part.type !== TemplatePartType.DynamicComponent) {
				continue
			}

			let tagName = part.node.tagName!
			let component = analyzer.getComponentByTagName(tagName, template)
			if (!component) {
				continue
			}

			let use: ComponentUse = {
				node: part.node,
				tagName,
				component,
				instanceName: createIdentifier(),
				constructorValue: part.type === TemplatePartType.DynamicComponent
					? values[TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)!] : undefined,
			}
			componentUses.push(use)
			componentByNode.set(part.node, use)
		}

		let propertyParts = parts.filter(part => part.type === TemplatePartType.Property && !!part.mainName)

		// Every binding use needs its own instance and checked update call.
		let bindingParts = parts.filter(part => {
			return part.type === TemplatePartType.Binding
				&& !!part.mainName
				&& /^[$A-Z_a-z][$\w]*$/.test(part.mainName)
				&& (!!LuposKnownInternalBindings[part.mainName] || !!analyzer.getBindingByName(part.mainName, template))
		})

		if (scope === null && componentUses.length === 0 && bindingParts.length === 0 && propertyParts.length === 0 && !parts.some(part => part.node.tagName === 'lu:for')) {
			return
		}

		for (let use of componentUses) {
			// Constructor errors (required arguments, abstract classes, etc.) are mirror
			// artifacts. Only navigation capabilities are mapped for this identifier,
			// so the provider drops such diagnostics while retaining the symbol usage.
			text += `let ${use.instanceName} = new `
			let componentStart = text.length
			text += use.constructorValue
				? `(${sourceFile.text.slice(use.constructorValue.getStart(sourceFile), use.constructorValue.getEnd())})`
				: use.tagName
			let componentEnd = text.length
			text += '();'

			mappings.push({
				start: componentStart,
				end: componentEnd,
				originalStart: use.constructorValue?.getStart(sourceFile) ?? template.localOffsetToGlobal(use.node.nameStart),
				originalEnd: use.constructorValue?.getEnd() ?? template.localOffsetToGlobal(use.node.nameEnd),
				kind: 'symbol-anchor',
				capabilities: NavigationCapabilities,
			})
		}

		let appendCheck = (check: MirrorCheck, part: TemplatePart) => {
			let checkStart = text.length
			text += check.text
			mappings.push(...check.mappings.map(mapping => ({
				...mapping, start: mapping.start + checkStart, end: mapping.end + checkStart,
			})))
			checkSpans.push({start: checkStart, end: text.length,
				fallbackStart: check.fallbackStart, fallbackEnd: check.fallbackEnd})
			let value = template.getPartUniqueValue(part)
			if (value) {
				sourceDiagnosticExclusions.push({start: value.getStart(sourceFile), length: value.getWidth(sourceFile)})
			}
		}

		let elementsByNode: Map<HTMLNode, string> = new Map()
		for (let part of propertyParts) {
			let component = componentByNode.get(part.node)

			// Match PropertySlotParser: '..' forces the component; '.' prefers an
			// existing component member and otherwise assigns to its attached element.
			let target = component && (part.namePrefix === '..'
				|| helper.types.typeOf(component.component.declaration).getProperty(part.mainName!))
				? component.instanceName : elementsByNode.get(part.node)

			if (!target) {
				// Leave unresolved component tags to the structural component diagnostic.
				if (!component && TemplateSlotPlaceholder.isComponent(part.node.tagName!)) continue
				target = createIdentifier()
				text += `let ${target} = ${buildElementExpression(part.node, template, component?.instanceName)};`
				elementsByNode.set(part.node, target)
			}

			appendCheck(buildPropertyCheck(part, template, sourceFile, target), part)
		}

		let previousBindings: Map<HTMLNode, string> = new Map()

		for (let part of bindingParts) {
			let instanceName = createIdentifier()

			let check = buildBindingCheck(part, template, analyzer, instanceName,
				componentByNode.get(part.node)?.instanceName, previousBindings.get(part.node), createIdentifier)

			appendCheck(check, part)
			previousBindings.set(part.node, instanceName)
		}

		if (scope) {
			// Content and ordinary attribute expressions also need the loop's lexical scope.
			let checked = new Set(parts.filter(part => part.type === TemplatePartType.Binding
				|| part.type === TemplatePartType.Property).flatMap(part => !part.strings ? part.valueIndices?.map(v => v.index) ?? [] : []))
			for (let part of parts) {
				if (loopNodes.has(part.node)) continue
				let indices = part.valueIndices?.map(value => value.index) ?? []
				if (part.type === TemplatePartType.FlowControl) {
					indices.push(...(part.node.attrs ?? []).flatMap(attr =>
						TemplateSlotPlaceholder.isCompleteSlotIndex(attr.name)
							? [TemplateSlotPlaceholder.getUniqueSlotIndex(attr.name)!] : []))
				}
				for (let index of indices) {
					if (checked.has(index)) continue
					checked.add(index)
					text += 'void ('; copy(values[index]); text += ');'
				}
			}
		}
		for (let loop of loopNodes) {
			if (closestLoop(loop) !== scope) continue
			let header = parseForHeader(loop, values, helper)!
			let headerStart = text.length
			text += 'for (let '
			copy(header.names[0])
			text += ' of ('; copy(values[header.iterableIndex]); text += ')) {'
			let iterable = values[header.iterableIndex]
			mappings.push({start: headerStart, end: text.length,
				originalStart: iterable.getStart(sourceFile), originalEnd: iterable.getEnd(),
				kind: 'scaffold', capabilities: ['diagnostic']})
			checkSpans.push({start: headerStart, end: text.length,
				fallbackStart: iterable.getStart(sourceFile), fallbackEnd: iterable.getEnd()})
			text += `void ${header.names[0].text};`
			if (header.names[1]) {
				text += 'let '; copy(header.names[1]); text += ` = 0; void ${header.names[1].text};`
			}
			let declaration = values[header.declarationIndex]
			sourceDiagnosticExclusions.push({start: declaration.getStart(sourceFile), length: declaration.getWidth(sourceFile)})
			emitScope(loop)
			text += '}'
		}
	}
	emitScope(null)
	if (text === '((() => {') return null
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


function createIdentifierFactory(sourceText: string): () => string {
	let index = 0

	return () => {
		// Copied interpolation expressions execute inside the IIFE. Avoiding every
		// identifier already present in the source prevents accidental shadowing.
		let name: string
		do {
			name = `$LUPOS_MIRROR_${index++}`
		}
		while (sourceText.includes(name))

		return name
	}
}

/** Merge all generated prefixes/suffixes with unchanged source text and mappings. */
function applyInsertions(
	sourceFile: TS.SourceFile,
	starts: MirrorInsertion[],
	rangeStart = 0,
	rangeEnd = sourceFile.text.length
): MirrorDocument {
	// A template prefix sorts before its suffix at an equal offset. More
	// importantly, sorting every boundary independently makes nesting work:
	// outer prefix -> source -> inner prefix -> source -> inner suffix -> outer suffix.
	let insertions = [
		...starts,
		...starts.map(insertion => ({
			offset: insertion.endOffset,
			endOffset: insertion.endOffset,
			text: ')',
			mappings: [],
			checks: [],
		})),
	].sort((a, b) => a.offset - b.offset || b.text.length - a.text.length)

	let output = ''
	let originalOffset = rangeStart
	let mappings: MirrorMapping[] = []
	let checkSpans: MirrorCheckSpan[] = []

	for (let insertion of insertions) {
		// Copy source between insertions verbatim and record a broad mapping. More
		// specific generated mappings win later according to MappingPriority.
		if (insertion.offset > originalOffset) {
			let mirrorStart = output.length
			output += sourceFile.text.slice(originalOffset, insertion.offset)
			mappings.push({
				mirrorStart,
				mirrorEnd: output.length,
				originalStart: originalOffset,
				originalEnd: insertion.offset,
				kind: 'source',
				capabilities: AllCapabilities,
			})
			originalOffset = insertion.offset
		}

		// Relative ranges become absolute only after all preceding source and
		// generated text has established this insertion's final mirror offset.
		let insertionStart = output.length
		output += insertion.text

		for (let mapping of insertion.mappings) {
			mappings.push({
				mirrorStart: insertionStart + mapping.start,
				mirrorEnd: insertionStart + mapping.end,
				originalStart: mapping.originalStart,
				originalEnd: mapping.originalEnd,
				kind: mapping.kind,
				capabilities: mapping.capabilities,
			})
		}

		for (let check of insertion.checks) {
			checkSpans.push({
				start: insertionStart + check.start,
				length: check.end - check.start,
				fallbackStart: check.fallbackStart,
				fallbackLength: check.fallbackEnd - check.fallbackStart,
			})
		}
	}

	if (originalOffset < rangeEnd) {
		let mirrorStart = output.length
		output += sourceFile.text.slice(originalOffset, rangeEnd)
		mappings.push({
			mirrorStart,
			mirrorEnd: output.length,
			originalStart: originalOffset,
			originalEnd: rangeEnd,
			kind: 'source',
			capabilities: AllCapabilities,
		})
	}

	return {
		fileName: sourceFile.fileName,
		originalText: sourceFile.text,
		mirrorText: output,
		mappings,
		checkSpans,
		sourceDiagnosticExclusions: starts.flatMap(insertion => insertion.sourceDiagnosticExclusions ?? []),
	}
}


/** Keep nested template checks inside the lexical scope of copied expressions. */
function composeCopiedTemplates(sourceFile: TS.SourceFile, insertions: MirrorInsertion[]): MirrorInsertion[] {
	let moved = new Set<MirrorInsertion>()

	// Children must already contain their own nested checks when copied by a parent.
	for (let insertion of [...insertions].sort((a, b) => b.offset - a.offset)) {
		let children = insertions.filter(child => child !== insertion && !moved.has(child)
			&& child.offset > insertion.offset && child.endOffset < insertion.endOffset)
		let copies = insertion.mappings.filter(mapping => mapping.kind === 'copied-expression')
			.sort((a, b) => b.start - a.start)

		for (let copy of copies) {
			let contained = children.filter(child => child.offset >= copy.originalStart && child.endOffset <= copy.originalEnd)
			if (contained.length === 0) continue

			let nested = applyInsertions(sourceFile, contained, copy.originalStart, copy.originalEnd)
			let delta = nested.mirrorText.length - (copy.end - copy.start)
			let shift = (offset: number) => offset >= copy.end ? offset + delta : offset
			insertion.text = insertion.text.slice(0, copy.start) + nested.mirrorText + insertion.text.slice(copy.end)
			insertion.mappings = insertion.mappings.filter(mapping => mapping.kind !== copy.kind
				|| mapping.start !== copy.start || mapping.end !== copy.end).map(mapping => ({
				...mapping, start: shift(mapping.start), end: shift(mapping.end),
			}))
			insertion.checks = insertion.checks.map(check => ({...check, start: shift(check.start), end: shift(check.end)}))

			insertion.mappings.push(...nested.mappings.flatMap(mapping => {
				if (mapping.kind !== 'source') return [mapping]
				let exclusions = nested.sourceDiagnosticExclusions ?? []
				let boundaries = [...new Set([mapping.originalStart, mapping.originalEnd,
					...exclusions.flatMap(span => [span.start, span.start + span.length])
						.filter(offset => offset > mapping.originalStart && offset < mapping.originalEnd)])].sort((a, b) => a - b)
				return boundaries.slice(0, -1).map((start, index) => ({
					...mapping,
					mirrorStart: mapping.mirrorStart + start - mapping.originalStart,
					mirrorEnd: mapping.mirrorStart + boundaries[index + 1] - mapping.originalStart,
					originalStart: start, originalEnd: boundaries[index + 1],
					kind: exclusions.some(span => start >= span.start && start < span.start + span.length)
						? 'source' as const : 'copied-expression' as const,
				}))
			}).map(mapping => ({
				start: copy.start + mapping.mirrorStart,
				end: copy.start + mapping.mirrorEnd,
				originalStart: mapping.originalStart,
				originalEnd: mapping.originalEnd,
				kind: mapping.kind,
				capabilities: mapping.capabilities,
			})))
			insertion.checks.push(...nested.checkSpans.map(check => ({
				start: copy.start + check.start, end: copy.start + check.start + check.length,
				fallbackStart: check.fallbackStart, fallbackEnd: check.fallbackStart + check.fallbackLength,
			})))
			for (let child of contained) moved.add(child)
		}
	}

	return insertions.filter(insertion => !moved.has(insertion))
}
