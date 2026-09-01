import type TS from 'typescript'
import type {AssignmentNode} from './index'
import type {HelperGroupContext} from './context'


export function createAssignmentHelpers(ts: typeof TS, context: HelperGroupContext) {
	const {access} = context

	const assign = {

		/** Whether be property assignment like `a = x`, `delete a.b`. */
		isAssignment(node: TS.Node): node is AssignmentNode {
			if (ts.isBinaryExpression(node)) {
				return node.operatorToken.kind === ts.SyntaxKind.EqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AsteriskEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.SlashEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.PercentEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.LessThanLessThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AmpersandEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.BarEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken
					|| node.operatorToken.kind === ts.SyntaxKind.CaretEqualsToken
			}
			else if (ts.isPostfixUnaryExpression(node)) {
				return node.operator === ts.SyntaxKind.PlusPlusToken
					|| node.operator === ts.SyntaxKind.MinusMinusToken
			}
			else if (ts.isPrefixUnaryExpression(node)) {
				return node.operator === ts.SyntaxKind.PlusPlusToken
					|| node.operator === ts.SyntaxKind.MinusMinusToken
			}
			else if (ts.isDeleteExpression(node)) {
				return true
			}

			return false
		},

		/** Like `a.b` of `a.b = 1`. */
		isWithinAssignmentTo(node: TS.Node): boolean {
			if (!node.parent) {
				return false
			}

			// Reach topmost assignment expression.
			if (assign.isAssignment(node.parent)
				&& ts.isBinaryExpression(node.parent)
				&& node === node.parent.left
			) {
				return true
			}
			
			// Visit parent to determine.
			if (access.isAccess(node)
				|| ts.isObjectLiteralExpression(node)
				|| ts.isArrayLiteralExpression(node)
				|| ts.isSpreadElement(node)
				|| ts.isSpreadAssignment(node)
			) {
				return assign.isWithinAssignmentTo(node.parent)
			}

			return false
		},

		/** 
		 * get the value assigning from.
		 * `b` of `a = b`
		 */
		getFromExpression(node: AssignmentNode): TS.Expression {
			if (ts.isBinaryExpression(node)) {
				return node.right
			}
			else if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
				return node.operand
			}

			// delete `a.b`
			else {
				return node.expression
			}
		},

		/** 
		 * get the expressions assigning to.
		 * `a` of `a = b`
		 * `a, b` of `[a, b] = c`
		 */
		getToExpressions(node: AssignmentNode): TS.Expression[] {
			if (ts.isBinaryExpression(node)) {
				return [...assign.walkAssignToExpressions(node.left)]
			}
			else if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
				return [node.operand]
			}

			// delete `a.b`
			else {
				return [node.expression]
			}
		},

		/** Walk for assign to expressions.  */
		*walkAssignToExpressions(node: TS.Expression): Iterable<TS.Expression> {
			if (ts.isArrayLiteralExpression(node)) {
				for (let el of node.elements) {
					yield* assign.walkAssignToExpressions(el)
				}
			}
			else if (ts.isObjectLiteralExpression(node)) {
				for (let prop of node.properties) {
					if (ts.isPropertyAssignment(prop)) {
						yield* assign.walkAssignToExpressions(prop.initializer)
					}
				}
			}
			else {
				yield node
			}
		},
	}

	return {assign}
}
