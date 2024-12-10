import type * as TS from 'typescript'


export interface LuposItem {

	/** Defined name, class name or property name. */
	readonly name: string

	/** Node of it's defined name. */
	readonly nameNode: TS.Node

	/** Description is leading comment of definition. */
	readonly description: string

	/** Type of item. */
	readonly type: TS.Type

	/** Source file in. */
	readonly sourceFile: TS.SourceFile
}

export interface LuposProperty extends LuposItem {

	/** Whether property is public. */
	readonly public: boolean
}

/** Lupos event. */
export interface LuposEvent extends LuposItem {}

export interface LuposBinding extends LuposItem {

	/** Defined class declaration. */
	readonly declaration: TS.ClassDeclaration
}

export interface LuposComponent extends LuposItem {

	/** Defined class declaration. */
	readonly declaration: TS.ClassDeclaration

	/** Component public properties, not include properties of super classes. */
	readonly properties: Record<string, LuposProperty>

	/** Component events, include all events even from super classes. */
	readonly events: Record<string, LuposEvent>

	/** Component slot elements. */
	readonly slotElements: Record<string, LuposProperty>
}
