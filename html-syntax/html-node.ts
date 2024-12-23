import {TemplateSlotPlaceholder} from './template-slot-placeholder'
import {SelfClosingTags} from './html-token-parser'


export enum HTMLNodeType {
	Tag,
	Text,
	Comment,
}

/** Attribute names and values */
export interface HTMLAttribute {

	name: string

	/** Original attribute value. */
	rawValue: string | null

	/** Quotes have been removed. */
	value: string | null

	/** Whether raw attribute value has been quoted. */
	quoted: boolean

	/** Whether has been removed. */
	removed?: boolean

	/** Start offset based on template string position. */
	start: number

	/** Start offset based on template string position. */
	end: number

	/** Start offset of attribute name based on template string position. */
	nameStart: number

	/** Start offset of attribute name based on template string position. */
	nameEnd: number

	/** Start offset of attribute value based on template string, includes quotes, be `-1` if has no value. */
	valueStart: number

	/** End offset of attribute value based on template string, includes quotes, be `-1` if has no value. */
	valueEnd: number
}


export class HTMLNode {

	readonly type: HTMLNodeType
	readonly tagName: string | undefined

	/** Start offset of node name based on template string position. */
	start: number

	/** 
	 * End offset of node based on template string position.
	 * For tag node, `end` is the end of mapped end tag.
	  */
	end: number = -1
	
	/** 
	 * Start offset of tag based on template string position.
	 * For non-tag nodes is always `-1`.
	 */
	tagStart: number = -1

	/** 
	 * End offset of tag based on template string position.
	 * For non-tag nodes is always `-1`.
	 */
	tagEnd: number = -1

	/** 
	 * Start offset of tag name based on template string position.
	 * For non-tag nodes is always `-1`.
	 */
	nameStart: number = -1

	/** 
	 * End offset of tag name based on template string position.
	 * For non-tag nodes is always `-1`.
	 */
	nameEnd: number = -1

	/** Note this text has been trimmed. */
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

		if (type === HTMLNodeType.Tag) {
			this.tagStart = start
			this.nameStart = start + 1
		}

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

	/** Get content string which still include slot indices and text not been trimmed. */
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
	
			if (SelfClosingTags.includes(tagName)) {
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
