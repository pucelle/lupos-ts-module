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
	StartTagName,

	/** Exclude `</` and `>`. */
	EndTagName,

	TagEnd,
	SelfCloseTagEnd,
	
	AttributeName,
	AttributeValue,
	Text,

	/** Exclude `<!--` and `-->`. */
	CommentText,
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
		EOF,
	}


	/**
	 * Parse html string to tokens.
	 * After parsed, all comments were removed, and `\r\n\t`s in text nodes were cleansed too.
	 */
	export function parseToTokens(string: string): HTMLToken[] {
		let start = 0
		let index = 0
		let state: ScanState = ScanState.AnyContent
		let tokens: HTMLToken[] = []

		if (string.length === 0) {
			state = ScanState.EOF
		}

		while (state !== ScanState.EOF) {
			let char = string[index]

			if (state === ScanState.AnyContent) {
				if (char === '<') {
					if (peekChars(string, index + 1, 3) === '!--') {
						endText(string, tokens, start, index)
						state = ScanState.WithinComment
						start = index
					}
					else if (peekChar(string, index + 1) === '/') {
						endText(string, tokens, start, index)
						state = ScanState.WithinEndTag
						start = index
					}
					else if (isNameChar(peekChar(string, index + 1))) {
						endText(string, tokens, start, index)
						state = ScanState.WithinStartTag
						start = index
					}
				}
			}

			else if (state === ScanState.WithinComment) {
				if (char === '>') {
					if (peekChars(string, index - 3, 2) === '!--') {
						tokens.push(makeToken(string, HTMLTokenType.CommentText, start + 4, index - 2))
						state = ScanState.AnyContent
						start = index + 1
					}
				}
			}

			else if (state === ScanState.WithinStartTag) {
				let endIndex = readUntilNotMatch(string, start, isNameChar)
				tokens.push(makeToken(string, HTMLTokenType.StartTagName, start + 1, endIndex))
				state = ScanState.AfterStartTag
				start = endIndex
			}

			else if (state === ScanState.WithinEndTag) {
				let endIndex = readUntilNotMatch(string, start, isNameChar)
				tokens.push(makeToken(string, HTMLTokenType.StartTagName, start + 2, endIndex))

				endIndex = readUntilChars(string, endIndex, ['>'])
				state = ScanState.AnyContent
				start = Math.max(endIndex + 1, string.length)
			}

			else if (state === ScanState.AfterStartTag) {
				if (char === '>') {
					if (peekChar(string, index - 1) === '/') {
						tokens.push(makeToken(string, HTMLTokenType.SelfCloseTagEnd, index - 1, index + 1))
					}
					else {
						tokens.push(makeToken(string, HTMLTokenType.TagEnd, index, index + 1))
					}

					state = ScanState.AnyContent
					start = index + 1
				}

				else if (isAttrNameChar(char)) {
					state = ScanState.WithinAttributeName
					start = index
				}
			}

			else if (state === ScanState.WithinAttributeName) {
				let endIndex = readUntilNotMatch(string, start, isAttrNameChar)
				tokens.push(makeToken(string, HTMLTokenType.AttributeName, start, endIndex))
				state = ScanState.AfterAttributeName
				start = endIndex
			}

			else if (state === ScanState.AfterAttributeName) {
				let endIndex = readUntilNotMatch(string, start, isEmptyChar)
				let endChar = string[endIndex]

				if (endChar === '=') {
					state = ScanState.WithinAttributeValue
					start = readUntilNotMatch(string, start, isEmptyChar)
				}
				else {
					state = ScanState.AfterStartTag
					start = endIndex
				}
			}

			else if (state === ScanState.WithinAttributeValue) {
				if (char === '"' || char === '\'') {
					state = ScanState.AfterStartTag
					start = endStringAttributeValue(string, tokens, start, char)
				}
				else {
					let endIndex = readUntilNotMatch(string, start, isNameChar)
					tokens.push(makeToken(string, HTMLTokenType.AttributeValue, start, endIndex))

					state = ScanState.AfterStartTag
					start = endIndex
				}
			}

			if (index === string.length) {
				endText(string, tokens, start, index)
				state = ScanState.EOF
				start = index
			}
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
		return /[\w$]/.test(char)
	}

	function isAttrNameChar(char: string): boolean {
		return /[\w@:.?$]/.test(char)
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

	function endStringAttributeValue(string: string, tokens: HTMLToken[], start: number, quote: string): number {
		let startIndex = start
		let untilIndex

		do {
			untilIndex = readUntilChars(string, startIndex, ['\\', quote])
			
			if (string[untilIndex] === quote) {
				break
			}

			// `\\"`
			startIndex = untilIndex + 1
		}
		while (startIndex < string.length)

		let endIndex = Math.max(untilIndex + 1, string.length)
		tokens.push(makeToken(string, HTMLTokenType.AttributeValue, start, endIndex))

		return endIndex
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