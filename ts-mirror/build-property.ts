import type TS from 'typescript'
import {TemplateBasis, TemplatePart} from '../template'
import {AllCapabilities, MirrorCheck, RelativeMapping} from './mirror-builder'


/**
 * Generate `instance.property = value` for a component or element property.
 * Assignment delegates compatibility, readonly, setter, union, and generic
 * checks to TypeScript instead of reproducing them in the template analyzer.
 */
export function buildProperty(
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

