import type TS from 'typescript'
import type {createASTHelpers} from './ast'


type ASTHelpers = ReturnType<typeof createASTHelpers>


export function createTraversalHelpers(ts: typeof TS, ast: ASTHelpers) {
	const {isFunctionLike} = ast

	/** Walk node and all descendant nodes, test fn return a node to stop. */
	function* walkInward(fromNode: TS.Node, test?: (node: TS.Node) => TS.Node | void) : Iterable<TS.Node> {
		if (!test || test(fromNode)) {
			yield fromNode
		}

		let childNodes: TS.Node[] = []

		ts.forEachChild(fromNode, (n) => {
			childNodes.push(n)
		})

		for (let childNode of childNodes) {
			yield* walkInward(childNode, test)
		}
	}

	/** Walk and all ancestral nodes, test fn return a node to stop. */
	function* walkOutward(fromNode: TS.Node, test?: (node: TS.Node) => TS.Node | void): Iterable<TS.Node> {
		if (!test || test(fromNode)) {
			yield fromNode
		}

		if (fromNode.parent) {
			yield* walkOutward(fromNode.parent, test)
		}
	}

	/** Visit node and all descendant nodes, find a node match test fn. */
	function findInward<T extends TS.Node>(fromNode: TS.Node, test: (node: TS.Node) => node is T) : T | undefined {
		if (test(fromNode)) {
			return fromNode
		}

		let found: TS.Node | undefined = undefined

		ts.forEachChild(fromNode, (n) => {
			found ??= findInward(n, test)
			return found
		})

		return found
	}

	/** Visit self and ancestral nodes, and find a node match test fn. */
	function findOutward<T extends TS.Node>(fromNode: TS.Node, test: (node: TS.Node) => node is T): T | undefined {
		if (test(fromNode)) {
			return fromNode
		}

		if (fromNode.parent) {
			return findOutward(fromNode.parent, test)
		}

		return undefined
	}

	/** 
	 * Visit self and ancestral nodes, and find a node match test fn.
	 * If meed `untilNode`, and it doesn't passed test, stop finding.
	 */
	function findOutwardUntil<T extends TS.Node>(fromNode: TS.Node, untilNode: TS.Node | undefined, test: (node: TS.Node) => node is T) : T | undefined {
		if (test(fromNode)) {
			return fromNode
		}

		if (fromNode === untilNode) {
			return undefined
		}

		if (fromNode.parent) {
			return findOutward(fromNode.parent, test)
		}

		return undefined
	}

	/**
	 * Find by walking down the descendants of the node.
	 * Note that will also search children when parent match.
	 */
	function findAllInward<T extends TS.Node>(node: TS.Node, test: (node: TS.Node) => node is T): T[] {
		let found: T[] = []

		if (test(node)) {
			found.push(node)
		}

		node.forEachChild(child => {
			found.push(...findAllInward(child, test))
		})

		return found
	}

	/** Visit node and all descendant nodes but skip function and their descendants, find a node match test fn. */
	function findInstantlyRunInward<T extends TS.Node>(fromNode: TS.Node, test: (node: TS.Node) => node is T) : T | undefined {
		if (isFunctionLike(fromNode)) {
			return undefined
		}

		if (test(fromNode)) {
			return fromNode
		}

		let found: TS.Node | undefined = undefined

		ts.forEachChild(fromNode, (n) => {
			found ??= findInstantlyRunInward(n, test)
			return found
		})

		return found
	}


	/** Get inner-most node at specified offset index. */
	function getNodeAtOffset(node: TS.Node, offset: number): TS.Node | undefined {
		if (offset >= node.getStart() && offset <= node.getEnd()) {
			return node.forEachChild(child => {
				return getNodeAtOffset(child, offset) || undefined
			}) || node
		}

		return undefined
	}

	/** Get the leading comment for given node. */
	function getNodeLeadingComment(node: TS.Node): string | null {
		let sourceFileText = node.getSourceFile().text
		let leadingComments = ts.getLeadingCommentRanges(sourceFileText, node.pos)

		if (leadingComments && leadingComments.length > 0) {
			return sourceFileText.substring(leadingComments[0].pos, leadingComments[0].end)
		}

		return null
	}

	/** Get the description, normally leading comment of given node. */
	function getNodeDescription(node: TS.Node): string | null {
		let comment = getNodeLeadingComment(node)
		if (!comment) {
			return null
		}

		// //	^\s*\/\/ ?
		// /**	^\/\*\*[^\n]*
		// */	\s*\*\/\s*$
		// *	^\s*\* ?
		return comment.replace(/^\s*\/\/ ?|^\/\*\*[\s^\n]*(?:\*\s)?|\s*\*\/\s*$|^\s*\* ?/gm, '').trim()
	}

	return {
		walkInward,
		walkOutward,
		findInward,
		findOutward,
		findOutwardUntil,
		findAllInward,
		findInstantlyRunInward,
		getNodeAtOffset,
		getNodeDescription,
	}
}
