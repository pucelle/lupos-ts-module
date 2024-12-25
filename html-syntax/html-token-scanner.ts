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


/** Match tag name, Add `$` to match template interpolation. */
const IsTagName = /[\w:$]/g

/** Match not tag name. */
const IsNotTagName = /[^\w:$]/g

/** Match attribute name. */
const IsAttrName = /[\w@:.?$-]/g

/** Match not attribute name. */
const IsNotAttrName = /[^\w@:.?$-]/g


function isTagName(char: string): boolean {
	IsTagName.lastIndex = 0
	return IsTagName.test(char)
}

function isAttrName(char: string): boolean {
	IsAttrName.lastIndex = 0
	return IsAttrName.test(char)
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

	/** 
	 * It moves `offset` to before match.
	 * Note the `re` must have `g` flag set.
	 */
	private readUntil(re: RegExp): RegExpExecArray | null {
		re.lastIndex = this.offset
		let m = re.exec(this.string)

		if (m) {
			this.offset = m.index
		}
		else {
			this.offset = this.string.length
			this.state = ScanState.EOF
		}

		return m
	}

	/** 
	 * It moves `offset` to after match.
	 * Note the `re` must have `g` flag set.
	 */
	private readOut(re: RegExp): RegExpExecArray | null {
		re.lastIndex = this.offset
		let m = re.exec(this.string)

		if (m) {
			this.offset = m.index + m[0].length
		}
		else {
			this.offset = this.string.length
			this.state = ScanState.EOF
		}

		return m
	}

	/** Return after position of end quote: `"..."|` */
	private readString(quote: string) {

		// Avoid read start quote.
		this.offset += 1

		do {
			// "..."|
			this.readOut(/['"`\\]/g)

			if (this.isEnded()) {
				return
			}

			let char = this.peekChar(-1)
			
			if (char === quote) {
				break
			}

			// Skip next character.
			if (char === '\\') {
				this.offset++
			}
		}
		while (true)
	}

	/** Note it will sync start to offset. */
	private makeToken(type: HTMLTokenType): HTMLToken {
		let start = this.start
		let end = this.offset

		this.sync()

		return {
			type,
			text: this.string.slice(start, end),
			start,
			end,
		}
	}

	/** Moves start to current offset and skip all chars between. */
	private sync() {
		this.start = this.offset
	}

	/** Parse html string to tokens. */
	*parseToTokens(): Iterable<HTMLToken> {
		while (this.offset < this.string.length) {
			if (this.state === ScanState.AnyContent) {

				// `|<`
				this.readUntil(/</g)

				if (this.isEnded()) {
					break
				}

				// `|<!--`
				if (this.peekChars(1, 3) === '!--') {
					yield* this.makeTextToken()

					// Move to `<--|`
					this.offset += 3
					this.sync()

					this.state = ScanState.WithinComment
				}

				// `|</`
				else if (this.peekChar(1) === '/') {
					yield* this.makeTextToken()

					// Move to `</|`
					this.offset += 2
					this.sync()

					this.state = ScanState.WithinEndTag
				}

				// `|<a`
				else if (isTagName(this.peekChar(1))) {
					yield* this.makeTextToken()

					// Move to `<|a`
					this.offset += 1
					this.sync()

					this.state = ScanState.WithinStartTag
				}
				else {
					this.offset += 1
				}
			}

			else if (this.state === ScanState.WithinComment) {

				// `-->|`
				this.readUntil(/-->/g)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.CommentText)
				this.offset += 3
				this.sync()

				this.state = ScanState.AnyContent
			}

			else if (this.state === ScanState.WithinStartTag) {

				// `<abc|`
				this.readUntil(IsNotTagName)

				if (this.isEnded()) {
					break
				}

				yield this.makeToken(HTMLTokenType.StartTagName)

				this.state = ScanState.AfterStartTag
			}

			else if (this.state === ScanState.WithinEndTag) {

				// `</abc|>` or `</|>`
				this.readUntil(IsNotTagName)

				if (this.isEnded()) {
					break
				}

				// This token may be empty.
				yield this.makeToken(HTMLTokenType.EndTagName)

				// `</abc>|`, skip `>`
				this.readOut(/>/g)
				this.sync()

				if (this.isEnded()) {
					break
				}

				this.state = ScanState.AnyContent
			}

			else if (this.state === ScanState.AfterStartTag) {
				let char = this.peekChar()
				if (char === '>') {

					// Move to `>|`
					this.offset += 1
					this.sync()

					// `/>|`
					if (this.peekChar(-1) === '/') {
						yield this.makeToken(HTMLTokenType.SelfCloseTagEnd)
					}

					// `>|`
					else {
						yield this.makeToken(HTMLTokenType.TagEnd)
					}

					this.state = ScanState.AnyContent
				}

				// `|name`
				else if (isAttrName(char)) {
					this.sync()
					this.state = ScanState.WithinAttributeName
				}

				else {
					this.offset += 1
				}
			}

			else if (this.state === ScanState.WithinAttributeName) {

				// `name|`
				this.readUntil(IsNotAttrName)
				yield this.makeToken(HTMLTokenType.AttributeName)

				this.state = ScanState.AfterAttributeName
			}

			else if (this.state === ScanState.AfterAttributeName) {

				// Skip white spaces.
				this.readUntil(/\S/g)
				this.sync()

				// `name|=`
				if (this.peekChar() === '=') {

					// Skip `=`.
					this.offset += 1

					// Skip white spaces.
					this.readUntil(/\S/g)
					this.sync()

					this.state = ScanState.WithinAttributeValue
				}

				// `name |?`
				else {
					this.state = ScanState.AfterStartTag
					this.sync()
				}
			}

			else if (this.state === ScanState.WithinAttributeValue) {
				let char = this.peekChar()

				// `=|"..."`
				if (char === '"' || char === '\'') {

					// "..."|
					this.readString(char)
					yield this.makeToken(HTMLTokenType.AttributeValue)
					this.state = ScanState.AfterStartTag
				}
				else {

					// name=value|
					this.readUntil(IsNotTagName)
					yield this.makeToken(HTMLTokenType.AttributeValue)

					this.state = ScanState.AfterStartTag
				}
			}
		}

		if (this.state === ScanState.EOF) {
			yield* this.makeTextToken()
		}
	}

	private *makeTextToken(): Iterable<HTMLToken> {
		if (this.start < this.offset) {
			yield this.makeToken(HTMLTokenType.Text)
		}
	}
}