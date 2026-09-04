import {AllCapabilities} from './mirror-builder'
import type TS from 'typescript'
import {MirrorDocument, MirrorMapping, MirrorCheckSpan} from './types'
import {MirrorInsertion, RelativeMapping} from './insertion-types'


/** Merge all generated prefixes/suffixes with unchanged source text and mappings. */
export function applyInsertions(
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
export function composeCopiedTemplates(sourceFile: TS.SourceFile, insertions: MirrorInsertion[]): MirrorInsertion[] {
	let moved = new Set<MirrorInsertion>()

	// Children must already contain their own nested checks when copied by a parent.
	for (let insertion of [...insertions].sort((a, b) => b.offset - a.offset)) {
		let children = insertions.filter(child => child !== insertion && !moved.has(child)
			&& child.offset > insertion.offset && child.endOffset < insertion.endOffset)
		let copies = insertion.mappings.filter(mapping => mapping.kind === 'copied-expression')
			.sort((a, b) => b.start - a.start)

		for (let copy of copies) {
			let contained = children.filter(child => child.offset >= copy.originalStart && child.endOffset <= copy.originalEnd)
			if (contained.length === 0) {
				continue
			}

			composeCopy(sourceFile, insertion, copy, contained)
			for (let child of contained) {
				moved.add(child)
			}
		}
	}

	return insertions.filter(insertion => !moved.has(insertion))
}


/** Insert one nested semantic template into an exact source copy. */
function composeCopy(sourceFile: TS.SourceFile, insertion: MirrorInsertion, copy: RelativeMapping, contained: MirrorInsertion[]) {
	let nested = applyInsertions(sourceFile, contained, copy.originalStart, copy.originalEnd)
	let delta = nested.mirrorText.length - (copy.end - copy.start)
	let shift = (offset: number) => offset >= copy.end ? offset + delta : offset
	insertion.text = insertion.text.slice(0, copy.start) + nested.mirrorText + insertion.text.slice(copy.end)
	insertion.mappings = insertion.mappings.filter(mapping => mapping.kind !== copy.kind
		|| mapping.start !== copy.start || mapping.end !== copy.end).map(mapping => ({
		...mapping, start: shift(mapping.start), end: shift(mapping.end),
	}))
	insertion.checks = insertion.checks.map(check => ({...check, start: shift(check.start), end: shift(check.end)}))

	insertion.mappings.push(...nested.mappings.flatMap(mapping => splitSourceMapping(mapping, nested.sourceDiagnosticExclusions ?? [])).map(mapping => ({
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
}


/** Split source copies so superseded diagnostics retain their exclusions. */
function splitSourceMapping(mapping: MirrorMapping, exclusions: readonly TS.TextSpan[]): MirrorMapping[] {
	if (mapping.kind !== 'source') {
		return [mapping]
	}

	let innerBoundaries = exclusions.flatMap(span => [span.start, span.start + span.length])
		.filter(offset => offset > mapping.originalStart && offset < mapping.originalEnd)
	let boundaries = [...new Set([mapping.originalStart, ...innerBoundaries, mapping.originalEnd])]
		.sort((a, b) => a - b)

	return boundaries.slice(0, -1).map((start, index) => ({
		...mapping,
		mirrorStart: mapping.mirrorStart + start - mapping.originalStart,
		mirrorEnd: mapping.mirrorStart + boundaries[index + 1] - mapping.originalStart,
		originalStart: start,
		originalEnd: boundaries[index + 1],
		kind: exclusions.some(span => start >= span.start && start < span.start + span.length)
			? 'source' : 'copied-expression',
	}))
}
