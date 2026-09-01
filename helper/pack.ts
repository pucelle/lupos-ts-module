import type TS from 'typescript'


export function createPackHelpers(ts: typeof TS) {
	

	const pack = {
		
		/** 
		 * D expressions to a single binary expression.
		 * `a, b, c -> [a, b, c]`
		 */
		unPackCommaBinaryExpressions(exp: TS.Expression): TS.Expression[] {
			if (ts.isBinaryExpression(exp)
				&& exp.operatorToken.kind === ts.SyntaxKind.CommaToken
			) {
				return [
					...pack.unPackCommaBinaryExpressions(exp.left),
					...pack.unPackCommaBinaryExpressions(exp.right),
				]
			}
			else {
				return [exp]
			}
		}
	}

	return {pack}
}
