import type * as TS from 'typescript'
import {Scope} from './scope'
import {Helper} from '../helper'


type ScopeConstructor<S extends Scope> = {
	new(...params: any[]): S
}


/** Build a tree of scopes. */
export class ScopeTree<S extends Scope = Scope> {

	readonly Scope: ScopeConstructor<S>
	readonly helper: Helper
	readonly ts: typeof TS

	protected stack: S[] = []
	protected current: S | null = null
	protected sourceFile: TS.SourceFile | null = null

	/** Scope node -> scope. */
	protected scopeMap: Map<TS.Node, S> = new Map()

	constructor(sourceFile: TS.SourceFile, helper: Helper, ScopeConstructor: ScopeConstructor<S> = Scope as ScopeConstructor<S>) {
		this.sourceFile = sourceFile
		this.Scope = ScopeConstructor
		this.helper = helper
		this.ts = helper.ts
		
		this.visitSourceFile(sourceFile)
	}

	/** Visit a source file and build scope tree. */
	protected visitSourceFile(sourceFile: TS.SourceFile) {
		this.initialize()
		this.sourceFile = sourceFile

		// In the first visiting initialize visit and scope tree.
		const visitor = (node: TS.Node) => {
			this.toNext(node)

			this.toChild()
			this.ts.forEachChild(node, visitor)
			this.toParent(node)
		}

		visitor(sourceFile)
	}

	/** Initialize before visiting a new source file. */
	protected initialize() {
		this.stack = []
		this.current = null
		this.scopeMap.clear()
	}

	/** To next sibling. */
	protected toNext(node: TS.Node) {
		if (this.ts.isSourceFile(node)
			|| this.helper.isFunctionLike(node)
			|| this.ts.isForStatement(node)
			|| this.ts.isForOfStatement(node)
			|| this.ts.isForInStatement(node)
			|| this.ts.isBlock(node)
		) {
			let parent = this.stack.length > 0 ? this.stack[this.stack.length - 1] : null
			this.current = new this.Scope(node, parent, this.helper)
			this.scopeMap.set(node, this.current!)
		}
		else {
			this.current!.visitNode(node)
		}
	}

	/** To first child. */
	protected toChild() {
		this.stack.push(this.current!)
	}

	/** To parent. */
	protected toParent(_node: TS.Node) {
		this.current = this.stack.pop()!
	}

	/** Get top most scope, the scope of source file. */
	getTopmost(): S {
		return this.scopeMap.get(this.sourceFile!)!
	}

	/** Find closest scope contains or equals node. */
	findClosest(fromRawNode: TS.Node): S {
		let node = fromRawNode
		let scope = this.scopeMap.get(node)

		while (!scope) {
			node = node.parent!
			scope = this.scopeMap.get(node)
		}

		return scope
	}
		
	/** Check at which scope the specified named variable or this declared. */
	findDeclared(rawNode: TS.Identifier | TS.ThisExpression, fromScope: S = this.findClosest(rawNode)): S | null {
		if (this.helper.isThis(rawNode)) {
			return fromScope.findClosestThisScope() as S
		}
		else if (fromScope.hasLocalVariable(rawNode.text)) {
			return fromScope
		}
		else if (fromScope.parent) {
			return this.findDeclared(rawNode, fromScope.parent as S)
		}
		else {
			return null
		}
	}

	/** 
	 * Try get declaration by variable name.
	 * `fromRawNode` specifies where to query the variable from.
	 */
	getReferenceByName(name: string, fromRawNode: TS.Node): TS.Node | undefined {
		let scope = this.findClosest(fromRawNode)
		if (!scope) {
			return undefined
		}

		return scope.getVariableDeclaredOrReferenced(name)
	}	
}
