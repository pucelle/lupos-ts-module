import type * as TS from 'typescript'
import {HTMLAttribute, HTMLNode, HTMLNodeType, HTMLRoot, TemplateSlotPlaceholder, TemplateSlotString, TemplateSlotValueIndex} from '../html-syntax'
import {Helper} from '../helper'


/** Type of each template part. */
export enum TemplatePartType {

	/** `<lu:...>`, `<slot>`, or any of `<[a-z]+`. */
	NormalStartTag,

	/** `<slot>` */
	SlotTag,

	/** `<Component>` */
	Component,

	/** `<${...} ...>` */
	DynamicComponent,

	/** `<lu:if>`, ... */
	FlowControl,

	/** `>${...}<`, content, normally a template result, or a list of template result, or null. */
	Content,

	/** Text node, with slot inside. */
	SlottedText,

	/** Text node, without any slot inside. */
	UnSlottedText,

	/** 
	 * `<tag ?attr=${...}>`
	 * Query attribute.
	 */
	QueryAttribute,

	/** 
	 * `<tag attr=${...}>`
	 * Some static attribute also use this type, like `<template class="...">`.
	 */
	SlottedAttribute,

	/** `<tag attr=...>`, without any slot expressions `${...}`. */
	UnSlottedAttribute,

	/** `<tag :class=...>` */
	Binding,

	/** `<tag .property=...>` */
	Property,

	/** `<tag @event=...>` or `<com @event=...>` */
	Event,
}

export interface TemplatePart {
	readonly type: TemplatePartType

	/** 
	 * Raw name string, can be property or attribute name, or tag name.
	 * Note it doesn't include tag name.
	 */
	readonly rawName: string | null

	/** Like `.`, `@`, `:`. */
	readonly namePrefix: string | null

	/** 
	 * Name after excluding prefix and modifiers.
	 * Note it doesn't include tag name.
	 */
	readonly mainName: string | null

	readonly modifiers: string[] | null
	readonly strings: TemplateSlotString[] | null
	readonly valueIndices: TemplateSlotValueIndex[] | null
	readonly node: HTMLNode
	readonly attr: HTMLAttribute | null

	/** For `<tag>`, is the start of tag name, based on template string position. */
	readonly start: number

	/** For `<tag>`, is the end of tag name, based on template string position.. */
	readonly end: number
}

/** 
 * It accepts each part, and return a callback,
 * which will be called after visited all descendant
 */
export type TemplatePartCallback = (part: TemplatePart) => (() => void) | void


/** Parse template node to get all parts. */
export class TemplatePartParser {

	readonly root: HTMLRoot
	readonly valueNodes: TS.Node[]

	/** Whether can modify nodes and do text trimming. */
	readonly canModify: boolean

	readonly callback: TemplatePartCallback
	readonly helper: Helper

	constructor(root: HTMLRoot, values: TS.Node[], canModify: boolean, callback: TemplatePartCallback, helper: Helper) {
		this.root = root
		this.valueNodes = values
		this.canModify = canModify
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
					let callback = this.parseSlotTag(node)
					if (callback) {
						callbacks.push(callback)
					}
				}
				else if (TemplateSlotPlaceholder.isNamedComponent(tagName)) {
					let callback = this.parseComponentTag(node)
					if (callback) {
						callbacks.push(callback)
					}
				}
				else if (TemplateSlotPlaceholder.isDynamicComponent(tagName)) {
					let callback = this.parseDynamicTag(node)
					if (callback) {
						callbacks.push(callback)
					}
				}
				else if (tagName.startsWith('lu:') && tagName !== 'lu:portal') {
					let callback = this.parseFlowControlTag(node)
					if (callback) {
						callbacks.push(callback)
					}
				}
				else if (node !== this.root) {
					let callback = this.onNormalStartTag(node)
					if (callback) {
						callbacks.push(callback)
					}
				}

