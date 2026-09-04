import type TS from 'typescript'
import {Analyzer} from '../analyzer'
import {Helper} from '../helper'
import {TemplateSlotPlaceholder} from '../html-syntax'
import {ScopeTree} from '../scope'
import {MirrorCapability, MirrorDocument} from './types'
import {MirrorInsertion} from './insertion-types'
import {buildTemplateInsertion} from './template-insertion'
import {applyInsertions, composeCopiedTemplates} from './insertion-composer'


export type {RelativeMapping, MirrorCheck} from './insertion-types'

/** Capabilities supported by exact semantic source copies. */
const ALL_CAPABILITIES: readonly MirrorCapability[] = ['diagnostic', 'completion', 'definition', 'hover', 'references', 'rename']

export {ALL_CAPABILITIES as AllCapabilities}


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
	let analyzer = Analyzer.ofContext(ts, program)

	return analyzer.helper.types.withOriginalTypes(() => {
		return buildSourceMirror(ts, sourceFile, analyzer.helper, analyzer)
	})
}


/** Build a mirror with shared analysis and an independent lexical scope tree. */
function buildSourceMirror(
	ts: typeof TS,
	sourceFile: TS.SourceFile,
	helper: Helper,
	analyzer: Analyzer
): MirrorDocument | null {

	// TemplateSlotPlaceholder is shared with the transformer, but this public
	// builder must also work when called directly by a language-service plugin.
	TemplateSlotPlaceholder.initialize(ts)

	// ScopeTree and Analyzer are intentionally shared by every template in this
	// source file. Imported component/binding resolution is otherwise expensive.
	let scopeTree = new ScopeTree(helper)

	scopeTree.visitSourceFile(sourceFile)

	let insertions: MirrorInsertion[] = []
	let createIdentifier = createIdentifierFactory(sourceFile.text)

	// Collect every template before modifying text. Descending into a tagged
	// template also discovers tagged templates nested inside `${...}` values.
	let visit = (node: TS.Node) => {
		if (ts.isTaggedTemplateExpression(node)) {
			let insertion = buildTemplateInsertion(node, helper, scopeTree, analyzer, createIdentifier)

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


/** Create collision-free identifiers for generated lexical scopes. */
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
