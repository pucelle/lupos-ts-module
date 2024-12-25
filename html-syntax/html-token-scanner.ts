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
	Comment,
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


export class HTMLTokenScanner {

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

	private peekChars(move: number = 0, count: number): string {
		return this.string.slice(this.offset + move, this.offset + move + count)
	}

	private peekChar(move: number = 0): string {
		return this.string[this.offset + move]
	}

	private isEmptyChar(char: string): boolean {
		return /\s/.test(char)
	}

	/** 
	 * It moves `offset` to before match by default,
	 * can specify `moveOffsetAfter=true` to move after match.
	 */
	private readUntil(matches: string[], moveOffsetAfter: boolean = false) {
		for (let i = this.offset; i < this.string.length; i++) {
			let char = this.string[i]

			for (let match of matches) {
				if (match[0] !== char) {
					continue
				}

				if (match.length === 1 || match === this.string.slice(i, i + match.length)) {
					this.offset = moveOffsetAfter ? i + match.length : i
					return
				}
			}
		}

		this.offset = this.string.length
		this.state = ScanState.EOF
	}

	/** It moves `offset` to before not match character. */
	private readUntilCharNotMatch(test: (char: string) => boolean) {
		for (let i = this.offset; i < this.string.length; i++) {
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

	private syncSteps(move: number = 0) {
		this.start = this.offset = this.offset + move
	}

	/** Parse html string to tokens. */
	*parseToTokens(): Iterable<HTMLToken> {
		while (this.offset < this.string.length) {
			if (this.state === ScanState.AnyContent) {
				this.readUntil(['<'])

				if (this.isEnded()) {
					break
				}

				// |<!--
				if (this.peekChars(1, 3) === '!--') {
					yield* this.endText()
					this.state = ScanState.WithinComment
					this.syncSteps()
					this.offset += 3
				}

				// |</
				else if (this.peekChar(1) === '/') {
					yield* this.endText()
					this.state = ScanState.WithinEndTag
					this.syncSteps(2)
				}

				// |<a
				else if (this.isNameChar(this.peekChar(1))) {
					yield* this.endText()
					this.state = ScanState.WithinStartTag
					this.syncSteps(1)
				}
				else {
					this.offset += 1
				}
			}

			else if (this.state === ScanState.WithinComment) {
				// -->|
				this.readUntil(['-->'], true)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.Comment, this.start, this.offset + 1)
				this.state = ScanState.AnyContent
				this.syncSteps()
			}

			else if (this.state === ScanState.WithinStartTag) {

				// <abc| ..
				this.readUntilCharNotMatch(this.isNameChar)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.StartTagName)
				this.state = ScanState.AfterStartTag
				this.syncSteps()
			}

			else if (this.state === ScanState.WithinEndTag) {

				// </abc|> or </|>
				this.readUntilCharNotMatch(this.isNameChar)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.EndTagName)

				// </abc|>
				this.readUntil(['>'], true)

				if (this.isEnded()) {
					break
				}

				this.state = ScanState.AnyContent
				this.syncSteps()
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
					this.syncSteps(1)
				}

				// |name
				else if (this.isAttrNameChar(char)) {
					this.state = ScanState.WithinAttributeName
					this.syncSteps()
				}

				else {
					this.syncSteps(1)
				}
			}

			else if (this.state === ScanState.WithinAttributeName) {

				// name|
				this.readUntilCharNotMatch(this.isAttrNameChar)
				
				yield this.makeToken(HTMLTokenType.AttributeName)
				this.state = ScanState.AfterAttributeName
				this.syncSteps()
			}

			else if (this.state === ScanState.AfterAttributeName) {
				this.readUntilCharNotMatch(this.isEmptyChar)

				// name|=
				if (this.peekChar() === '=') {
					this.offset++
					this.readUntilCharNotMatch(this.isEmptyChar)
					this.state = ScanState.WithinAttributeValue
					this.syncSteps()
				}

				//name |?
				else {
					this.state = ScanState.AfterStartTag
					this.syncSteps()
				}
			}

			else if (this.state === ScanState.WithinAttributeValue) {
				let char = this.peekChar()

				// =|"..."
				if (char === '"' || char === '\'') {

					// "..."|
					yield* this.endStringAttributeValue(char)
					this.state = ScanState.AfterStartTag
					this.syncSteps()
				}
				else {

					// name=value|
					this.readUntilCharNotMatch(this.isNameChar)
					yield this.makeToken(HTMLTokenType.AttributeValue)

					this.state = ScanState.AfterStartTag
					this.syncSteps()
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
			// "..."|
			this.readUntil(['\\', quote], true)

			if (this.isEnded()) {
				return
			}
			
			if (this.peekChar(-1) === quote) {
				break
			}
		}
		while (true)

		yield this.makeToken(HTMLTokenType.AttributeValue)
	}
}