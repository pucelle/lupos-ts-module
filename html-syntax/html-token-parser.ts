/** Parsed HTML token. */
export interface HTMLToken {
	type: HTMLTokenType
	text: string
	start: number
	end: number
}

/** HTML token type. */
export enum HTMLTokenType {

	/** Start tag name exclude `<`. */
	StartTagName,

	/** End tag name exclude `</` and `>`. */
	EndTagName,

	/** `<... >`, not include tag end of close tag. */
	TagEnd,

	/** `<... />`. */
	SelfCloseTagEnd,
	
	/** Attribute name part. */
	AttributeName,

	/** Include quotes. */
	AttributeValue,

	/** Original text, not been trimmed. */
	Text,

	/** Exclude `<!--` and `-->`. */
	CommentText,
}


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


export class HTMLTokenParser {

	private string: string
	private start = 0
	private offset = 0
	private state: ScanState = ScanState.AnyContent

	constructor(string: string) {
		this.string = string
	}

	private isEnded(): boolean {
		return this.state === ScanState.EOF
	}

	private peekChars(additionalOffset: number = 0, count: number): string {
		return this.string.slice(this.offset + additionalOffset, this.offset + additionalOffset + count)
	}

	private peekChar(additionalOffset: number = 0): string {
		return this.string[this.offset + additionalOffset]
	}

	private isEmptyChar(char: string): boolean {
		return /\s/.test(char)
	}

	/** It moves `offset` to before until char. */
	private readUntilChars(chars: string[], additionalOffset: number = 0) {
		for (let i = this.offset + additionalOffset; i < this.string.length; i++) {
			let char = this.string[i]
			if (chars.includes(char)) {
				this.offset = i
				return
			}
		}

		this.offset = this.string.length
		this.state = ScanState.EOF
	}

	/** It moves `offset` to before not match char. */
	private readUntilNotMatch(test: (char: string) => boolean, additionalOffset: number = 0) {
		for (let i = this.offset + additionalOffset; i < this.string.length; i++) {
			let char = this.string[i]
			if (!test(char)) {
				this.offset = i
				return
			}
		}

		this.offset = this.string.length
		this.state = ScanState.EOF
	}

	private makeToken(type: HTMLTokenType, start: number = this.start, end: number = this.offset): HTMLToken {
		return {
			type,
			text: this.string.slice(start, end),
			start,
			end,
		}
	}

	private followSteps(additionalOffset: number = 0) {
		this.start = this.offset = this.offset + additionalOffset
	}

	/**
	 * Parse html string to tokens.
	 * After parsed, all comments were removed, and `\r\n\t`s in text nodes were cleansed too.
	 */
	*parseToTokens(): Iterable<HTMLToken> {
		while (this.offset < this.string.length) {
			if (this.state === ScanState.AnyContent) {
				this.readUntilChars(['<'])

				if (this.isEnded()) {
					break
				}

				// |<!--
				if (this.peekChars(1, 3) === '!--') {
					yield* this.endText()
					this.state = ScanState.WithinComment
					this.followSteps(4)
				}

				// |</
				else if (this.peekChar(1) === '/') {
					yield* this.endText()
					this.state = ScanState.WithinEndTag
					this.followSteps(2)
				}

				// |<a
				else if (this.isNameChar(this.peekChar(1))) {
					yield* this.endText()
					this.state = ScanState.WithinStartTag
					this.followSteps(1)
				}
				else {
					this.offset += 1
				}
			}

			else if (this.state === ScanState.WithinComment) {
				this.readUntilChars(['>'])

				if (this.isEnded()) {
					break
				}

				// --|>
				if (this.peekChars(-2, 2) === '--') {
					yield this.makeToken(HTMLTokenType.CommentText, this.start, this.offset - 2)
					this.state = ScanState.AnyContent
					this.followSteps(1)
				}
				else {
					this.offset += 1
				}
			}

			else if (this.state === ScanState.WithinStartTag) {

				// <abc| ..
				this.readUntilNotMatch(this.isNameChar)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.StartTagName)
				this.state = ScanState.AfterStartTag
				this.followSteps()
			}

			else if (this.state === ScanState.WithinEndTag) {

				// </abc|> or </|>
				this.readUntilNotMatch(this.isNameChar)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.EndTagName)

				// </abc|>
				this.readUntilChars(['>'])

				if (this.isEnded()) {
					break
				}

				this.state = ScanState.AnyContent
				this.followSteps(1)
			}

			else if (this.state === ScanState.AfterStartTag) {
				let char = this.peekChar()
				if (char === '>') {

					// /|>
					if (this.peekChar(-1) === '/') {
						yield this.makeToken(HTMLTokenType.SelfCloseTagEnd, this.offset - 1, this.offset + 1)
					}

					// |>
					else {
						yield this.makeToken(HTMLTokenType.TagEnd, this.offset, this.offset + 1)
					}

					this.state = ScanState.AnyContent
					this.followSteps(1)
				}

				// |name
				else if (this.isAttrNameChar(char)) {
					this.state = ScanState.WithinAttributeName
					this.followSteps()
				}

				else {
					this.followSteps(1)
				}
			}

			else if (this.state === ScanState.WithinAttributeName) {

				// name|
				this.readUntilNotMatch(this.isAttrNameChar)
				
				yield this.makeToken(HTMLTokenType.AttributeName)
				this.state = ScanState.AfterAttributeName
				this.followSteps()
			}

			else if (this.state === ScanState.AfterAttributeName) {
				this.readUntilNotMatch(this.isEmptyChar)

				// name|=
				if (this.peekChar() === '=') {
					this.readUntilNotMatch(this.isEmptyChar, 1)
					this.state = ScanState.WithinAttributeValue
					this.followSteps()
				}

				//name |?
				else {
					this.state = ScanState.AfterStartTag
					this.followSteps()
				}
			}

			else if (this.state === ScanState.WithinAttributeValue) {
				let char = this.peekChar()

				// =|"..."
				if (char === '"' || char === '\'') {

					// "..."|
					yield* this.endStringAttributeValue(char)
					this.state = ScanState.AfterStartTag
					this.followSteps()
				}
				else {

					// name=value|
					this.readUntilNotMatch(this.isNameChar)
					yield this.makeToken(HTMLTokenType.AttributeValue)

					this.state = ScanState.AfterStartTag
					this.followSteps()
				}
			}
		}

		if (this.state === ScanState.EOF) {
			yield* this.endText()
		}
	}


	private isNameChar(char: string): boolean {

		// Add `$` to match template interpolation.
		return /[\w:$]/.test(char)
	}

	private isAttrNameChar(char: string): boolean {
		return /[\w@:.?$-]/.test(char)
	}

	private *endText(): Iterable<HTMLToken> {
		if (this.start < this.offset) {
			yield this.makeToken(HTMLTokenType.Text, this.start, this.offset)
		}
	}

	/** Return after position of end quote: `"..."|` */
	private *endStringAttributeValue(quote: string): Iterable<HTMLToken> {

		// Avoid read start quote.
		this.offset += 1

		do {
			// "...|"
			this.readUntilChars(['\\', quote])

			if (this.isEnded()) {
				return
			}
			
			if (this.peekChar() === quote) {
				this.offset += 1
				break
			}

		}
		while (true)

		yield this.makeToken(HTMLTokenType.AttributeValue)
	}
}