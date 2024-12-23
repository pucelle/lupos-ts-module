import {trimText} from '../utils'
import {HTMLAttribute, HTMLNode, HTMLNodeType} from './html-node'
import {HTMLTokenParser, HTMLTokenType, SelfClosingTags} from './html-token-parser'


export class HTMLRoot extends HTMLNode {

	static fromString(string: string): HTMLRoot {
		let tokens = new HTMLTokenParser(string).parseToTokens()
		let tree = new HTMLRoot()
		let current: HTMLNode | null = tree
		let currentAttr: HTMLAttribute | null = null

		for (let token of tokens) {
			let start = token.start
			let end = token.end

			switch (token.type) {
				case HTMLTokenType.StartTagName:
					
					// start is the start of tag name.
					let node = new HTMLNode(HTMLNodeType.Tag, start - 1, -1, token.text, [])
					node.nameEnd = end
					current.append(node)
					current = node
					break

				case HTMLTokenType.EndTagName:
					do {

						// </name>
						if (current.tagName === token.text) {
							current.end = end
							current = current.parent
							break
						}

						// </>
						if (token.text === '') {
							current.end = end
							current = current.parent
							break
						}

						current.end = end
						current = current.parent
					} while (current)
					break

				case HTMLTokenType.TagEnd:
					current.tagEnd = end

					if (current && current.type === HTMLNodeType.Tag
						&& SelfClosingTags.includes(current.tagName!)
					) {
						current.end = end
						current = current.parent
					}
					break

				case HTMLTokenType.SelfCloseTagEnd:
					current.tagEnd = end
					
					if (current && current.type === HTMLNodeType.Tag) {
						current.end = end
						current = current.parent
					}
					break
				
				case HTMLTokenType.AttributeName:
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
					break

				case HTMLTokenType.AttributeValue:
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
					break

				case HTMLTokenType.Text:
					let text = token.text

					if (trimText(text)) {
						let textStart = start
						let textEnd = textStart + text.length

						current.append(new HTMLNode(HTMLNodeType.Text, textStart, textEnd, undefined, undefined, text))
					}
					break

				case HTMLTokenType.Comment:
					let commentText = token.text
					let commentStart = start
					let commentEnd = commentStart + commentText.length

					current.append(new HTMLNode(HTMLNodeType.Comment, commentStart, commentEnd, undefined, undefined, commentText))
					break
			}

			if (!current) {
				break
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

		for (let child of node.children) {
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
