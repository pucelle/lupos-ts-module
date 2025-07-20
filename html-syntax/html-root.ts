import {trimText} from '../utils'
import {HTMLAttribute, HTMLNode, HTMLNodeType} from './html-node'
import {HTMLTokenScanner, HTMLTokenType, SelfClosingTags} from './html-token-scanner'


export class HTMLRoot extends HTMLNode {

	static fromString(string: string): HTMLRoot {
		let tokens = new HTMLTokenScanner(string).parseToTokens()
		let tree = new HTMLRoot()
		let current: HTMLNode = tree
		let currentAttr: HTMLAttribute | null = null

		for (let token of tokens) {
			let start = token.start
			let end = token.end

			if (token.type === HTMLTokenType.StartTagName) {
				
				// start is the start of tag name.
				let node = new HTMLNode(HTMLNodeType.Tag, start, -1, token.text, [])
				node.nameEnd = end
				current.append(node)
				current = node
			}

			else if (token.type === HTMLTokenType.EndTagName) {
				let toMatch = current

				do {

					// </name>
					if (toMatch.tagName === token.text) {
						break
					}

					// </>
					if (token.text === '') {
						break
					}

					toMatch = toMatch.parent ?? tree
				} while (toMatch !== tree)

				// If can't find match, here it simply close all tags.
				// So it doesn't fix tag closing like normal HTML parser do.
				// Fixing tag closing, especially distinguishing which tag can and can't contains which
				// is too complex, and it must ensure it has same logic with browser,
				// or will get a wrong HTML tree structure.
				toMatch.closureEnd = end
				current = toMatch.parent ?? tree
			}

			else if (token.type === HTMLTokenType.TagEnd) {
				current.tagEnd = end

				if (current && current.type === HTMLNodeType.Tag
					&& SelfClosingTags.includes(current.tagName!)
				) {
					current.closureEnd = end
					current = current.parent ?? tree
				}
			}

			else if (token.type === HTMLTokenType.SelfCloseTagEnd) {
				current.tagEnd = end
				
				if (current && current.type === HTMLNodeType.Tag) {
					current.closureEnd = end
					current = current.parent ?? tree
				}
			}
			
			else if (token.type === HTMLTokenType.AttributeName) {
				if (current && current.type === HTMLNodeType.Tag) {
					currentAttr = {
						start: token.start,
						end: token.end,
						nameStart: token.start,
						nameEnd: token.end,
						valueStart: -1,
						valueEnd: -1,
						name: token.text,
						rawValue: null,
						value: null,
						quoted: false,
					}
					
					current.attrs!.push(currentAttr)
				}
			}

			else if (token.type === HTMLTokenType.AttributeValue) {
				if (currentAttr) {
					let quoted = token.text[0] === '"' || token.text[0] === '\''
					let value = token.text

					if (quoted) {
						value = value.replace(/\\([\\'"])/g, '$1').slice(1, -1)
					}

					currentAttr.valueStart = token.start
					currentAttr.valueEnd = token.end
					currentAttr.end = token.end
					currentAttr.rawValue = token.text
					currentAttr.value = value
					currentAttr.quoted = quoted
				}
			}

			else if (token.type === HTMLTokenType.Text) {
				let text = token.text

				if (trimText(text)) {
					current.append(new HTMLNode(HTMLNodeType.Text, start, end, undefined, undefined, text))
				}
			}

			else if (token.type === HTMLTokenType.CommentText) {
				let comment = new HTMLNode(HTMLNodeType.Comment, start, end, undefined, undefined, token.text)
				current.append(comment)
			}
		}

		return tree
	}

	static fromSeparating(node: HTMLNode): HTMLRoot {
		node.remove()
		let tree = new HTMLRoot()
		tree.append(node)

		return tree
	}

	static fromSeparatingChildren(node: HTMLNode): HTMLRoot {
		let root = new HTMLRoot()

		for (let child of [...node.children]) {
			child.remove()
			root.append(child)
		}

		return root
	}

	constructor() {
		super(HTMLNodeType.Tag, -1, -1, 'root', [])
	}

	getContentHTMLString() {
		if (this.firstChild?.tagName === 'template') {
			return this.firstChild.getContentHTMLString()
		}
		else {
			return super.getContentHTMLString()
		}
	}
}
