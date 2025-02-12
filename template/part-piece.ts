import {HTMLNodeType} from '../html-syntax'
import {TemplatePart, TemplatePartType} from './parts-parser'


export interface TemplatePartPiece {
	type: TemplatePartPieceType

	/** Start offset in template region. */
	start: number

	/** End offset in template region. */
	end: number

	/** Only exist when in modifier type. */
	modifierIndex?: number
}

export enum TemplatePartPieceType {
	TagName,
	Name,
	Modifier,
	AttrValue,
}


export function getTemplatePartPieceAt(part: TemplatePart, temOffset: number): TemplatePartPiece | null {
	let pieces = parseAllTemplatePartPieces(part)

	for (let piece of pieces) {
		if (temOffset < piece.start || temOffset > piece.end) {
			continue
		}

		return piece
	}

	return null
}


export function parseAllTemplatePartPieces(part: TemplatePart): TemplatePartPiece[] {
	let pieces: TemplatePartPiece[] = []
	let start = part.start
	let end = start


	// `<|Com|`
	if (part.type === TemplatePartType.Component
		|| part.type === TemplatePartType.DynamicComponent
		|| part.type === TemplatePartType.FlowControl
		|| part.type === TemplatePartType.SlotTag
		|| part.type === TemplatePartType.NormalStartTag
	) {
		end += part.node.type === HTMLNodeType.Tag ? part.node.tagName!.length : 0

		pieces.push({
			type: TemplatePartPieceType.TagName,
			start,
			end,
		})
	}


	// `@|` will also generate an empty name, to do completion.
	if (part.mainName || part.namePrefix) {
		start = end
		end += (part.namePrefix?.length ?? 0) + (part.mainName?.length ?? 0)

		// `@|name|`
		pieces.push({
			type: TemplatePartPieceType.Name,
			start,
			end
		})
	}


	if (part.modifiers) {
		for (let i = 0; i < part.modifiers.length; i++) {
			start = end + 1
			end = start + part.modifiers[i].length

			// `.|modifier|`
			pieces.push({
				type: TemplatePartPieceType.Modifier,
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
		pieces.push({
			type: TemplatePartPieceType.AttrValue,
			start: valueStart,
			end: valueEnd,
		})
	}

	return pieces
}