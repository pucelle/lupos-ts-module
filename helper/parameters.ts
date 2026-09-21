import type TS from 'typescript'
import type {DeconstructedArgumentTypeItem, DeconstructedVariableDeclarationItem} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createParameterHelpers(ts: typeof TS, core: HelperCore, context: HelperGroupContext) {
	const {getText, isFunctionLike, isMethodLike} = core
	const {cls, variable, types, symbol} = context

	const parameter = {

		/** Get method or constructor from call expression. */
		getCallParameters(callExp: TS.CallExpression | TS.NewExpression): TS.NodeArray<TS.ParameterDeclaration> | undefined	{
			let decl: TS.FunctionLikeDeclaration | TS.MethodSignature | TS.MethodDeclaration | TS.ConstructorDeclaration | TS.ConstructSignatureDeclaration | undefined
			if (ts.isCallExpression(callExp)) {
				decl = symbol.resolveDeclaration(callExp.expression, (n: TS.Node) => isFunctionLike(n) || isMethodLike(n))
			}
			else {
				let classDecl = symbol.resolveDeclaration(callExp.expression, ts.isClassLike)
				if (classDecl) {
					decl = cls.getConstructor(classDecl, true)
				}
			}

			if (decl) {
				return decl.parameters
			}

			return undefined
		},


		/** 
		 * Walk for all declared variable names from a variable declaration.
		 * `([a, b])` = ... -> `[a, b]`
		 * `({a, b})` = ... -> `[a, b]`
		 */
		*walkDeconstructedDeclarationItems(node: TS.ParameterDeclaration): Iterable<DeconstructedVariableDeclarationItem> {
			return yield* variable._walkDeconstructedArgumentTypeItemsRecursively(node.name, node.initializer, [])
		},


		/** 
		 * Walk for all mapped deconstructed argument expression and parameter type node from an expression list.
		 * `f({a})` ~ `function f(p: {a:T})` -> `{arg: a, type: T}`
		 * `f([a])` ~ `function f(p: [T])` -> `{arg: a, type: T}`
		 */
		*walkDeconstructedArgumentTypeItems(
			args: TS.NodeArray<TS.Expression>,
			params: TS.NodeArray<TS.ParameterDeclaration>
		): Iterable<DeconstructedArgumentTypeItem> {
			let paramIndex = 0
			let param = params.length > paramIndex ? params[0] : undefined

			for (let arg of args) {

				// `f(...a)`
				if (ts.isSpreadElement(arg)) {

					// `function f(...p)`
					if (param && param.dotDotDotToken) {
						yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg.expression, param.type)
					}

					// Should be type of `param.type[]`, simply ignores it.
					else {
						yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg.expression, undefined)
					}
				}
				else {
					yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg, param?.type)
				}

				// `function f(...p)`
				if (param && !param.dotDotDotToken) {
					paramIndex++
					param = params.length > paramIndex ? params[0] : undefined
				}
			}
		},

		/** 
		 * Walk for all mapped deconstructed argument and parameter type node from an expression.
		 * `f({a})` ~ `function f(p: {a:T})` -> `{arg: a, type: T}`
		 * `f([a])` ~ `function f(p: [T])` -> `{arg: a, type: T}`
		 */
		*walkDeconstructedArgumentTypeItemsOf(arg: TS.Expression, paramType: TS.TypeNode | undefined): Iterable<DeconstructedArgumentTypeItem> {
			if (ts.isParenthesizedExpression(arg)) {
				yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg.expression, paramType)
			}
			else if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
				yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg.left, paramType)
			}
			else if (ts.isSpreadElement(arg)) {
				yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg.expression, paramType)
			}
			else if (ts.isOmittedExpression(arg)) {
				return
			}

			//`f({a})` ~ `function f(p: {a:T})`
			else if (ts.isObjectLiteralExpression(arg)) {
				if (!paramType) {
					for (let property of arg.properties) {
						if (ts.isShorthandPropertyAssignment(property)) {
							yield* parameter.walkDeconstructedArgumentTypeItemsOf(property.name, undefined)
						}
						else if (ts.isPropertyAssignment(property)) {
							yield* parameter.walkDeconstructedArgumentTypeItemsOf(property.initializer, undefined)
						}
						else if (ts.isSpreadAssignment(property)) {
							yield* parameter.walkDeconstructedArgumentTypeItemsOf(property.expression, undefined)
						}
					}

					return
				}

				let {map, rest} = variable._makeObjectLiteralMap(arg)
				let typeMap: Map<string, TS.TypeNode> = new Map()

				if (paramType && ts.isTypeLiteralNode(paramType)) {
					for (let member of paramType.members) {
						if (!ts.isPropertySignature(member)) {
							continue
						}

						if (!member.type) {
							continue
						}

						// `a`
						let key = getText(member.name)
						typeMap.set(key, member.type)
					}
				}

				for (let [key, arg] of map.entries()) {
					let type = typeMap.get(key)
					yield* parameter.walkDeconstructedArgumentTypeItemsOf(arg, type)
				}
	
				for (let restItem of rest) {
					yield* parameter.walkDeconstructedArgumentTypeItemsOf(restItem, paramType)
				}
			}

			// `f([a])` ~ `function f(p: [T])` -> `{arg: a, type: T}`
			else if (ts.isArrayLiteralExpression(arg)) {
				let {list, rest} = variable.splitArrayLiteral(arg)

				// `[T, T]`
				if (paramType && ts.isTupleTypeNode(paramType)) {
					for (let i = 0; i < list.length; i++) {
						let item = list[i]
						let type = i < paramType.elements.length ? paramType.elements[i] : undefined
						yield* parameter.walkDeconstructedArgumentTypeItemsOf(item, type)
					}
				}

				// `T[]`
				else if (paramType && ts.isArrayTypeNode(paramType)) {
					for (let item of list) {
						yield* parameter.walkDeconstructedArgumentTypeItemsOf(item, paramType.elementType)
					}
				}

				// `Array<T>`
				else if (paramType && ts.isTypeReferenceNode(paramType)) {
					let name = types.getTypeNodeReferenceName(paramType)?.text
					if ((name === 'Array' || name === 'ReadonlyArray')
						&& paramType.typeArguments?.length === 1
					) {
						for (let item of list) {
							yield* parameter.walkDeconstructedArgumentTypeItemsOf(item, paramType.typeArguments[0])
						}
					}
				}

				// Other iterable.
				else {
					for (let item of list) {
						yield* parameter.walkDeconstructedArgumentTypeItemsOf(item, undefined)
					}
				}

				for (let restItem of rest) {
					yield* parameter.walkDeconstructedArgumentTypeItemsOf(restItem, paramType)
				}
			}

			// All others.
			else {
				yield {
					arg,
					typeNode: paramType,
				}
			}
		},
	}

	return {parameter}
}
