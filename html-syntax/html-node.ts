import {TemplateSlotPlaceholder} from './template-slot-placeholder'
import {HTMLAttribute, HTMLTokenParser} from './html-token-parser'


export enum HTMLNodeType {
	Tag,
	Text,
	Comment,
}

export class HTMLNode {

	type: HTMLNodeType
	start: number
	end: number
	tagName: string | undefined
	text: string | undefined
	attrs: HTMLAttribute[] | undefined

	/** Description for text and comment node. */
	desc: string | null = null

	children: HTMLNode[] = []
	parent: HTMLNode | null = null

	constructor(type: HTMLNodeType, start: number, end: number, tagName?: string, attrs?: HTMLAttribute[], text?: string) {
		this.type = type
		this.start = start
		this.end = end
		this.tagName = tagName
		this.attrs = attrs
		this.text = text
	}

	private setParent(parent: HTMLNode | null) {
		this.parent = parent
	}

	get siblingIndex(): number {
		return this.parent!.children.indexOf(this)!
	}

	append(...children: HTMLNode[]) {
		this.children.push(...children)
		children.forEach(c => c.setParent(this))
	}

	prepend(...children: HTMLNode[]) {
		this.children.unshift(...children)
		children.forEach(c => c.setParent(this))
	}

	childAt(index: number): HTMLNode | null {
		return index >= 0 && index < this.children.length ? this.children[index] : null
	}

	before(...siblings: HTMLNode[]) {
		this.parent!.children.splice(this.siblingIndex, 0, ...siblings)
		siblings.forEach(s => s.setParent(this.parent))
	}

	after(...siblings: HTMLNode[]) {
		this.parent!.children.splice(this.siblingIndex + 1, 0, ...siblings)
		siblings.forEach(s => s.setParent(this.parent))
	}

	get previousSibling() {
		return this.parent!.childAt(this.siblingIndex - 1)
	}

	get nextSibling() {
		return this.parent!.childAt(this.siblingIndex + 1)
	}

	get firstChild(): HTMLNode | null {
		return this.childAt(0)
	}

	get lastChild(): HTMLNode | null {
		return this.childAt(this.children.length - 1)
	}

	/** 
	 * Visitor get a node each time, in `parent->child` order.
	 * It map return a callback, call it after visited all descendants.
	 */
	visit(visitor: (node: HTMLNode) => (() => void) | void) {
		let callback = visitor(this)

		for (let child of [...this.children]) {

			// May be removed when walking.
			if (child.parent !== this) {
				continue
			}

			child.visit(visitor)
		}
		
		callback?.()
	}

	/** Remove all child nodes. */
	empty() {
		this.children = []
	}

	remove() {
		let index = this.parent!.children.indexOf(this)
		if (index > -1) {
			this.parent!.children.splice(index, 1)
			this.setParent(null)
		}
	}

	/** Remove self, but keep children to replace it's position. */
	removeSelf() {
		let index = this.siblingIndex
		this.parent!.children.splice(index, 1, ...this.children)
		this.setParent(null)
	}

	removeAttr(attr: HTMLAttribute) {
		attr.removed = true
	}

	wrapWith(tagName: string, attrs: HTMLAttribute[] = []) {
		let newNode = new HTMLNode(HTMLNodeType.Tag, -1, -1, tagName, attrs)
		let index = this.siblingIndex

		this.parent!.children[index] = newNode
		newNode.setParent(this.parent)
		newNode.append(this)
	}

	/** Append all children to a new node, and append it to self. */
	wrapChildrenWith(tagName: string, attrs: HTMLAttribute[] = []) {
		let newNode = new HTMLNode(HTMLNodeType.Tag, -1, -1, tagName, attrs)
		newNode.append(...this.children)

		this.children = []
		this.append(newNode)
	}

	replaceWith(...nodes: HTMLNode[]) {
		let index = this.siblingIndex
		this.parent!.children.splice(index, 1, ...nodes)

		for (let node of nodes) {
			node.setParent(this.parent)
		}

		this.setParent(null)
	}

	closest(tag: string): HTMLNode | null {
		let node: HTMLNode | null = this

		while (node && node.tagName !== tag) {
			node = node.parent
		}

		return node
	}

	/** Get string which still include slot indices. */
	toString(): string {
		if (this.type === HTMLNodeType.Tag) {
			let tagName = this.tagName!
			let children = this.children

			return `<${tagName}${this.toStringOfAttrs(true)}${children.length === 0 ? ' /' : ''}>`
				+ children.map(child => child.toString()).join('')
				+ (children.length > 0
					? `</${TemplateSlotPlaceholder.isDynamicComponent(tagName) ? '' : tagName}>`
					: ''
				)
		}
		else if (this.type === HTMLNodeType.Text) {
			return this.text || ''
		}
		else {
			return `<!--${this.text || ''}-->`
		}
	}

	/** Get content string which still include slot indices. */
	getContentString(): string {
		return this.children.map(child => child.toString()).join('')
	}

	/** 
	 * Output attribute to string.
	 * `includeRemoved` indicates whether should output removed attributes.
	 */
	toStringOfAttrs(includeRemoved: boolean): string {
		let joined: string[] = []

		for (let {name, value, removed, quoted} of this.attrs!) {
			if (!includeRemoved && removed) {
				continue
			}

			if (value === null) {
				joined.push(name)
			}
			else {
				if (TemplateSlotPlaceholder.isCompleteSlotIndex(value) && !quoted) {
					joined.push(name + "=" + value)
				}
				else if (value.includes('"')) {
					joined.push(name + "='" + value.replace(/[\\']/g, '\\$&') + "'")
				}
				else {
					joined.push(name + '="' + value.replace(/[\\]/g, '\\\\') + '"')
				}
			}
		}

		return joined.map(v => ' ' + v).join('')
	}

	/** Get string for building HTML nodes. */
	toHTMLString(): string {
		if (this.type === HTMLNodeType.Tag) {
			let tagName = this.tagName!

			// Flow control
			if (tagName.startsWith('lu:') && tagName !== 'lu:portal') {
				return `<!---->`
			}

			// Portal
			if (tagName === 'lu:portal') {
				tagName = 'template'
			}

			// Component
			else if (TemplateSlotPlaceholder.isComponent(tagName)) {
				tagName = 'div'
			}

			// Specifies custom tagName.
			let tagNameAttr = this.attrs!.find(attr => attr.name === 'tagName')
			if (tagNameAttr) {
				tagName = tagNameAttr.value ?? tagName
				this.removeAttr(tagNameAttr)
			}
	
			if (HTMLTokenParser.SelfClosingTags.includes(tagName)) {
				return `<${tagName}${this.toStringOfAttrs(false)} />`
			}

			let contents = this.children.map(child => child.toHTMLString()).join('')
			return `<${tagName}${this.toStringOfAttrs(false)}>${contents}</${tagName}>`
		}
		else if (this.type === HTMLNodeType.Text) {
			return this.text!
		}
		else {
			return `<!---->`
		}
	}

	/** Get html string of all the contents. */
	getContentHTMLString() {
		return this.children.map(child => child.toHTMLString()).join('')
	}
}
