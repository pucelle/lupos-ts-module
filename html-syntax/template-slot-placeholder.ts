import type * as TS from 'typescript'
import {PositionMapper, trimTextList} from '../utils'


export interface TemplateContentParsed {
	strings: TemplateSlotString[] | null
	valueIndices: TemplateSlotValueIndex[] | null
}

export interface TemplateSlotString {

	/** Template slot text part. */
	text: string

	/** Start offset within current parsing string. */
	start: number

	/** Start offset within current parsing string. */
	end: number
}

export interface TemplateSlotValueIndex {

	/** Template slot value index. */
	index: number

	/** Start offset within current parsing string. */
	start: number

	/** Start offset within current parsing string. */
	end: number
}


export namespace TemplateSlotPlaceholder {

	let ts: typeof TS


	/** Initialize ts. */
	export function initialize(typescript: typeof TS) {
		ts = typescript
	}


	/** 
	 * Get whole string part of a tagged template.
	 * Will add `$LUPOS_START_\d$ to indicate start of each template part.
	 * Template slots have been replaced to placeholder `$LUPOS_SLOT_INDEX_\d$`.
	 */
	export function toTemplateContent(template: TS.TemplateLiteral): {string: string, mapper: PositionMapper} {
		let string = ''
		let mapper = new PositionMapper()

		if (ts.isNoSubstitutionTemplateLiteral(template)) {
			mapper.add(string.length, template.getStart() + 1)

			// Note here can't use `text`, which has been replaced from `\r\n` to `\n`.
			string += template.rawText
		}
		else if (ts.isTemplateExpression(template)) {
			mapper.add(string.length, template.head.getStart() + 1)
			string += template.head.rawText

			let index = -1
			
			for (let span of template.templateSpans) {
				string += `\$LUPOS_SLOT_INDEX_${++index}\$`
				mapper.add(string.length, span.literal.getStart() + 1)
				string += span.literal.rawText
			}
		}

		return {string, mapper}
	}

	
	/** 
	 * Split a full template string by template slot placeholder `$LUPOS_SLOT_INDEX_\d_.
	 * If `quoted`, must return a string list.
	 */
	export function parseTemplateContent(content: string, quoted: boolean = false, startOffset: number = 0): TemplateContentParsed {
		let match: RegExpExecArray | null
		let strings: TemplateSlotString[] | null = []
		let valueIndices: TemplateSlotValueIndex[] | null = []
		let stringStart = 0
		let indexStart = 0
		let re = /\$LUPOS_SLOT_INDEX_(\d+)\$/g

		while (match = re.exec(content)) {
			indexStart = match.index
			let stringEnd = match.index
			let text = content.slice(stringStart, stringEnd)
			let indexEnd = match.index + match[0].length
			let index = Number(match[1])

			strings.push({
				text,
				start: stringStart + startOffset,
				end: stringEnd + startOffset,
			})

			valueIndices.push({
				index,
				start: indexStart + startOffset,
				end: indexEnd + startOffset,
			})

			stringStart = indexEnd
		}

		strings.push({
			text: content.slice(stringStart, content.length),
			start: stringStart + startOffset,
			end: content.length + startOffset,
		})

		if (strings.length === 0
			|| strings.length === 2 && strings[0].text === '' && strings[1].text === '' && !quoted
		) {
			strings = null
		}

		if (valueIndices.length === 0) {
			valueIndices = null
		}

		return {
			strings,
			valueIndices,
		}
	}


	/** Join strings and value indices to template string. */
	export function joinStringsAndValueIndices(strings: TemplateSlotString[] | null, valueIndices: TemplateSlotValueIndex[] | null): string {
		let joined = ''

		if (strings) {
			joined += strings![0].text
		}

		if (valueIndices) {
			for (let i = 0; i < valueIndices.length; i++) {
				joined += `$LUPOS_SLOT_INDEX_${valueIndices[i].index}$`

				if (strings) {
					joined += strings[i + 1].text
				}
			}
		}
		
		return joined
	}


	/** Join strings and value indices to template string. */
	export function getOffsetsByStringsAndValueIndices(
		strings: TemplateSlotString[] | null,
		valueIndices: TemplateSlotValueIndex[] | null
	): {start: number, end: number} | null {
		if (strings) {
			return {
				start: strings[0].start,
				end: strings[strings.length - 1].end,
			}
		}
		else if (valueIndices) {
			return {
				start: valueIndices[0].start,
				end: valueIndices[valueIndices.length - 1].end,
			}
		}
		else {
			return null
		}
	}


	/** Replace placeholder `$LUPOS_SLOT_INDEX_\d_ with a replacer. */
	export function replaceTemplateContent(
		string: string,
		replacer: (index: number) => string
	): string {
		return string.replace(/\$LUPOS_SLOT_INDEX_(\d+)\$/g, (_m0, m1) => {
			return replacer(Number(m1))
		})
	}


	/** Extract all expression interpolations from a template. */
	export function extractTemplateValues(template: TS.TemplateLiteral): TS.Expression[] {
		let values: TS.Expression[] = []

		if (!ts.isTemplateExpression(template)) {
			return values
		}

		for (let span of template.templateSpans) {
			values.push(span.expression)
		}

		return values
	}


	/** Whether content has a template slot placeholder `$LUPOS_SLOT_INDEX_\d_. */
	export function hasSlotIndex(content: string): boolean {
		return /\$LUPOS_SLOT_INDEX_\d+\$/.test(content)
	}


	/** Whether content is a complete template slot placeholder `$LUPOS_SLOT_INDEX_\d_. */
	export function isCompleteSlotIndex(content: string): boolean {
		return /^\$LUPOS_SLOT_INDEX_\d+\$$/.test(content)
	}


	/** Get slot index from placeholder string `$LUPOS_SLOT_INDEX_\d_. */
	export function getUniqueSlotIndex(content: string): number | null {
		return Number(content.match(/^\$LUPOS_SLOT_INDEX_(\d+)\$$/)?.[1] ?? null)
	}


	/** 
	 * Get all slot indices from template content containing some template slot placeholders `$LUPOS_SLOT_INDEX_\d_.
	 * Returns `null` if no index.
	 */
	export function getSlotIndices(content: string): number[] | null {
		let indices = [...content.matchAll(/\$LUPOS_SLOT_INDEX_(\d+)\$/g)].map(m => Number(m[1]))
		return indices.length > 0 ? indices : null
	}


	/** Whether tag name represents named component. */
	export function isNamedComponent(tagName: string): boolean {
		return /^[A-Z]/.test(tagName)
	}


	/** Whether tag name represents dynamic component. */
	export function isDynamicComponent(tagName: string): boolean {
		return isCompleteSlotIndex(tagName)
	}


	/** Whether tag name represents named component or dynamic component. */
	export function isComponent(tagName: string): boolean {
		return isNamedComponent(tagName) || isDynamicComponent(tagName)
	}


	/** Trim string texts. */
	export function trimStrings(strings: TemplateSlotString[] | null): TemplateSlotString[] | null {
		if (!strings) {
			return strings
		}

		let stringTexts = strings.map(s => s.text)
		stringTexts = trimTextList(stringTexts)

		if (stringTexts.length === 2 && stringTexts[0] === '' && stringTexts[1] === '') {
			return null
		}
		else {
			for (let i = 0; i < strings.length; i++) {
				strings[i].text = stringTexts[i]
			}
		}

		return strings
	}
}