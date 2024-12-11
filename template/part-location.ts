import {TemplatePart, TemplatePartType} from './parts-parser'


export interface TemplatePartLocation {
	type: TemplatePartLocationType

	/** Start offset in template region. */
	start: number

	/** End offset in template region. */
	end: number

	/** Only exist when in modifier type. */
	modifierIndex?: number
}

export enum TemplatePartLocationType {
	TagName,
	Prefix,
	Name,
	Modifier,
	AttrValue,
}


export function getTemplatePartLocationAt(part: TemplatePart, temOffset: number): TemplatePartLocation | null {
	let locations = parseAllTemplatePartLocations(part)

	for (let location of locations) {
		if (temOffset < location.start || temOffset > location.end) {
			continue
		}

		// `|@name`, not `@|name`.
		if (location.type === TemplatePartLocationType.Prefix && temOffset === location.end) {
			continue
		}

		return location
	}

	return null
}


export function parseAllTemplatePartLocations(part: TemplatePart): TemplatePartLocation[] {
	let locations: TemplatePartLocation[] = []
	let start = part.start
	let end = start


	// `<|Com|`
	if (part.type === TemplatePartType.Component
		|| part.type === TemplatePartType.DynamicComponent
		|| part.type === TemplatePartType.FlowControl
		|| part.type === TemplatePartType.SlotTag
		|| part.type === TemplatePartType.NormalStartTag
	) {
		end += part.node.tagName!.length

		locations.push({
			type: TemplatePartLocationType.TagName,
			start,
			end,
		})
	}


	if (part.namePrefix) {
		end += part.namePrefix.length

		// `|@name`, `@|name` should match name.
		locations.push({
			type: TemplatePartLocationType.Prefix,
			start,
			end,
		})
	}


	if (part.mainName) {
		start = end
		end += part.mainName.length

		// `@|name|`
		locations.push({
			type: TemplatePartLocationType.Name,
			start,
			end
		})
	}


	if (part.modifiers) {
		for (let i = 0; i < part.modifiers.length; i++) {
			start = end + 1
			end += part.modifiers[i].length + 1

			// `.|modifier|`
			locations.push({
				type: TemplatePartLocationType.Modifier,
				start,
				end,
				modifierIndex: i,
			})
		}
	}


	if (part.attr && part.attr.value !== null) {
		let valueStart = part.attr.valueStart
		let valueEnd = part.attr.valueEnd

		if (part.attr.quoted) {
			valueStart += 1
			valueEnd -= 1
		}

		// a="|b|"
		locations.push({
			type: TemplatePartLocationType.AttrValue,
			start: valueStart,
			end: valueEnd,
		})
	}

	return locations
}