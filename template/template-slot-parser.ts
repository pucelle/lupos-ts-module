import type * as TS from 'typescript'
import {HTMLAttribute, HTMLNode, HTMLNodeType, HTMLRoot, TemplateSlotPlaceholder} from '../html-syntax'
import {Helper} from '../helper'


/** Type of each template slot. */
export enum TemplateSlotType {

	/** `>${...}<`, content, normally a template result, or a list of template result, or null. */
	Content,

	/** Pure text node. */
	Text,

	/** `<slot>` */
	SlotTag,

	/** `<Component>` */
	Component,

	/** `<${} ...>` */
	DynamicComponent,

	/** `<lu:if>`, ... */
	FlowControl,

	/** `<tag attr=...>` */
	Attribute,

	/** `<tag .property=...>` */
	Property,

	/** `<tag @event=...>` */
	Event,

	/** `<tag :class=...>` */
	Binding,
}

export interface TemplateSlot {
	readonly type: TemplateSlotType,
	readonly name: string | null,
	readonly strings: string[] | null
	readonly valueIndices: number[] | null
	readonly node: HTMLNode
	readonly attr: HTMLAttribute | null
	readonly start: number
	readonly end: number
}

/** 
 * It accepts each slot, and return a callback,
 * which will be called after visited all descendant
 */
export type TemplateSlotCallback = (slot: TemplateSlot) => (() => void) | void


/** Parse template node to get all slots. */
export class TemplateSlotParser {

	readonly root: HTMLRoot
	readonly nodeValues: TS.Node[]
	readonly helper: Helper
	readonly callback: TemplateSlotCallback

	constructor(root: HTMLRoot, values: TS.Node[], callback: TemplateSlotCallback, helper: Helper) {
		this.root = root
		this.nodeValues = values
		this.callback = callback
		this.helper = helper
	}

	parse() {
		this.root.visit(this.parseNode.bind(this))
	}

	private parseNode(node: HTMLNode) {
		let callbacks: (() => void)[] = []

		switch (node.type) {
			case HTMLNodeType.Tag:
				let tagName = node.tagName!
				if (tagName === 'slot') {
					callbacks.push(this.parseSlotTag(node))
				}
				else if (TemplateSlotPlaceholder.isNamedComponent(tagName)) {
					callbacks.push(this.parseComponentTag(node))
				}
				else if (TemplateSlotPlaceholder.isDynamicComponent(tagName)) {
					callbacks.push(this.parseDynamicTag(node))
				}
				else if (tagName.startsWith('lu:') && tagName !== 'lu:portal') {
					callbacks.push(this.parseFlowControlTag(node))
				}

				callbacks.push(this.parseAttributes(node))
				break

			case HTMLNodeType.Text:
				callbacks.push(this.parseText(node))
				break
		}
	}

	/** 
	 * Note `node` may not in tree when adding the slot.
	 * It returns a callback to do more init after all children initialized.
	 */
	private onSlot(
		type: TemplateSlotType,
		name: string | null,
		strings: string[] | null,
		valueIndices: number[] | null,
		node: HTMLNode,
		attr: HTMLAttribute | null,
		start: number,
		end: number
	) {
		let slot: TemplateSlot = {
			type,
			name,
			strings,
			valueIndices,
			node,
			attr,
			start,
			end,
		}

		return this.callback(slot) || (() => {})
	}

	private parseSlotTag(node: HTMLNode) {
		let nameAttr = node.attrs!.find(a => a.name === 'name')
		let name = nameAttr?.value || null

		return this.onSlot(TemplateSlotType.SlotTag, name, null, null, node, null, node.tagStart, node.tagEnd)
	}

	private parseComponentTag(node: HTMLNode) {
		return this.onSlot(TemplateSlotType.Component, null, null, null, node, null, node.tagStart, node.tagEnd)
	}

	private parseDynamicTag(node: HTMLNode) {
		let valueIndices = TemplateSlotPlaceholder.getSlotIndices(node.tagName!)
		return this.onSlot(TemplateSlotType.DynamicComponent, null, null, valueIndices, node, null, node.tagStart, node.tagEnd)
	}

	private parseFlowControlTag(node: HTMLNode) {
		return this.onSlot(TemplateSlotType.FlowControl, null, null, null, node, null, node.tagStart, node.tagEnd)
	}

	private parseAttributes(node: HTMLNode) {
		let callbacks: (() => void)[] = []
		let attrs = [...node.attrs!]

		for (let attr of attrs) {
			let {name, value, quoted} = attr
			let type: TemplateSlotType | null = null

			if (name === 'tagName') {
				continue
			}

			// `<tag ...=${...}>
			// `<tag ...="...${...}...">
			let strings = value !== null ? TemplateSlotPlaceholder.parseTemplateStrings(value, quoted) : null
			let valueIndices = value !== null ? TemplateSlotPlaceholder.getSlotIndices(value) : null

			switch (name[0]) {
				case '.':
					type = TemplateSlotType.Property
					break

				case ':':
					type = TemplateSlotType.Binding
					break

				case '?':
					if (name[1] === ':') {
						type = TemplateSlotType.Binding
					}
					else {
						type = TemplateSlotType.Attribute
					}
					break
	
				case '@':
					type = TemplateSlotType.Event
					break

				default:
					if (valueIndices) {
						type = TemplateSlotType.Attribute
					}
			}

			// On component or template, component inner may bind more.
			let isSharedModificationNode = node.tagName === 'template'
				|| node.tagName && TemplateSlotPlaceholder.isComponent(node.tagName)

			// Append attribute, but not set, to $context.el, or component.
			if (type === null && isSharedModificationNode) {
				type = TemplateSlotType.Attribute
			}

			// `<Com class=...>` use `:class` to do binding, to avoid conflict with component inner class attribute.
			// Or `<div class=... :class=...>`, should upgrade `class` to `:class` to avoid it overwrites.
			if (type === TemplateSlotType.Attribute
				&& (name === 'class' || name === 'style')
			) {
				let upgradeToBinding = isSharedModificationNode && valueIndices
					|| attrs.find(attr => attr.name.startsWith(':' + name))

				if (upgradeToBinding) {
					type = TemplateSlotType.Binding
					name = ':' + name
				}
			}

			if (type === null) {
				continue
			}

			if (type !== TemplateSlotType.Attribute) {
				if (name[0] === '?' && name[1] === ':') {
					name = name[0] + name.slice(2)
				}
				else {
					name = name.slice(1)
				}
			}

			node.removeAttr(attr)
			callbacks.push(this.onSlot(type, name, strings, valueIndices, node, attr, attr.nameStart, attr.valueEnd))
		}

		return () => {
			for (let callback of callbacks) {
				callback()
			}
		}
	}

