import type TS from 'typescript'
import {Analyzer, LuposComponent} from '../analyzer'
import {helperOfContext, Helper} from '../helper'
import {HTMLNode, HTMLRoot, TemplateSlotPlaceholder} from '../html-syntax'
import {ScopeTree} from '../scope'
import {TemplateBasis, TemplatePart, TemplatePartParser, TemplatePartType} from '../template'
import {MirrorCapability, MirrorCheckSpan, MirrorDocument, MirrorMapping, MirrorMappingKind} from './types'


/** Exact source copies, property names, and values are safe for every consumer. */
const AllCapabilities: readonly MirrorCapability[] = ['diagnostic', 'completion', 'definition', 'hover', 'references', 'rename']

/**
 * Component/binding anchors exist to give TypeScript a real symbol reference.
 * Diagnostics on those generated anchors are artificial and must be discarded.
 */
const NavigationCapabilities: readonly MirrorCapability[] = ['completion', 'definition', 'hover', 'references', 'rename']

/** Mapping whose mirror offsets are relative to the start of one insertion. */
interface RelativeMapping {
	start: number
	end: number
	originalStart: number
	originalEnd: number
	kind: MirrorMappingKind
	capabilities: readonly MirrorCapability[]
}

/** Generated assignment plus its mappings and original diagnostic fallback. */
interface MirrorCheck {
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
}

/** One component element and the generated instance shared by its properties. */
interface ComponentUse {
	node: HTMLNode
	tagName: string
	component: LuposComponent
	instanceName: string
	propertyParts: TemplatePart[]
}

class MirrorTemplate extends TemplateBasis {}


/**
 * Build one mirror for a complete source file.
 *
 * The traversal only records insertions. `applyInsertions` subsequently merges
 * all prefixes and suffixes with the untouched source, so nested tagged
 * templates remain structurally valid and retain precise source mappings.
 * Returns `null` when the file contains no resolvable component or binding
 * references and therefore does not need a mirror Program.
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

	return applyInsertions(sourceFile, insertions)
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

	// First pass: allocate one generated instance per component element. Even a
	// property-less `<Card />` gets an instance, making template-only imports and
	// local declarations visible to TypeScript's unused-symbol analysis.
	let componentUses: ComponentUse[] = []
	let componentByNode: Map<HTMLNode, ComponentUse> = new Map()

	// Second pass: attach every `.property` to the instance for its owning tag.
	for (let part of parts) {
		if (part.type !== TemplatePartType.Component) {
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
			propertyParts: [],
		}
		componentUses.push(use)
		componentByNode.set(part.node, use)
	}

	for (let part of parts) {
		if (part.type === TemplatePartType.Property) {
			componentByNode.get(part.node)?.propertyParts.push(part)
		}
	}

	// Binding value checks still use the existing analyzer, but a generated
	// `void BindingName` anchor is enough for unused imports and navigation.
	let bindingParts = parts.filter(part => {
		return part.type === TemplatePartType.Binding
			&& !!part.mainName
			&& /^[$A-Z_a-z][$\w]*$/.test(part.mainName)
			&& !!analyzer.getBindingByName(part.mainName, template)
	})

	if (componentUses.length === 0 && bindingParts.length === 0) {
		return null
	}

	// The first `(` begins the outer comma expression; the second begins the IIFE.
	let text = '((() => {'
	let mappings: RelativeMapping[] = []
	let checkSpans: MirrorInsertion['checks'] = []

	for (let use of componentUses) {
		// Constructor errors (required arguments, abstract classes, etc.) are mirror
		// artifacts. Only navigation capabilities are mapped for this identifier,
		// so the provider drops such diagnostics while retaining the symbol usage.
		text += `let ${use.instanceName} = new `
		let componentStart = text.length
		text += use.tagName
		let componentEnd = text.length
		text += '();'

		mappings.push({
			start: componentStart,
			end: componentEnd,
			originalStart: template.localOffsetToGlobal(use.node.nameStart),
			originalEnd: template.localOffsetToGlobal(use.node.nameEnd),
			kind: 'symbol-anchor',
			capabilities: NavigationCapabilities,
		})

		for (let part of use.propertyParts) {
			// Missing properties stay with structural template diagnostics. Generating
			// only resolvable properties avoids duplicate or misleading TS2339 errors.
			let property = part.mainName && analyzer.getComponentProperty(use.component, part.mainName)
			if (!property) {
				continue
			}

			let check = buildPropertyCheck(part, template, sourceFile, use.instanceName)
			let checkStart = text.length
			text += check.text
			let checkEnd = text.length

			for (let mapping of check.mappings) {
				mappings.push({
					...mapping,
					start: mapping.start + checkStart,
					end: mapping.end + checkStart,
				})
			}

			checkSpans.push({
				start: checkStart,
				end: checkEnd,
				fallbackStart: check.fallbackStart,
				fallbackEnd: check.fallbackEnd,
			})
		}
	}

	// One anchor per binding name is sufficient even if it appears several times
	// in the same template. Each template has its own IIFE scope.
	let anchoredBindings: Set<string> = new Set()

	for (let part of bindingParts) {
		let bindingName = part.mainName!
		if (anchoredBindings.has(bindingName)) {
			continue
		}

		anchoredBindings.add(bindingName)

		text += 'void '
		let bindingStart = text.length
		text += bindingName
		let bindingEnd = text.length
		text += ';'

		mappings.push({
			start: bindingStart,
			end: bindingEnd,
			originalStart: template.localOffsetToGlobal(part.attr!.nameStart + (part.namePrefix?.length ?? 0)),
			originalEnd: template.localOffsetToGlobal(part.attr!.nameStart + (part.namePrefix?.length ?? 0) + bindingName.length),
			kind: 'symbol-anchor',
			capabilities: NavigationCapabilities,
		})
	}

	// Close and invoke the IIFE, then leave a comma for the original template.
	text += '})(),'

	return {
		offset: node.getStart(sourceFile),
		endOffset: node.getEnd(),
		text,
		mappings,
		checks: checkSpans,
	}
}


/**
 * Generate `instance.property = value` for one component property.
 * Assignment delegates compatibility, readonly, setter, union, and generic
 * checks to TypeScript instead of reproducing them in the template analyzer.
 */
