/** Parsed HTML token. */
export interface HTMLToken {
	type: HTMLTokenType
	start: number
	end: number
	text?: string
	tagName?: string
	attrs?: HTMLAttribute[]
	selfClose?: boolean
}

/** Attribute names and values */
export interface HTMLAttribute {
	start: number
	name: string

	/** Quotes have been removed. */
	value: string | null

	/** Whether attribute value been quoted and value will be transformed to string. */
	quoted: boolean

	removed?: boolean
}

/** HTML token type. */
export enum HTMLTokenType {
	StartTag,
	EndTag,
	Text,
	Comment,
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

	/** RegExp to match each start/end tag, or intermediate contents. */
	const TagRE = /<!--[\s\S]*?-->|<([\w$:-]+)([\s\S]*?)\/?>|<\/[\w$:-]*>/g

	/** RegExp to match attribute string, include Template slot placeholder `$LUPOS_SLOT_INDEX_\d$`. */
	const AttrRE = /([\w$.:?@-]+)\s*(?:=\s*(".*?"|'.*?'|\S*)\s*)?/g


	/**
	 * Parse html string to tokens.
	 * After parsed, all comments were removed, and `\r\n\t`s in text nodes were cleansed too.
	 * Automatically transform `<tag />` to `<tag></tag>` for not self close tags.
	 */
	export function parseToTokens(string: string): HTMLToken[] {
		let lastIndex = 0
		let tokens: HTMLToken[] = []
		let match: RegExpExecArray | null

		while (match = TagRE.exec(string)) {
			let piece = match[0]

			// Intermediate Text
			if (match.index > lastIndex) {
				let text = trimText(string.slice(lastIndex, match.index))
				if (text) {
					tokens.push({
						type: HTMLTokenType.Text,
						start: lastIndex,
						end: match.index,
						text,
					})
				}
			}

			lastIndex = TagRE.lastIndex

			// Comments, Ignore.
			if (piece[1] === '!') {}

			// Close Tag
			else if (piece[1] === '/') {
				let tagName = piece.slice(2, -1)

				if (!SelfClosingTags.includes(tagName)) {
					tokens.push({
						type: HTMLTokenType.EndTag,
						start: match.index,
						end: match.index + piece.length, 
						tagName,
					})
				}
			}

			// Start Tag
			else {
				let tagName = match[1]
				let attrs = parseAttributes(match[2], match.index + tagName.length + 1)
				let selfClose = SelfClosingTags.includes(tagName)

				tokens.push({
					type: HTMLTokenType.StartTag,
					start: match.index,
					end: match.index + piece.length, 
					tagName,
					attrs,
					selfClose,
				})

				//`<tag />` -> `<tag></tag>`
				if (piece[piece.length - 2] === '/' && !selfClose) {
					tokens.push({
						type: HTMLTokenType.EndTag,
						start: lastIndex - 2,
						end: lastIndex, 
						tagName,
					})
				}
			}
		}

		if (lastIndex < string.length) {
			let text = trimText(string.slice(lastIndex))
			if (text) {
				tokens.push({
					type: HTMLTokenType.Text,
					start: lastIndex,
					end: string.length,
					text,
				})
			}
		}

		return tokens
	}

	/** Trim text by removing `\r\n\t` and spaces in the front and end of each line. */
	function trimText(text: string) {
		return text.replace(/^[\r\n\t ]+|[\r\n\t ]+$/gm, '')
			.replace(/[\r\n]/g, '')
	}

	/** Parses a HTML attribute string to an attribute list. */
	function parseAttributes(attr: string, start: number): HTMLAttribute[] {
		let match: RegExpExecArray | null
		let attrs: HTMLAttribute[] = []

		while (match = AttrRE.exec(attr)) {
			let name = match[1]
			let value = match[2]

			let quoted = value ? /^(['"])(.*)\1$/.test(value) : false
			if (quoted) {
				value = value.replace(/^(['"])(.*)\1$/, '$2')
			}

			attrs.push({
				name,
				start: start + match.index,
				value: value ?? null,
				quoted,
			})
		}

		return attrs
	}


	/** Join html tokens to HTML string. */
	export function joinTokens(tokens: HTMLToken[]): string {
		let codes = ''

		for (let token of tokens) {
			switch (token.type) {
				case HTMLTokenType.StartTag:
					let tagName = token.tagName!
					let attribute = joinAttributes(token.attrs!)
					codes += '<' + tagName + attribute + '>'
					break

				case HTMLTokenType.EndTag:
					codes += `</${token.tagName}>`
					break

				case HTMLTokenType.Text:
					codes += token.text!
					break
			}
		}

		return codes
	}

	function joinAttributes(attrs: HTMLAttribute[]) {
		let joined: string[] = []

		for (let {name, value} of attrs) {
			if (/^[.:?@$]/.test(name)) {
				continue
			}

			if (value === null) {
				joined.push(name)
			}
			else {
				if (value.includes('"')) {
					joined.push(name + "='" + value.replace(/[\\']/g, '\\$&') + "'")
				}
				else {
					joined.push(name + '="' + value.replace(/[\\]/g, '\\\\') + '"')
				}
			}
		}
	}
}