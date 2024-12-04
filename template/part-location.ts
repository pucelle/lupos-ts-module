import {TemplatePart} from './parts-parser'


export interface TemplatePartLocation {
	type: TemplatePartLocationType

	/** Start offset in template region. */
	start: number

	/** End offset in template region. */
	end: number

	modifierIndex?: number
}

export enum TemplatePartLocationType {
	Prefix,
	Name,
	Modifier,
	AttrValue,
}


export function getTemplatePartLocation(part: TemplatePart, temOffset: number): TemplatePartLocation | null {
	if (temOffset < part.start) {
		return null
	}

	let offset = temOffset
	let start = part.start
	let end = start

	end += (part.namePrefix?.length || 0)

	// `|@name`, not `@|name`.
	if (offset < end) {
		return {
			type: TemplatePartLocationType.Prefix,
			start,
			end,
		}
	}


	start = end
	end += (part.mainName?.length || 0)

	// `@|name|`
	if (offset <= end) {
		return {
			type: TemplatePartLocationType.Name,
			start,
			end
		}
	}


	if (part.modifiers) {
		for (let i = 0; i < part.modifiers.length; i++) {
			start = end + 1
			end += part.modifiers[i].length + 1

			// `.|modifier|`
			if (offset <= start) {
				return {
					type: TemplatePartLocationType.Modifier,
					start,
					end,
					modifierIndex: i,
				}
			}
		}
	}


	if (part.attr && part.attr.value !== null) {
		let valueStart = part.attr.valueStart - part.start
		let valueEnd = part.attr.valueEnd - part.end

		if (part.attr.quoted) {
			valueStart += 1
			valueEnd -= 1
		}

		// a="|b|"
		if (offset >= valueStart && offset <= valueEnd) {
			return {
				type: TemplatePartLocationType.AttrValue,
				start: valueStart,
				end: valueEnd,
			}
		}
	}

	return null
}