	/** Parse `<tag>${...}</tag>`. */
	private parseText(node: HTMLNode) {
		let callbacks: (() => void)[] = []

		// Note `text` has been trimmed when parsing tokens.
		let text = node.text!
		if (!TemplateSlotPlaceholder.hasSlotIndex(text)) {
			return () => {}
		}

		// Joins all string parts.
		let group = this.groupTextContent(text)

		// Whole text of `...${...}...`
		if (group.length === 1 && group[0].beText) {
			let {strings, valueIndices} = group[0]

			node.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
			node.text = ' '
			callbacks.push(this.onSlot(TemplateSlotType.Text, null, strings, valueIndices, node, null, node.start, node.end))
		}

		// `${html`...`}`
		else if (group.length === 1 && !group[0].beText) {
			let {valueIndices} = group[0]

			let comment = new HTMLNode(HTMLNodeType.Comment, node.start, node.end)
			comment.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(null, valueIndices)
			node.replaceWith(comment)

			callbacks.push(this.onSlot(TemplateSlotType.Content, null, null, valueIndices, comment, null, node.start, node.end))
		}

		// Mixture of Text, Comment, Text, Comment...
		else {
			let addSlotFn: (() => () => void)[] = []

			for (let item of group) {
				let {strings, valueIndices, beText} = item

				// Text, with dynamic content.
				if (beText && valueIndices) {
					let textNode = new HTMLNode(HTMLNodeType.Text, node.start, node.end, undefined, undefined, ' ')
					textNode.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(textNode)

					addSlotFn.push(() => this.onSlot(TemplateSlotType.Text, null, strings, valueIndices, textNode, null, node.start, node.end))
				}

				// Static text.
				else if (beText) {
					let textNode = new HTMLNode(HTMLNodeType.Text, node.start, node.end, undefined, undefined, strings![0])
					textNode.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(textNode)
				}

				// Dynamic content.
				else {
					let comment = new HTMLNode(HTMLNodeType.Comment, node.start, node.end)
					comment.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(comment)
	
					addSlotFn.push(() => this.onSlot(TemplateSlotType.Content, null, null, valueIndices, comment, null, node.start, node.end))
				}
			}
			
			node.remove()

			// Ensure sibling nodes have been cleaned, then add slots.
			for (let fn of addSlotFn) {
				callbacks.push(fn())
			}
		}

		return () => {
			for (let callback of callbacks) {
				callback()
			}
		}
	}
	
	/** Group to get bundling text part, and content part. */
	private groupTextContent(text: string) {

		interface TextContentGroupedItem {
			strings: string[] | null
			valueIndices: number[] | null
			beText: boolean | null
		}

		let strings = TemplateSlotPlaceholder.parseTemplateStrings(text)
		let valueIndices = TemplateSlotPlaceholder.getSlotIndices(text)!

		// If a value index represents a value type of node, it attracts all neighbor strings.
		let current: TextContentGroupedItem = {strings: [], valueIndices: [], beText: true}
		let group: TextContentGroupedItem[] = [current]

		if (!strings) {
			current.strings = null
			current.valueIndices = valueIndices
			current.beText = this.isValueAtIndexValueType(valueIndices[0])

			return group
		}

		for (let i = 0; i < strings.length; i++) {
			let string = strings[i]
			current.strings!.push(string)

			if (i === valueIndices.length) {
				break
			}

			let index = valueIndices[i]
			let beText = this.isValueAtIndexValueType(index)

			if (beText) {
				current.valueIndices!.push(index)
			}
			else {
				group.push({
					strings: null,
					valueIndices: [index],
					beText: false,
				})

				current = {strings: [], valueIndices: [], beText: true}
				group.push(current)
			}
		}

		for (let item of group) {
			if (item.valueIndices!.length === 0) {
				item.valueIndices = null
			}
			
			if (item.strings && item.strings.length === 0) {
				item.strings = null
			}

			if (item.valueIndices === null
				&& item.strings
				&& item.strings.length > 0
				&& item.strings[0].length === 0
			) {
				item.strings = null
			}
		}

		return group.filter(item => {
			return item.strings !== null || item.valueIndices !== null
		})
	}

	/** Check whether a value index represents a value type of node. */
	private isValueAtIndexValueType(index: number): boolean {
		let rawNode = this.nodeValues[index]
		let type = this.helper.types.typeOf(rawNode)

		return this.helper.types.isValueType(type)
	}
}
