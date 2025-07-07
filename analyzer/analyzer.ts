import type * as TS from 'typescript'
import {analyzeLuposComponents, createLuposComponent} from './components'
import {LuposBinding, LuposComponent, LuposEvent, LuposProperty} from './types'
import {analyzeLuposBindings, createLuposBinding} from './bindings'
import {Helper} from '../helper'
import {ListMap, TwoWayListMap} from '../utils'
import {TemplateBasis} from '../template'
import {LuposKnownInternalBindings} from '../complete-data'


/** 
 * In a plugin, it can visit sources across whole workspace.
 * In a transformer, it can only visit current source file and all resolved.
 */
export class Analyzer {

	readonly helper: Helper

	/** Latest analyzed source files, and their text. */
	protected files: Set<TS.SourceFile> = new Set()

	/** The source file, all source files that it references. */
	protected references: TwoWayListMap<TS.SourceFile, string> = new TwoWayListMap()

	/** Analyzed components by source file. */
	protected workspaceComponentsByFile: ListMap<TS.SourceFile, LuposComponent> = new ListMap()

	/** Analyzed components by name. */
	protected workspaceComponentsByName: ListMap<string, LuposComponent> = new ListMap()

	/** Analyzed bindings by name. */
	protected workspaceBindingsByName: ListMap<string, LuposBinding> = new ListMap()

	/** Analyzed bindings by source file. */
	protected workSpaceBindingsByFile: ListMap<TS.SourceFile, LuposBinding> = new ListMap()

	constructor(helper: Helper) {
		this.helper = helper
	}

	/** Analyze each ts source file. */
	protected analyzeFile(sourceFile: TS.SourceFile) {

		// Must delete firstly, same file need to re-analyze after reference has changed.
		this.deleteFile(sourceFile)

		let components = analyzeLuposComponents(sourceFile, this.helper)
		let bindings = analyzeLuposBindings(sourceFile, this.helper)

		this.files.add(sourceFile)

		for (let component of components) {
			this.workspaceComponentsByName.add(component.name, component)
			this.workspaceComponentsByFile.add(component.sourceFile, component)

			for (let prop of Object.values(component.properties)) {
				let refFile = prop.nameNode.getSourceFile()
				if (refFile !== sourceFile) {
					this.references.add(sourceFile, refFile.fileName)
				}
			}

			for (let event of Object.values(component.events)) {
				let refFile = event.nameNode.getSourceFile()
				if (refFile !== sourceFile) {
					this.references.add(sourceFile, refFile.fileName)
				}
			}

			for (let slotEl of Object.values(component.slotElements)) {
				let refFile = slotEl.nameNode.getSourceFile()
				if (refFile !== sourceFile) {
					this.references.add(sourceFile, refFile.fileName)
				}
			}
		}
	
		for (let binding of bindings) {
			this.workspaceBindingsByName.add(binding.name, binding)
			this.workSpaceBindingsByFile.add(binding.sourceFile, binding)
		}
	}

	/** Make parsed results in given file expire. */
	protected deleteFile(file: TS.SourceFile) {
		if (!this.files.has(file)) {
			return
		}

		// Components expired.
		for (let component of [...this.workspaceComponentsByFile.get(file) || []]) {
			this.workspaceComponentsByName.delete(component.name, component)
			this.workspaceComponentsByFile.delete(component.sourceFile, component)
		}

		// Binding expired.
		for (let binding of [...this.workSpaceBindingsByFile.get(file) || []]) {
			this.workspaceBindingsByName.delete(binding.name, binding)
			this.workSpaceBindingsByFile.delete(binding.sourceFile, binding)
		}

		this.references.deleteLeft(file)
	}

	/** Iterate all components. */
	protected get components(): Iterable<LuposComponent> {
		return this.workspaceComponentsByFile.values()
	}

	/** Iterate all bindings. */
	protected get bindings(): Iterable<LuposBinding> {
		return this.workSpaceBindingsByFile.values()
	}

	/** Get components by name across all workspace. */
	getWorkspaceComponentsByName(name: string): LuposComponent[] | undefined {
		return this.workspaceComponentsByName.get(name)
	}

	/** Get components by name across all workspace. */
	getWorkspaceComponentByName(name: string): LuposComponent | undefined {
		let components = this.workspaceComponentsByName.get(name)
		if (!components || components.length === 0) {
			return undefined
		}

		// If have multiple declarations, return the first non-declaration file.
		if (components.length > 1) {
			return components.find(c => !c.sourceFile.fileName.endsWith('.d.ts'))
				?? components[0]
		}

		return components[0]
	}

	/** 
	 * Get component by template part tag name, and the template.
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
	getComponentByDeclaration(declaration: TS.ClassLikeDeclaration): LuposComponent | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposComponent(declaration, this.helper)
		}

		let components = this.workspaceComponentsByFile.get(sourceFile)
		if (components) {
			return components?.find(c => c.declaration === declaration)
		}

		return undefined
	}

	/** Walk component and it's super classes. */
	protected *walkComponents(component: LuposComponent, deep = 0): Generator<LuposComponent> {
		yield component

		for (let superClass of this.helper.class.walkChainedSuper(component.declaration)) {
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
		return this.workspaceBindingsByName.get(name)
	}

	/** Get binding by name across all workspace. */
	getWorkspaceBindingByName(name: string): LuposBinding | undefined {
		let bindings = this.workspaceBindingsByName.get(name)
		if (!bindings || bindings.length === 0) {
			return undefined
		}

		// If have multiple declarations, return the first non-declaration file.
		if (bindings.length > 1) {
			return bindings.find(c => !c.sourceFile.fileName.endsWith('.d.ts'))
				?? bindings[0]
		}

		return bindings[0]
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
		else if (LuposKnownInternalBindings[name]) {
			return this.getWorkspaceBindingsByName(name)?.[0]
		}

		return undefined
	}

	/** 
	 * Get binding by it's class declaration, use it for completion.
	 * `declaration` can also be a any level local declaration.
	 */
	getBindingByDeclaration(declaration: TS.ClassDeclaration): LuposBinding | undefined {
		let sourceFile = declaration.getSourceFile()

		// Ensure analyzed source file.
		if (!this.files.has(sourceFile)) {
			this.analyzeFile(sourceFile)
		}

		if (declaration.parent !== sourceFile) {
			return createLuposBinding(declaration, this.helper)
		}

		let bindings = this.workSpaceBindingsByFile.get(sourceFile)
		if (bindings) {
			return bindings?.find(c => c.declaration === declaration)
		}

		return undefined
	}
}