				callbacks.push(this.parseAttributes(node))
				break

			case HTMLNodeType.Text:
				callbacks.push(this.parseText(node))
				break
		}

		return () => {
			for (let callback of callbacks) {
				callback()
			}
		}
	}

	private onNormalStartTag(node: HTMLNode) {
		return this.onPart({
			type: TemplatePartType.NormalStartTag,
			rawName: node.tagName!,
			namePrefix: null,
			mainName: node.tagName!,
			modifiers: null,
			strings: null,
			valueIndices: null,
			node,
			attr: null,
			start: node.nameStart,
			end: node.nameEnd,
		})
	}

	/** 
	 * Note `node` may not in tree when accepting the part.
	 * It returns a callback to do more init after all children initialized.
	 */
	private onPart(part: TemplatePart) {
		return this.callback(part)
	}

	private parseSlotTag(node: HTMLNode) {
		let nameAttr = node.attrs!.find(a => a.name === 'name')
		let name = nameAttr?.value || null

		return this.onPart({
			type: TemplatePartType.SlotTag,
			rawName: name,
			namePrefix: null,
			mainName: name,
			modifiers: null,
			strings: null,
			valueIndices: null,
			node,
			attr: null,
			start: node.nameStart,
			end: node.nameEnd,
		})
	}

	private parseComponentTag(node: HTMLNode) {
		return this.onPart({
			type: TemplatePartType.Component,
			rawName: null,
			namePrefix: null,
			mainName: null,
			modifiers: null,
			strings: null,
			valueIndices: null,
			node,
			attr: null,
			start: node.nameStart,
			end: node.nameEnd,
		})
	}

	private parseDynamicTag(node: HTMLNode) {
		let valueIndex = TemplateSlotPlaceholder.getUniqueSlotIndex(node.tagName!)

		let valueIndices: TemplateSlotValueIndex[] | null = valueIndex !== null
			? [{index: valueIndex, start: node.nameStart, end: node.nameEnd}]
			: null

		return this.onPart({
			type: TemplatePartType.DynamicComponent,
			rawName: null,
			namePrefix: null,
			mainName: null,
			modifiers: null,
			strings: null,
			valueIndices,
			node,
			attr: null,
			start: node.nameStart,
			end: node.nameEnd,
		})
	}

	private parseFlowControlTag(node: HTMLNode) {
		return this.onPart({
			type: TemplatePartType.FlowControl,
			rawName: null,
			namePrefix: null,
			mainName: null,
			modifiers: null,
			strings: null,
			valueIndices: null,
			node,
			attr: null,
			start: node.nameStart,
			end: node.nameEnd,
		})
	}

	private parseAttributes(node: HTMLNode) {
		let callbacks: (() => void)[] = []
		let attrs = [...node.attrs!]

		for (let attr of attrs) {
			let {name, value, quoted} = attr
			let type: TemplatePartType | null = null
			let namePrefix = name.match(/^[.:?@]{1,2}/)?.[0] ?? ''
			let nameAfterPrefix = namePrefix ? name.slice(namePrefix.length) : name
			let [nameUnPrefixedModified, ...modifiers] = nameAfterPrefix.split('.')

			// Specifies custom tagName for component.
			if (name === 'tagName') {
				node.removeAttr(attr)
				let callback = this.onUnSlottedAttribute(attr, node)
				if (callback) {
					callbacks.push(callback)
				}
				continue
			}

			// `<tag ...=${...}>
			// `<tag ...="...${...}...">
			let parsed = value !== null ? TemplateSlotPlaceholder.parseTemplateContent(value, quoted, attr.valueStart) : null
			let strings = parsed ? parsed.strings : null
			let valueIndices = parsed ? parsed.valueIndices : null
			let prefixFirstChar = namePrefix ? namePrefix[0] : ''
			
			switch (prefixFirstChar) {
				case '.':
					type = TemplatePartType.Property
					break

				case ':':
					type = TemplatePartType.Binding
					break

				case '?':

					// `?:` binding
					if (namePrefix.length > 1 && namePrefix[1] === ':') {
						type = TemplatePartType.Binding
					}
					else {
						type = TemplatePartType.QueryAttribute
					}
					break

				case '@':
					type = TemplatePartType.Event
					break

				default:
					if (valueIndices) {
						type = TemplatePartType.SlottedAttribute
					}
			}

			// On component or template, component inner may add more.
			let isSharedModification = node.tagName === 'template'
				|| node.tagName && TemplateSlotPlaceholder.isComponent(node.tagName)
				|| (name === 'class' || name === 'style') && attrs.find(attr => attr.name.startsWith(':' + name))

			// To add attribute, but not fully set.
			if (type === null && isSharedModification) {
				type = TemplatePartType.SlottedAttribute
			}

			// `<Com class=...>` use `:class` to do binding, to avoid conflict with component inner class attribute.
			// Or `<div class=... :class=...>`, should upgrade `class` to `:class` to avoid it `setAttributes('class')` overwrites.
			if (type === TemplatePartType.SlottedAttribute
				&& (name === 'class' || name === 'style')
			) {
				let upgradeToBinding = isSharedModification && valueIndices
				if (upgradeToBinding) {
					type = TemplatePartType.Binding
				}
			}

			if (type === null) {
				let callback = this.onUnSlottedAttribute(attr, node)
				if (callback) {
					callbacks.push(callback)
				}
				continue
			}

			else {
				node.removeAttr(attr)

				let callback = this.onPart({
					type,
					rawName: name,
					namePrefix,
					mainName: nameUnPrefixedModified,
					modifiers,
					strings,
					valueIndices,
					node,
					attr,
					start: attr.start,
					end: attr.end,
				})

				if (callback) {
					callbacks.push(callback)
				}
			}
		}

		return () => {
			for (let callback of callbacks) {
				callback()
			}
		}
	}

	private onUnSlottedAttribute(attr: HTMLAttribute, node: HTMLNode) {
		return this.onPart({
			type: TemplatePartType.UnSlottedAttribute,
			rawName: attr.name,
			namePrefix: null,
			mainName: attr.name,
			modifiers: null,
			strings: null,
			valueIndices: null,
			node,
			attr,
			start: attr.start,
			end: attr.end,
		})
	}

	/** Parse `<tag>${...}</tag>`. */
	private parseText(node: HTMLNode) {
		let callbacks: (() => void)[] = []

		// Try to join all neighbor string sections.
		let group = this.groupTextContent(node)

		// Whole text of `...${...}...`
		if (group.length === 1 && group[0].beText) {
			let {strings, valueIndices} = group[0]

			node.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)

			// Text will be generated by bound slot.
			if (this.canModify) {
				if (valueIndices) {
					node.text = ' '
				}
				else {
					node.text = strings![0].text
				}
			}

			let callback = this.onPart({
				type: valueIndices ? TemplatePartType.SlottedText : TemplatePartType.UnSlottedText,
				rawName: null,
				namePrefix: null,
				mainName: null,
				modifiers: null,
				strings,
				valueIndices,
				node,
				attr: null,
				start: node.start,
				end: node.end,
			})

			if (callback) {
				callbacks.push(callback)
			}
		}

		// `${html`...`}`
		else if (group.length === 1 && !group[0].beText) {
			let {valueIndices} = group[0]

			let comment = new HTMLNode(HTMLNodeType.Comment, node.start, node.end)
			comment.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(null, valueIndices)
			node.replaceWith(comment)

			let callback = this.onPart({
				type: TemplatePartType.Content,
				rawName: null,
				namePrefix: null,
				mainName: null,
				modifiers: null,
				strings: null,
				valueIndices,
				node: comment,
				attr: null,
				start: node.start,
				end: node.end,
			})

			if (callback) {
				callbacks.push(callback)
			}
		}

		// Mixture of Text, Comment, Text, Comment...
		else {
			let addSlotFns: (() => (() => void) | void)[] = []

			for (let item of group) {
				let {strings, valueIndices, beText} = item
				let {start, end} = TemplateSlotPlaceholder.getOffsetsByStringsAndValueIndices(strings, valueIndices)!

				// Text, with dynamic content.
				if (beText && valueIndices) {
					let textNode = new HTMLNode(HTMLNodeType.Text, node.start, node.end, undefined, undefined, ' ')
					textNode.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(textNode)

					let addSlotFn = () => this.onPart({
						type: TemplatePartType.SlottedText,
						rawName: null,
						namePrefix: null,
						mainName: null,
						modifiers: null,
						strings,
						valueIndices,
						node: textNode,
						attr: null,
						start,
						end,
					})

					addSlotFns.push(addSlotFn)
				}

				// Static text.
				else if (beText) {
					let textNode = new HTMLNode(HTMLNodeType.Text, node.start, node.end, undefined, undefined, strings![0].text)
					textNode.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(textNode)
				}

				// Dynamic content.
				else {
					let comment = new HTMLNode(HTMLNodeType.Comment, node.start, node.end)
					comment.desc = TemplateSlotPlaceholder.joinStringsAndValueIndices(strings, valueIndices)
					node.before(comment)

					let addSlotFn = () => this.onPart({
						type: TemplatePartType.Content,
						rawName: null,
						namePrefix: null,
						mainName: null,
						modifiers: null,
						strings,
						valueIndices,
						node: comment,
						attr: null,
						start,
						end,
					})

					addSlotFns.push(addSlotFn)
				}
			}
			
			node.remove()

			// Ensure sibling nodes have been cleaned, then add slots.
			for (let fn of addSlotFns) {
				let callback = fn()
				if (callback) {
					callbacks.push(callback)
				}
			}
		}

		return () => {
			for (let callback of callbacks) {
				callback()
			}
		}
	}
	
	/** Group to get bundling text part, and content part. */
	private groupTextContent(node: HTMLNode) {
		interface TextContentGroupedItem {
			strings: TemplateSlotString[] | null
			valueIndices: TemplateSlotValueIndex[] | null
			beText: boolean
		}

		let text = node.text!
		let {strings, valueIndices} = TemplateSlotPlaceholder.parseTemplateContent(text, false, node.start)

		// If a value index represents a value type of node, it attracts all neighbor strings.
		let current: TextContentGroupedItem = {strings: [], valueIndices: [], beText: true}
		let group: TextContentGroupedItem[] = [current]

		// Can't modify and trim.
		if (!this.canModify) {
			current.strings = strings
			current.valueIndices = valueIndices
			current.beText = true

			return group
		}
		
		// Must trim before splitting text.
		strings = TemplateSlotPlaceholder.trimStrings(strings)

		// Has no index.
		if (!valueIndices) {
			current.strings = strings
			current.valueIndices = null
			current.beText = true

			return group
		}

		// Has only value index.
		if (!strings) {
			current.strings = null
			current.valueIndices = valueIndices
			current.beText = this.isValueAtIndexValueType(valueIndices[0].index)

			return group
		}

		for (let i = 0; i < strings.length; i++) {
			let string = strings[i]
			current.strings!.push(string)

			if (i === valueIndices.length) {
				break
			}

			let valueIndex = valueIndices[i]
			let beText = this.isValueAtIndexValueType(valueIndex.index)

			if (beText) {
				current.valueIndices!.push(valueIndex)
			}
			else {
				group.push({
					strings: null,
					valueIndices: [valueIndex],
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
				&& item.strings[0].text.length === 0
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
		let rawNode = this.valueNodes[index]
		let type = this.helper.types.typeOf(rawNode)

		return this.helper.types.isValueType(type)
	}
}

