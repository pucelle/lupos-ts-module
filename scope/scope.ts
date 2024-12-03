import type * as TS from 'typescript'
import {Helper} from '../helper'


type ScopeNode = TS.FunctionLikeDeclaration | TS.ForStatement | TS.ForOfStatement | TS.ForInStatement | TS.Block | TS.SourceFile


/** Mark all variables within a scope. */
export class Scope {

	readonly node: ScopeNode
	readonly parent: Scope | null
	readonly helper: Helper
	readonly ts: typeof TS

	/** All variables declared here, by `variable name -> declaration`. */
	protected variables: Map<string, TS.Node | null> = new Map()

	constructor(node: ScopeNode, parent: Scope | null, helper: Helper) {
		this.node = node
		this.parent = parent
		this.helper = helper
		this.ts = helper.ts
	}

	/** Visit a descendant node. */
	visitNode(node: TS.Node) {

		// Variable declaration.
		if (this.ts.isVariableDeclaration(node)) {
			for (let {name} of this.helper.variable.walkDeclarationNames(node)) {
				this.variables.set(name, node)
			}
		}

		// Parameter.
		else if (this.ts.isParameter(node)) {
			this.variables.set(this.helper.getFullText(node.name), node)
		}

		// `import {a as b}`,  `import {a}`
		else if (this.ts.isImportSpecifier(node)) {
			this.variables.set(this.helper.getFullText(node.name), node)
		}

		// `import a`
		else if (this.ts.isImportClause(node)) {
			if (node.name) {
				this.variables.set(this.helper.getFullText(node.name), node)
			}
		}

		// `import * as a`
		else if (this.ts.isNamespaceImport(node)) {
			this.variables.set(this.helper.getFullText(node.name), node)
		}

		// Class or function declaration
		else if (this.ts.isClassDeclaration(node) || this.ts.isFunctionDeclaration(node)) {
			if (node.name) {
				this.variables.set(this.helper.getFullText(node.name), node)
			}
		}
	}

	/** Returns whether be top scope. */
	isTopmost(): boolean {
		return this.ts.isSourceFile(this.node)
	}

	/** Whether has declared a specified named local variable. */
	hasLocalVariable(name: string): boolean {
		return this.variables.has(name)
	}

	/** 
	 * Whether can visit a variable by it's name.
	 * Will try to find from ancestral scope.
	 */
	hasVariable(name: string): boolean {
		if (this.variables.has(name)) {
			return true
		}

		if (this.parent) {
			return this.parent.hasVariable(name)
		}
		
		return false
	}

	/** Try get raw declaration by it's variable name. */
	getVariableDeclaredOrReferenced(name: string): TS.Node | undefined {
		if (this.variables.has(name)) {
			return this.variables.get(name) ?? undefined
		}

		if (this.parent) {
			return this.parent.getVariableDeclaredOrReferenced(name)
		}

		return undefined
	}

	/** Find closest scope which `this` specified, normally function-like, or source file. */
	findClosestThisScope(): Scope {
		let scope: Scope = this

		while (!this.helper.isNonArrowFunctionLike(scope.node) && !this.ts.isSourceFile(scope.node)) {
			scope = scope.parent!
		}

		return scope
	}
}

