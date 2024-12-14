import type * as TS from 'typescript'
import {analyzeLuposComponents, createLuposComponent} from './components'
import {LuposBinding, LuposComponent, LuposEvent, LuposProperty} from './types'
import {analyzeLuposBindings, createLuposBinding} from './bindings'
import {Helper} from '../helper'
import {ListMap} from '../utils'
import {TemplateBasis} from '../template'


/** 
 * In a plugin, it can visit sources across whole workspace.
 * In a transformer, it can only visit current source file and all resolved.
 */
export class Analyzer {

	readonly helper: Helper

	/** Latest analyzed source files. */
	protected files: Set<TS.SourceFile> = new Set()

	/** Analyzed components by source file. */
	protected componentsByFile: ListMap<TS.SourceFile, LuposComponent> = new ListMap()

	/** Analyzed components by name. */
	protected componentsByName: ListMap<string, LuposComponent> = new ListMap()

	/** Analyzed bindings by name. */
	protected bindingsByName: ListMap<string, LuposBinding> = new ListMap()

	/** Analyzed bindings by source file. */
	protected bindingsByFile: ListMap<TS.SourceFile, LuposBinding> = new ListMap()

	constructor(helper: Helper) {
		this.helper = helper
	}

	/** Analyze each ts source file. */
	protected analyzeTSFile(sourceFile: TS.SourceFile) {
		let components = analyzeLuposComponents(sourceFile, this.helper)
		let bindings = analyzeLuposBindings(sourceFile, this.helper)

		this.files.add(sourceFile)

		for (let component of components) {
			this.componentsByName.add(component.name, component)
			this.componentsByFile.add(component.sourceFile, component)
		}
	
		for (let binding of bindings) {
			this.bindingsByName.add(binding.name, binding)
			this.bindingsByFile.add(binding.sourceFile, binding)
		}
	}

	/** Make parsed results in given file expire. */
	protected makeFileExpire(file: TS.SourceFile) {

		// Components expired.
		for (let component of [...this.componentsByFile.get(file) || []]) {
			this.componentsByName.delete(component.name, component)
			this.componentsByFile.delete(component.sourceFile, component)
		}

		// Binding expired.
		for (let binding of [...this.bindingsByFile.get(file) || []]) {
			this.bindingsByName.delete(binding.name, binding)
			this.bindingsByFile.delete(binding.sourceFile, binding)
		}
	}

	/** Iterate all components. */
	protected get components(): Iterable<LuposComponent> {
		return this.componentsByFile.values()
	}

	/** Iterate all bindings. */
	protected get bindings(): Iterable<LuposBinding> {
		return this.bindingsByFile.values()
	}

	/** Get components by name across all workspace. */
	getWorkspaceComponentsByName(name: string): LuposComponent[] | undefined {
		return this.componentsByName.get(name)
	}

	/** 
	 * Get component by template part, the and template.
	 * `tagName` can be dynamic component interpolation.
	 * Component must be imported.
	 */
	getComponentByTagName(tagName: string, template: TemplateBasis): LuposComponent | undefined {
		for (let component of this.walkPossibleComponentsByTagName(tagName, template)) {
			return component
		}

		return undefined
	}

	/** 
	 * Iterate all possible components by template part tag name.
	 * `tagName` can be dynamic component interpolation.
	 */
	protected *walkPossibleComponentsByTagName(tagName: string, template: TemplateBasis): Iterable<LuposComponent> {
		let classDecls = template.resolveComponentDeclarations(tagName)

		for (let decl of classDecls) {
			let component = this.getComponentByDeclaration(decl)
			if (component) {
				yield component
			}
		}
	}

	/** 
	 * Get component by it's class declaration, use it for completion.
	 * `declaration` can also be a any level local declaration.
	 */
	getComponentByDeclaration(declaration: TS.ClassDeclaration): LuposComponent | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeTSFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposComponent(declaration, this.helper)
		}

		let components = this.componentsByFile.get(sourceFile)
		if (components) {
			return components?.find(c => c.declaration === declaration)
		}

		return undefined
	}

	/** Walk component and it's super classes. */
	protected *walkComponents(component: LuposComponent, deep = 0): Generator<LuposComponent> {
		yield component

		for (let superClass of this.helper.class.walkSuper(component.declaration)) {
			let superComponent = this.getComponentByDeclaration(superClass)
			if (!superComponent) {
				continue
			}

			yield *this.walkComponents(superComponent, deep + 1)
		}
	}

	/** Get a property by name of a component. */
	getComponentProperty(component: LuposComponent, propertyName: string): LuposProperty | undefined {
		for (let com of this.walkComponents(component)) {
			if (com.properties[propertyName]) {
				return com.properties[propertyName]
			}
		}

		return undefined
	}

	/** Get all refs or slots properties outer class declaration contains given node. */
	getComponentSubProperties(component: LuposComponent, propertyName: 'slotElements', subPropertyName: string): LuposProperty | undefined {
		for (let com of this.walkComponents(component)) {
			if (com[propertyName][subPropertyName]) {
				return com[propertyName][subPropertyName]
			}
		}

		return undefined
	}

	
	/** Get event of a component. */
	getComponentEvent(component: LuposComponent, eventName: string): LuposEvent | undefined {
		for (let com of this.walkComponents(component)) {
			if (com.events[eventName]) {
				return com.events[eventName]
			}
		}

		return undefined
	}


	/** Get bindings across whole space by name. */
	getWorkspaceBindingsByName(name: string): LuposBinding[] | undefined {
		return this.bindingsByName.get(name)
	}

	/** 
	 * Get binding by name and template.
	 * Binding class must be imported.
	 */
	getBindingByName(name: string, template: TemplateBasis): LuposBinding | undefined {
		let bindingClassDeclOrRef = template.getReferenceByName(name)

		// Local declared.
		let bindingClass = bindingClassDeclOrRef && this.helper.ts.isClassDeclaration(bindingClassDeclOrRef)
			? bindingClassDeclOrRef
			: undefined

		// Imported.
		if (!bindingClass && bindingClassDeclOrRef) {
			bindingClass = this.helper.symbol.resolveDeclaration(
				bindingClassDeclOrRef,
				this.helper.ts.isClassDeclaration
			)
		}

		// Local declaration or reference.
		if (bindingClass) {
			return this.getBindingByDeclaration(bindingClass)
		}

		// Internal bindings like `:class`.
		else {
			return this.getWorkspaceBindingsByName(name)?.[0]
		}
	}

	/** 
	 * Get binding by it's class declaration, use it for completion.
	 * `declaration` can also be a any level local declaration.
	 */
	getBindingByDeclaration(declaration: TS.ClassDeclaration): LuposBinding | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeTSFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposBinding(declaration, this.helper)
		}

		let bindings = this.bindingsByFile.get(sourceFile)
		if (bindings) {
			return bindings?.find(c => c.declaration === declaration)
		}

		return undefined
	}
}