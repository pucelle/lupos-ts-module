import {PositionMapper} from '../utils'
import {HTMLNode, HTMLNodeType} from './html-node'
import {HTMLTokenParser, HTMLTokenType} from './html-token-parser'


export class HTMLRoot extends HTMLNode {

	static fromString(string: string, mapper: PositionMapper): HTMLRoot {
		let tokens = HTMLTokenParser.parseToTokens(string)
		let tree = new HTMLRoot()
		let current: HTMLNode | null = tree

		for (let token of tokens) {
			let start = mapper.mapInOrder(token.start)
			let end = mapper.mapInOrder(token.end)

			switch (token.type) {
				case HTMLTokenType.StartTag:
					let attrs = token.attrs!.map(attr => {
						return {
							...attr,
							start: mapper.mapInOrder(attr.start),
						}
					})

					let node = new HTMLNode(HTMLNodeType.Tag, start, end, token.tagName, attrs)
					current.append(node)

					if (!token.selfClose) {
						current = node
					}
					break

				case HTMLTokenType.EndTag:
					do {
						if (current.tagName === token.tagName) {
							current = current.parent
							break
						}

						if (token.tagName === '') {
							current = current.parent
							break
						}

						current = current.parent
					} while (current)

					break

				case HTMLTokenType.Text:
					current.append(new HTMLNode(HTMLNodeType.Text, start, end, undefined, undefined, token.text))
					break

				case HTMLTokenType.Comment:
					current.append(new HTMLNode(HTMLNodeType.Comment, start, end))
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