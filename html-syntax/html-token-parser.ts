/** Parsed HTML token. */
export interface HTMLToken {
	type: HTMLTokenType
	text: string
	start: number
	end: number
}

/** HTML token type. */
export enum HTMLTokenType {

	/** Exclude `<`. */
	StartTagName = 0,

	/** Exclude `</` and `>`. */
	EndTagName = 1,

	TagEnd = 2,
	SelfCloseTagEnd = 3,
	
	AttributeName = 4,

	/** Include quotes. */
	AttributeValue = 5,

	/** Original text, not been trimmed. */
	Text = 6,

	/** Exclude `<!--` and `-->`. */
	CommentText = 7,
}


export namespace HTMLTokenParser {

	/** 
	 * Tags that self closing.
	 * Reference from https://developer.mozilla.org/en-US/docs/Glossary/Void_element
	 */
	export const SelfClosingTags = [
		'area',
		'base',
		'br',
		'col',
		'embed',
		'hr',
		'img',
		'input',
		'link',
		'meta',
		'param',
		'source',
		'track',
		'wbr',
	]


	enum ScanState {
		AnyContent,
		WithinStartTag,
		AfterStartTag,
		WithinEndTag,
		WithinAttributeName,
		AfterAttributeName,
		AfterAttributeEqual,
		WithinAttributeValue,
		WithinComment,
	}


	/**
	 * Parse html string to tokens.
	 * After parsed, all comments were removed, and `\r\n\t`s in text nodes were cleansed too.
	 */
	export function parseToTokens(string: string): HTMLToken[] {
		let start = 0
		let offset = 0
		let state: ScanState = ScanState.AnyContent
		let tokens: HTMLToken[] = []

		while (offset < string.length) {
			if (state === ScanState.AnyContent) {
				offset = readUntilChars(string, offset, ['<'])
				if (offset === string.length) {
					break
				}

				// |<!--
				if (peekChars(string, offset + 1, 3) === '!--') {
					endText(string, tokens, start, offset)
					state = ScanState.WithinComment
					start = offset += 4
				}

				// |</
				else if (peekChar(string, offset + 1) === '/') {
					endText(string, tokens, start, offset)
					state = ScanState.WithinEndTag
					start = offset += 2
				}

				// |<a
				else if (isNameChar(peekChar(string, offset + 1))) {
					endText(string, tokens, start, offset)
					state = ScanState.WithinStartTag
					start = offset += 1
				}
				else {
					offset += 1
				}
			}

			else if (state === ScanState.WithinComment) {
				offset = readUntilChars(string, offset, ['>'])
				if (offset === string.length) {
					break
				}

				// --|>
				if (peekChars(string, offset - 2, 2) === '--') {
					tokens.push(makeToken(string, HTMLTokenType.CommentText, start, offset - 2))
					state = ScanState.AnyContent
					start = offset += 1
				}
				else {
					offset += 1
				}
			}

			else if (state === ScanState.WithinStartTag) {

				// <abc| ..
				offset = readUntilNotMatch(string, start, isNameChar)
				if (offset === string.length) {
					break
				}

				tokens.push(makeToken(string, HTMLTokenType.StartTagName, start, offset))
				state = ScanState.AfterStartTag
				start = offset
			}

			else if (state === ScanState.WithinEndTag) {

				// </abc|> or </|>
				offset = readUntilNotMatch(string, start, isNameChar)
				if (offset === string.length) {
					break
				}

				tokens.push(makeToken(string, HTMLTokenType.EndTagName, start, offset))

				// </abc|>
				offset = readUntilChars(string, offset, ['>'])
				if (offset === string.length) {
					break
				}

				state = ScanState.AnyContent
				start = offset += 1
			}

			else if (state === ScanState.AfterStartTag) {
				let char = string[offset]
				if (char === '>') {

					// /|>
					if (peekChar(string, offset - 1) === '/') {
						tokens.push(makeToken(string, HTMLTokenType.SelfCloseTagEnd, offset - 1, offset + 1))
					}

					// |>
					else {
						tokens.push(makeToken(string, HTMLTokenType.TagEnd, offset, offset + 1))
					}

					state = ScanState.AnyContent
					start = offset += 1
				}

				// |name
				else if (isAttrNameChar(char)) {
					state = ScanState.WithinAttributeName
					start = offset
				}

				else {
					start = offset += 1
				}
			}

			else if (state === ScanState.WithinAttributeName) {

				// name|
				offset = readUntilNotMatch(string, start, isAttrNameChar)
				tokens.push(makeToken(string, HTMLTokenType.AttributeName, start, offset))
				state = ScanState.AfterAttributeName
				start = offset
			}

			else if (state === ScanState.AfterAttributeName) {
				offset = readUntilNotMatch(string, start, isEmptyChar)
				let endChar = string[offset]

				// name|=
				if (endChar === '=') {
					state = ScanState.WithinAttributeValue
					start = offset = readUntilNotMatch(string, offset + 1, isEmptyChar)
				}

				//name |?
				else {
					state = ScanState.AfterStartTag
					start = offset
				}
			}

			else if (state === ScanState.WithinAttributeValue) {
				let char = string[offset]

				// =|"..."
				if (char === '"' || char === '\'') {

					// "..."|
					offset = endStringAttributeValue(string, tokens, offset, char)
					state = ScanState.AfterStartTag
					start = offset
				}
				else {

					// name=value|
					offset = readUntilNotMatch(string, start, isNameChar)
					tokens.push(makeToken(string, HTMLTokenType.AttributeValue, start, offset))

					state = ScanState.AfterStartTag
					start = offset
				}
			}
		}

		if (state === ScanState.AnyContent) {
			endText(string, tokens, start, offset)
		}
		
		return tokens
	}


	function peekChars(string: string, index: number, count: number): string {
		return string.slice(index, index + count)
	}

	function peekChar(string: string, index: number): string {
		return string[index]
	}

	function isNameChar(char: string): boolean {

		// Add `$` to match template interpolation.
		return /[\w:$]/.test(char)
	}

	function isAttrNameChar(char: string): boolean {
		return /[\w@:.?$-]/.test(char)
	}

	function isEmptyChar(char: string): boolean {
		return /\s/.test(char)
	}

	function readUntilChars(string: string, start: number, chars: string[]) {
		for (let i = start; i < string.length; i++) {
			let char = string[i]
			if (chars.includes(char)) {
				return i
			}
		}

		return string.length
	}

	function readUntilNotMatch(string: string, start: number, test: (char: string) => boolean) {
		for (let i = start; i < string.length; i++) {
			let char = string[i]
			if (!test(char)) {
				return i
			}
		}

		return string.length
	}

	function endText(string: string, tokens: HTMLToken[], start: number, index: number) {
		if (index > start) {
			tokens.push(makeToken(string, HTMLTokenType.Text, start, index))
		}
	}

	/** Return after position of end quote: `"..."|` */
	function endStringAttributeValue(string: string, tokens: HTMLToken[], start: number, quote: string): number {
		let from = start + 1
		let until

		do {
			// "...|"
			until = readUntilChars(string, from, ['\\', quote])

			if (until === string.length) {
				break
			}
			
			if (string[until] === quote) {
				break
			}

			// `\\"`
			from = until + 1
		}
		while (from < string.length)

		let end = Math.min(until + 1, string.length)
		tokens.push(makeToken(string, HTMLTokenType.AttributeValue, start, end))

		return end
	}

	function makeToken(string: string, type: HTMLTokenType, start: number, end: number): HTMLToken {
		return {
			type,
			text: string.slice(start, end),
			start,
			end,
		}
	}
}