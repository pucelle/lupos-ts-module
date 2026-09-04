import type TS from 'typescript'
import {MirrorCapability, MirrorDocument, MirrorMapping} from './types'


/**
 * More specific generated ranges win over their enclosing fallback or copied
 * source ranges. This is important because a property/value check commonly
 * has three mappings containing the same position.
 */
const MappingPriority: Record<MirrorMapping['kind'], number> = {
	'source': 0,
	'scaffold': 1,
	'symbol-anchor': 2,
	'copied-expression': 3,
}


/**
 * Map a real-source cursor position into the mirror. The requested capability
 * prevents, for example, a diagnostic-only fallback from being used for a
 * definition request.
 */
export function mapOriginalPositionToMirror(
	document: MirrorDocument,
	position: number,
	capability: MirrorCapability
): number | null {
	let mapping = chooseMapping(document.mappings, position, capability, false)
	return mapping ? mapPosition(mapping, position, false) : null
}

/**
 * Map a mirror span back to the real source. Generated scaffolding has no
 * character-for-character equivalent, so it maps to the complete fallback
 * attribute range. Copied source and symbol ranges map proportionally.
 */
export function mapMirrorSpanToOriginal(
	document: MirrorDocument,
	span: TS.TextSpan,
	capability: MirrorCapability
): TS.TextSpan | null {
	let mapping = chooseMapping(document.mappings, span.start, capability, true)
	if (!mapping) {
		return null
	}
	if (capability === 'diagnostic' && mapping.kind === 'source') {
		let originalStart = mapPosition(mapping, span.start, true)

		if (document.sourceDiagnosticExclusions?.some(exclusion =>
			originalStart >= exclusion.start && originalStart < exclusion.start + exclusion.length
		)) {
			return null
		}
	}

	if (mapping.kind === 'scaffold') {
		return {
			start: mapping.originalStart,
			length: mapping.originalEnd - mapping.originalStart,
		}
	}

	let start = mapPosition(mapping, span.start, true)
	let end = mapPosition(mapping, span.start + span.length, true)

	return {
		start,
		length: Math.max(0, end - start),
	}
}

/**
 * Whether a range intersects a generated semantic check. The provider now
 * maps the whole mirror, but this remains useful to consumers that want to
 * distinguish Lupos checks from diagnostics in preserved source text.
 */
export function intersectsMirrorCheck(document: MirrorDocument, start: number, length: number): boolean {
	let end = start + length

	return document.checkSpans.some(span => {
		let spanEnd = span.start + span.length

		return length === 0
			? start >= span.start && start <= spanEnd
			: start < spanEnd && end > span.start
	})
}

/** Select the most specific capability-compatible mapping containing a position. */
function chooseMapping(
	mappings: readonly MirrorMapping[],
	position: number,
	capability: MirrorCapability,
	fromMirror: boolean
): MirrorMapping | undefined {
	let candidates = mappings.filter(mapping => {
		if (!mapping.capabilities.includes(capability)) {
			return false
		}

		let start = fromMirror ? mapping.mirrorStart : mapping.originalStart
		let end = fromMirror ? mapping.mirrorEnd : mapping.originalEnd
		
		// A diagnostic at the next token must not select a range ending there.
		// Cursor features still accept token ends for completion/navigation.
		return position >= start && (position < end || position === end
			&& (!fromMirror || capability !== 'diagnostic' || start === end))
	})

	return candidates.sort((a, b) => {
		// Prefer semantic mappings (expression/symbol) to broad fallback/source mappings.
		let priority = MappingPriority[b.kind] - MappingPriority[a.kind]
		if (priority !== 0) {
			return priority
		}

		// For equal kinds, the narrowest range normally describes the token best.
		let aLength = fromMirror ? a.mirrorEnd - a.mirrorStart : a.originalEnd - a.originalStart
		let bLength = fromMirror ? b.mirrorEnd - b.mirrorStart : b.originalEnd - b.originalStart
		return aLength - bLength
	})[0]
}

function mapPosition(mapping: MirrorMapping, position: number, fromMirror: boolean): number {
	let fromStart = fromMirror ? mapping.mirrorStart : mapping.originalStart
	let fromEnd = fromMirror ? mapping.mirrorEnd : mapping.originalEnd
	let toStart = fromMirror ? mapping.originalStart : mapping.mirrorStart
	let toEnd = fromMirror ? mapping.originalEnd : mapping.mirrorEnd
	let fromLength = fromEnd - fromStart

	if (fromLength === 0) {
		return toStart
	}

	// Clamping also makes diagnostics that extend past a mapped token terminate
	// at that token instead of leaking into adjacent generated text.
	let rate = Math.max(0, Math.min(1, (position - fromStart) / fromLength))
	return Math.round(toStart + rate * (toEnd - toStart))
}
