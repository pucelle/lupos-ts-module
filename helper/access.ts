import type TS from 'typescript'
import type {AccessNode} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createAccessHelpers(ts: typeof TS, core: HelperCore, context: HelperGroupContext) {
	const {getText, isPropertyLike, isMethodLike} = core
	const {assign, cls, types, symbol} = context

	const access = {

		/** Whether be accessing like `a.b` or `a[b]`. */
		isAccess(node: TS.Node): node is AccessNode {
			return ts.isPropertyAccessExpression(node)
				|| ts.isElementAccessExpression(node)
		},

		/** get accessing property node. */
		getPropertyNode(node: AccessNode): TS.Expression {
			return ts.isPropertyAccessExpression(node)
				? node.name
				: node.argumentExpression
		},

		/** get property accessing property text. */
		getPropertyText(node: AccessNode): string {
			let nameNode = access.getPropertyNode(node)
			return getText(nameNode)
		},

		/** 
		 * `a.b.c` -> `a`.
		 * `a.b!.c` -> `a`
		 * `(a.b as any).c` -> `a`
		 */
		getTopmost(node: AccessNode): TS.Expression {
			let topmost: TS.Expression = node

			while (true) {
				if (access.isAccess(topmost)) {
					topmost = topmost.expression
				}
				else if (ts.isParenthesizedExpression(topmost)) {
					topmost = topmost.expression
				}
				else if (ts.isAsExpression(topmost)) {
					topmost = topmost.expression
				}
				else if (ts.isNonNullExpression(topmost)) {
					topmost = topmost.expression
				}
				else {
					break
				}
			}

			return topmost
		},

		/** Like `a?.b`, or `a?.b.c`. */
		getOptionalChainingExp(node: AccessNode): TS.Expression | null {
			let n: AccessNode = node

			while (true) {
				if (n.questionDotToken) {
					return n.expression
				}

				let exp: TS.Expression = n.expression

				if (ts.isParenthesizedExpression(exp)) {
					exp = exp.expression
				}
				else if (ts.isAsExpression(exp)) {
					exp = exp.expression
				}

				if (access.isAccess(exp)) {
					n = exp
				}
				else {
					break
				}
			}

			return null
		},

		/** 
		 * Test whether be all elements read access like:
		 *   - `[...a]`, or `{...a}`
		 *   - `Object.keys(a)`, `Object.values(a)`, `Object.entries(a)`
		 *   - `Object.assign(..., a)`
		 */
		isAllElementsReadAccess(node: TS.Node): node is TS.Expression {

			// `[...a]`, or `{...a}`
			if (node.parent
				&& (ts.isSpreadElement(node.parent)
					|| ts.isSpreadAssignment(node.parent)
				)
				&& !assign.isWithinAssignmentTo(node)
			) {
				return true
			}

			// `of a`
			if (node.parent
				&& ts.isForOfStatement(node.parent)
				&& node === node.parent.expression
			) {
				return true
			}

			// `Object.xx(...)`
			if (node.parent
				&& ts.isCallExpression(node.parent)
				&& ts.isPropertyAccessExpression(node.parent.expression)
				&& getText(node.parent.expression.expression) === 'Object'
				&& node.parent.arguments.includes(node as TS.Expression)
			) {
				let methodName = getText(node.parent.expression.name)
				if (methodName === 'keys'
					|| methodName === 'values'
					|| methodName === 'entries'
				) {
					return true
				}

				if (methodName === 'assign') {
					if (node.parent.arguments.indexOf(node as TS.Expression) > 0) {
						return true
					}
				}
			}

			return false
		},
		
		/** 
		 * Test whether be all elements write access like:
		 *   - `[...a] = ...`, or `{...a} = ...`
		 *   - `Object.assign(a, ...)`
		 */
		isAllElementsWriteAccess(node: TS.Node): node is TS.Expression {
			if (node.parent
				&& (ts.isSpreadElement(node.parent)
					|| ts.isSpreadAssignment(node.parent)
				)
				&& assign.isWithinAssignmentTo(node)
			) {
				return true
			}

			// `Object.xx(...)`
			if (node.parent
				&& ts.isCallExpression(node.parent)
				&& ts.isPropertyAccessExpression(node.parent.expression)
				&& getText(node.parent.expression.expression) === 'Object'
				&& node.parent.arguments.includes(node as TS.Expression)
			) {
				let methodName = getText(node.parent.expression.name)
				if (methodName === 'assign') {
					if (node.parent.arguments.indexOf(node as TS.Expression) === 0) {
						return true
					}
				}
			}

			return false
		},

		/** 
		 * Test whether be `Map` or `Set`, or of `Array`.
		 * Otherwise if resolved type is `MethodsObserved`,
		 * or resolved class implements `MethodsObserved`, returns `true`.
		 */
		isOfElementsAccess(rawNode: AccessNode): boolean {
			let decl = symbol.resolveDeclaration(rawNode, (n: TS.Node) => isMethodLike(n) || isPropertyLike(n))
			if (!decl) {
				return false
			}

			let classDecl = decl.parent
			if (!ts.isClassDeclaration(classDecl) && !ts.isInterfaceDeclaration(classDecl)) {
				return false
			}

			if (!classDecl.name) {
				return false
			}

			let objName = getText(classDecl.name)
			if (objName === 'Map') {
				return true
			}
			else if (objName === 'Set') {
				return true
			}
			else if (objName === 'Array' || objName === 'ReadonlyArray') {
				return true
			}

			// Not validate which method.
			else if (ts.isClassDeclaration(classDecl)) {
				for (let superDecl of cls.walkSelfAndChainedSuper(classDecl)) {
					if (cls.isImplementedOf(superDecl, 'MethodsObserved', 'lupos')) {
						return true
					}
				}
			}

			return false
		},

		/** 
		 * Test whether calls read methods or properties like `Map.get`, `Set.has`, `Array.length`.
		 * Otherwise whether calls read type methods of `MethodsObserved`.
		 */
		isOfElementsReadAccess(rawNode: AccessNode): boolean {
			let decl = symbol.resolveDeclaration(rawNode, (n: TS.Node) => isMethodLike(n) || isPropertyLike(n))
			if (!decl) {
				return false
			}

			let classDecl = decl.parent
			if (!ts.isClassDeclaration(classDecl) && !ts.isInterfaceDeclaration(classDecl)) {
				return false
			}

			if (!classDecl.name) {
				return false
			}

			let objName = getText(classDecl.name)
			let propName = getText(decl.name)
	
			if (objName === 'Map') {
				return propName === 'has' || propName === 'get' || propName === 'size' || propName === 'keys'
					|| propName === 'values' || propName === 'entries'
			}
			else if (objName === 'Set') {
				return propName === 'has' || propName === 'size' || propName === 'keys' || propName === 'values'
			}
			else if (objName === 'Array' || objName === 'ReadonlyArray') {
				return !(
					propName === 'push'
					|| propName === 'unshift'
					|| propName === 'sort'
					|| propName === 'splice'
				)
			}
			else if (ts.isClassDeclaration(classDecl)) {
				return access._isOfMethodsObserved(classDecl, propName, 0)
			}

			return false
		},

		/** Test whether calls single element read methods or properties like `Map.get`, `Array.find`. */
		isOfSingleElementReadAccess(rawNode: AccessNode): boolean {
			let decl = symbol.resolveDeclaration(rawNode, (n: TS.Node) => isMethodLike(n) || isPropertyLike(n))
			if (!decl) {
				return false
			}

			let classDecl = decl.parent
			if (!ts.isClassDeclaration(classDecl) && !ts.isInterfaceDeclaration(classDecl)) {
				return false
			}

			if (!classDecl.name) {
				return false
			}

			let objName = getText(classDecl.name)
			let propName = getText(decl.name)
	
			if (objName === 'Map') {
				return propName === 'get'
			}
			else if (objName === 'Array' || objName === 'ReadonlyArray') {
				return propName === 'find'
			}

			return false
		},

		/** 
		 * Test whether calls write methods like `Map.set` `Set.set`, or `Array.push`.
		 * Otherwise whether calls write type methods of `MethodsObserved`.
		 */
		isOfElementsWriteAccess(rawNode: AccessNode) {
			let decl = symbol.resolveDeclaration(rawNode, isMethodLike)
			if (!decl) {
				return false
			}

			let classDecl = decl.parent
			if (!ts.isClassDeclaration(classDecl) && !ts.isInterfaceDeclaration(classDecl)) {
				return false
			}

			if (!classDecl.name) {
				return false
			}
			
			let objName = getText(classDecl.name)
			let propName = getText(decl.name)
	
			if (objName === 'Map') {
				return propName === 'set' || propName === 'delete' || propName === 'clear'
			}
			else if (objName === 'Set') {
				return propName === 'add' || propName === 'delete' || propName === 'clear'
			}
			else if (objName === 'Array' || objName === 'ReadonlyArray') {
				return propName === 'push'
					|| propName === 'unshift'
					|| propName === 'sort'
					|| propName === 'splice'
			}
			else if (ts.isClassDeclaration(classDecl)) {
				return access._isOfMethodsObserved(classDecl, propName, 1)
			}

			return false
		},
		
		_isOfMethodsObserved(classDecl: TS.ClassDeclaration, propName: string, paramIndex: number) {
			for (let superDecl of cls.walkSelfAndChainedSuper(classDecl)) {
				let implemented = cls.getImplements(superDecl)
				let methodsHalfObservedImplement = implemented.find((im: TS.ExpressionWithTypeArguments) => getText(im.expression) === 'MethodsObserved')
				if (!methodsHalfObservedImplement) {
					continue
				}

				let methodNamesType = methodsHalfObservedImplement.typeArguments?.[paramIndex]
				if (!methodNamesType) {
					continue
				}

				let methodNames = types.splitUnionTypeToStringList(types.typeOfTypeNode(methodNamesType)!)
				if (methodNames.includes(propName)) {
					return true
				}
			}

			return false
		}
	}

	return {access}
}
