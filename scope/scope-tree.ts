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

	/** Current not in stack. */
	protected current: S | null = null
	
	protected sourceFile: TS.SourceFile | null = null

	/** Scope node -> scope. */
	protected scopeMap: Map<TS.Node, S> = new Map()

	constructor(helper: Helper, ScopeConstructor: ScopeConstructor<S> = Scope as ScopeConstructor<S>) {
		this.Scope = ScopeConstructor
		this.helper = helper
		this.ts = helper.ts
	}

	/** Visit a source file and build scope tree. */
	visitSourceFile(sourceFile: TS.SourceFile) {
		this.sourceFile = sourceFile

		// In the first visiting initialize visit and scope tree.
		const visitor = (node: TS.Node) => {
			this.toChild(node)
			this.ts.forEachChild(node, visitor)
			this.toParent(node)
		}

		visitor(sourceFile)
	}

	/** Before entering child nodes. */
	protected toChild(node: TS.Node) {
		if (this.ts.isSourceFile(node)
			|| this.helper.isFunctionLike(node)
			|| this.ts.isForStatement(node)
			|| this.ts.isForOfStatement(node)
			|| this.ts.isForInStatement(node)
			|| this.ts.isBlock(node)
		) {
			let parent = this.current
			if (parent) {
				this.stack.push(parent)
			}

			this.current = new this.Scope(node, parent, this.helper)
			this.scopeMap.set(node, this.current!)
		}
		else {
			this.current!.visitNode(node)
		}
	}

	/** Exit self and enter parent. */
	protected toParent(node: TS.Node) {
		if (node === this.current?.node) {
			this.current = this.stack.pop()!
		}
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
	findDeclared(node: TS.Identifier | TS.ThisExpression, fromScope: S = this.findClosest(node)): S | null {
		if (this.helper.isThis(node)) {
			return fromScope.findClosestThisScope() as S
		}
		else if (fromScope.hasLocalVariable(node.text)) {
			return fromScope
		}
		else if (fromScope.parent) {
			return this.findDeclared(node, fromScope.parent as S)
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
