import {PositionMapper} from '../utils'
import {HTMLAttribute, HTMLNode, HTMLNodeType} from './html-node'
import {HTMLTokenParser, HTMLTokenType} from './html-token-parser'


export class HTMLRoot extends HTMLNode {

	static fromString(string: string, mapper: PositionMapper): HTMLRoot {
		let tokens = HTMLTokenParser.parseToTokens(string)
		let tree = new HTMLRoot()
		let current: HTMLNode | null = tree
		let currentAttr: HTMLAttribute | null = null

		for (let token of tokens) {
			let start = mapper.mapInOrder(token.start)
			let end = mapper.mapInOrder(token.end)

			switch (token.type) {
				case HTMLTokenType.StartTagName:
					let node = new HTMLNode(HTMLNodeType.Tag, start, end, token.text, [])
					current.append(node)
					current = node
					break

				case HTMLTokenType.EndTagName:
					do {
						if (current.tagName === token.text) {
							current = current.parent
							break
						}

						if (token.text === '') {
							current = current.parent
							break
						}

						current = current.parent
					} while (current)
					break

				case HTMLTokenType.TagEnd:
					if (current && current.type === HTMLNodeType.Tag
						&& HTMLTokenParser.SelfClosingTags.includes(current.tagName!)
					) {
						current = current.parent
					}
					break

				case HTMLTokenType.SelfCloseTagEnd:
					if (current && current.type === HTMLNodeType.Tag) {
						current = current.parent
					}
					break
				
				case HTMLTokenType.AttributeName:
					if (current && current.type === HTMLNodeType.Tag) {
						currentAttr = {
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
						currentAttr.rawValue = token.text
						currentAttr.value = value
						currentAttr.quoted = quoted
					}
					break

				case HTMLTokenType.Text:
					let text = trimText(token.text)
					if (text) {
						current.append(new HTMLNode(HTMLNodeType.Text, start, end, undefined, undefined, text))
					}
					break

				case HTMLTokenType.CommentText:
					current.append(new HTMLNode(HTMLNodeType.Comment, start, end, undefined, undefined, token.text.trim()))
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


/** Trim text by removing `\r\n\t` and spaces in the front and end of each line. */
function trimText(text: string) {
	return text.replace(/^[\r\n\t ]+|[\r\n\t ]+$/gm, '')
		.replace(/[\r\n]/g, '')
}
