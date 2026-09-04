import type TS from 'typescript'


/**
 * Language-service operations that may follow a mapping. A mapping can be
 * useful for navigation without being safe for diagnostics: for example, the
 * generated `Card` in `new Card()` should resolve definitions, but constructor
 * errors created only by the mirror must not be reported to the user.
 */
export type MirrorCapability = 'diagnostic' | 'completion' | 'definition' | 'hover' | 'references' | 'rename'

/**
 * Describes why a range exists so overlapping mappings can be prioritized.
 *
 * - `source`: unchanged text copied verbatim from the real source file.
 * - `copied-expression`: an interpolation expression copied into a generated check.
 * - `symbol-anchor`: a generated identifier corresponding to a template name.
 * - `scaffold`: generated checking syntax that falls back to a template attribute.
 */
export type MirrorMappingKind = 'source' | 'copied-expression' | 'symbol-anchor' | 'scaffold'

/**
 * A bidirectional association between a mirror range and its real-source
 * range. Ends are stored as exclusive offsets, although cursor lookup also
 * accepts a position exactly at the end so completion works at token edges.
 */
export interface MirrorMapping {

	/** Start of the range in `MirrorDocument.mirrorText`. */
	mirrorStart: number

	/** Exclusive end of the range in `MirrorDocument.mirrorText`. */
	mirrorEnd: number

	/** Start of the corresponding range in `MirrorDocument.originalText`. */
	originalStart: number

	/** Exclusive end of the corresponding range in the original source. */
	originalEnd: number

	/** Determines precedence when several mappings contain the same position. */
	kind: MirrorMappingKind

	/** Operations for which it is safe to use this association. */
	capabilities: readonly MirrorCapability[]
}

/**
 * Range of one generated semantic check, such as `instance.count = value`.
 * Symbol-only anchors and unchanged source text are deliberately excluded.
 */
export interface MirrorCheckSpan extends TS.TextSpan {

	/** Attribute-name position used if generated scaffolding receives a diagnostic. */
	fallbackStart: number

	/** Length of the fallback attribute-name range in the original source. */
	fallbackLength: number
}

/**
 * Insertion-only TypeScript projection of one real source file. The original
 * text is never printed or reformatted; generated prefixes and suffixes are
 * inserted around tagged templates, which keeps all untouched text mappable.
 */
export interface MirrorDocument {

	/** Same filename as the real source so relative imports retain their identity. */
	readonly fileName: string

	/** Exact text of the real source file. */
	readonly originalText: string

	/** Source text plus generated type-checking expressions. */
	readonly mirrorText: string

	/** Overlapping, capability-specific mappings in both directions. */
	readonly mappings: readonly MirrorMapping[]

	/** Generated assignment ranges, primarily useful for diagnostics and tests. */
	readonly checkSpans: readonly MirrorCheckSpan[]

	/** Original expressions whose diagnostics are supplied by checked copies. */
	readonly sourceDiagnosticExclusions?: readonly TS.TextSpan[]
}