function buildPropertyCheck(
	part: TemplatePart,
	template: TemplateBasis,
	sourceFile: TS.SourceFile,
	instanceName: string
): MirrorCheck {
	let attr = part.attr!
	let propertyName = part.mainName!
	let fallbackStart = template.localOffsetToGlobal(attr.nameStart)
	let fallbackEnd = template.localOffsetToGlobal(attr.nameEnd)
	let originalPropertyStart = template.localOffsetToGlobal(attr.nameStart + (part.namePrefix?.length ?? 0))
	let originalPropertyEnd = originalPropertyStart + propertyName.length
	let text = instanceName
	let mappings: RelativeMapping[] = []
	let propertyStart: number
	let propertyEnd: number

	// Use bracket syntax for names that cannot be represented by a dot property.
	if (/^[$A-Z_a-z][$\w]*$/.test(propertyName)) {
		text += '.'
		propertyStart = text.length
		text += propertyName
		propertyEnd = text.length
	}
	else {
		text += '['
		propertyStart = text.length
		text += JSON.stringify(propertyName)
		propertyEnd = text.length
		text += ']'
	}

	mappings.push({
		start: propertyStart,
		end: propertyEnd,
		originalStart: originalPropertyStart,
		originalEnd: originalPropertyEnd,
		kind: 'symbol-anchor',
		capabilities: AllCapabilities,
	})

	text += ' = ('

	// Match TemplateBasis.getPartValueType semantics:
	// - quoted interpolation has the broad `string` type;
	// - static text retains its literal type;
	// - an unquoted single interpolation retains the expression's exact type;
	// - a valueless property is boolean shorthand.
	if (part.strings && part.valueIndices) {
		// A quoted/interpolated attribute always produces a string, but its exact
		// value is not known statically.
		text += '("" as string)'
	}
	else if (part.strings) {
		// Preserve a static attribute as a string literal so literal unions such as
		// `"horizontal" | "vertical"` are checked with the real template value.
		text += JSON.stringify(part.strings[0].text)
	}
	else if (part.valueIndices?.length === 1) {
		let value = template.valueNodes[part.valueIndices[0].index]
		let valueStart = text.length
		text += sourceFile.text.slice(value.getStart(sourceFile), value.getEnd())
		let valueEnd = text.length
		
		mappings.push({
			start: valueStart,
			end: valueEnd,
			originalStart: value.getStart(sourceFile),
			originalEnd: value.getEnd(),
			kind: 'copied-expression',
			capabilities: AllCapabilities,
		})
	}
	else {
		text += 'true'
	}
	text += ');'

	// Anything in the generated assignment that lacks a more precise property or
	// expression mapping is reported on the original `.property` attribute.
	mappings.push({
		start: 0,
		end: text.length,
		originalStart: fallbackStart,
		originalEnd: fallbackEnd,
		kind: 'scaffold',
		capabilities: ['diagnostic'],
	})

	return {text, fallbackStart, fallbackEnd, mappings}
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
function applyInsertions(sourceFile: TS.SourceFile, starts: MirrorInsertion[]): MirrorDocument {
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
	let originalOffset = 0
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

	if (originalOffset < sourceFile.text.length) {
		let mirrorStart = output.length
		output += sourceFile.text.slice(originalOffset)
		mappings.push({
			mirrorStart,
			mirrorEnd: output.length,
			originalStart: originalOffset,
			originalEnd: sourceFile.text.length,
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
	}
}
