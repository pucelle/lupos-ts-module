import type TS from 'typescript'
import {MirrorCapability, MirrorMappingKind} from './types'


/** Mapping whose mirror offsets are relative to the start of one insertion. */
export interface RelativeMapping {

	/** Start in the generated insertion text. */
	start: number

	/** Exclusive end in the generated insertion text. */
	end: number

	/** Start in the original source file. */
	originalStart: number

	/** Exclusive end in the original source file. */
	originalEnd: number

	/** Purpose and precedence of this mapping. */
	kind: MirrorMappingKind

	/** Operations supported by this mapping. */
	capabilities: readonly MirrorCapability[]
}

/** Generated assignment plus its mappings and original diagnostic fallback. */
export interface MirrorCheck {

	/** Generated TypeScript check. */
	text: string

	/** Original start used for unmapped diagnostics. */
	fallbackStart: number

	/** Original exclusive end used for unmapped diagnostics. */
	fallbackEnd: number

	/** Source mappings relative to the generated check. */
	mappings: RelativeMapping[]
}

/**
 * Prefix inserted before one tagged template. `endOffset` is later converted
 * to a separate `)` suffix insertion, allowing nested templates to compose
 * without replacing or duplicating their original text.
 */
export interface MirrorInsertion {

	/** Original position at which the prefix is inserted. */
	offset: number

	/** Original position at which the closing suffix is inserted. */
	endOffset: number

	/** Generated prefix text. */
	text: string

	/** Source mappings relative to the prefix. */
	mappings: RelativeMapping[]

	/** Diagnostic check ranges relative to the prefix. */
	checks: {start: number, end: number, fallbackStart: number, fallbackEnd: number}[]

	/** Original expressions checked through generated copies. */
	sourceDiagnosticExclusions?: TS.TextSpan[]
}
