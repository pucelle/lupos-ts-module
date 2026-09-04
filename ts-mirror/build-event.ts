import {TemplateBasis, TemplatePart} from '../template'
import {buildElementExpression} from './build-element-expression'
import {MirrorCheck, RelativeMapping} from './insertion-types'
import {AllCapabilities} from './mirror-builder'


/** Model component registration or the DOM event binding's update call. */
export function buildEvent(
	part: TemplatePart,
	template: TemplateBasis,
	componentName: string | undefined,
	beComponentEvent: boolean
): MirrorCheck {
	let attr = part.attr!
	let {sourceFile} = template
	let fallbackStart = template.localOffsetToGlobal(attr.nameStart)
	let fallbackEnd = template.localOffsetToGlobal(attr.nameEnd)
	let context = template.component ? 'this' : '(null! as any)'
	let element = buildElementExpression(part.node, template, componentName)

	let text = beComponentEvent
		? `${componentName}.on(`
		: `new (null! as typeof import("lupos.html").on)(${element}, ${context}).update(`

	let mappings: RelativeMapping[] = []
	let nameStart = text.length
	text += JSON.stringify(part.mainName)

	mappings.push({
		start: nameStart,
		end: text.length,
		originalStart: fallbackStart + part.namePrefix!.length,
		originalEnd: fallbackStart + part.namePrefix!.length + part.mainName!.length,
		kind: 'symbol-anchor',
		capabilities: AllCapabilities
	})

	text += ', '

	if (!beComponentEvent) {

		// The binding's handler union cannot contextually type DOM callbacks.
		let name = JSON.stringify(part.mainName)

		text += `(($handler: (${name} extends keyof GlobalEventHandlersEventMap`
			+ ` ? (event: GlobalEventHandlersEventMap[Extract<${name}, keyof GlobalEventHandlersEventMap>]) => void`
			+ ` : ${name} extends keyof WindowEventHandlersEventMap`
			+ ` ? (event: WindowEventHandlersEventMap[Extract<${name}, keyof WindowEventHandlersEventMap>]) => void`
			+ ' : import("lupos.html").EventHandlerMixed) | null) => $handler)('
	}

	text += '('

	let value = template.getPartUniqueValue(part)
	if (value) {
		let start = text.length
		text += sourceFile.text.slice(value.getStart(sourceFile), value.getEnd())

		mappings.push({
			start,
			end: text.length,
			originalStart: value.getStart(sourceFile),
			originalEnd: value.getEnd(),
			kind: 'copied-expression',
			capabilities: AllCapabilities
		})
	}
	else if (part.strings) {
		text += part.valueIndices ? '("" as string)' : JSON.stringify(part.strings[0].text)
	}
	else {
		text += 'true'
	}

	text += ')'

	if (beComponentEvent) {
		text += `, ${context}`
	}
	else {
		text += ')'
	}

	// Modifier names retain the structural validator's category-specific rules.
	text += ');'

	mappings.push({
		start: 0,
		end: text.length,
		originalStart: fallbackStart,
		originalEnd: fallbackEnd,
		kind: 'scaffold',
		capabilities: ['diagnostic']
	})

	return {text, mappings, fallbackStart, fallbackEnd}
}
