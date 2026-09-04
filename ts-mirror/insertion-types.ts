import type TS from 'typescript'
import {MirrorCapability, MirrorMappingKind} from './types'


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
export interface MirrorInsertion {
	offset: number
	endOffset: number
	text: string
	mappings: RelativeMapping[]
	checks: {start: number, end: number, fallbackStart: number, fallbackEnd: number}[]
	sourceDiagnosticExclusions?: TS.TextSpan[]
}

