import {HTMLAttribute, HTMLNode, TemplateSlotString, TemplateSlotValueIndex} from '../html-syntax'


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