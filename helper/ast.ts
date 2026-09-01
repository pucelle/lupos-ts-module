import type TS from 'typescript'
import type {AccessNode, ObjectLike} from './index'
import type {HelperGroupContext} from './context'


export function createASTHelpers(ts: typeof TS, context: HelperGroupContext) {
	const {access, types} = context

	let printer = ts.createPrinter()

	
	//// Global

	/** Test whether a node is raw node. */
	function isRaw(node: TS.Node): boolean {
		return node.pos >= 0
	}

	/** 
	 * Get node full text, can output from a newly created node.
	 * For string literal, will output text with quotes.
	 */
	function getFullText(node: TS.Node) {
		if (node.pos >= 0) {
			try {
				return node.getText()
			}
			catch (err) {
				return printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
			}
		}
		else {
			return printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
		}
	}

	/** Get text without quoted for string literal, otherwise get full text. */
	function getText(node: TS.Node): string {
		if (ts.isStringLiteral(node)) {
			return node.text
		}
		else {
			return getFullText(node)
		}
	}

	/** Returns the identifier, like variable or declaration name of a given node if possible. */
	function getIdentifier(node: TS.Node): TS.Identifier | undefined {

		// Identifier itself.
		if (ts.isIdentifier(node)) {
			return node
		}

		// Declaration of a class or interface, property, method, function name, get or set name.
		if ((ts.isClassDeclaration(node)
				|| ts.isInterfaceDeclaration(node)
				|| ts.isVariableDeclaration(node)
				|| ts.isMethodDeclaration(node)
				|| ts.isPropertyDeclaration(node)
				|| ts.isFunctionDeclaration(node)
				|| ts.isGetAccessorDeclaration(node)
				|| ts.isSetAccessorDeclaration(node)
				|| ts.isImportSpecifier(node)
			)
			&& node.name
			&& ts.isIdentifier(node.name)
		) {
			return node.name
		}

		// Identifier of type reference node.
		if (ts.isTypeReferenceNode(node)
			&& ts.isIdentifier(node.typeName)
		) {
			return node.typeName
		}

		// Identifier of type query node.
		if (ts.isTypeQueryNode(node)
			&& ts.isIdentifier(node.exprName)
		) {
			return node.exprName
		}

		// Decorator name.
		if (ts.isDecorator(node)) {

			// @decorator
			if (ts.isIdentifier(node.expression)) {
				return node.expression
			}

			// @decorator(...)
			if (ts.isCallExpression(node.expression)
				&& ts.isIdentifier(node.expression.expression)
			) {
				return node.expression.expression
			}
		}

		return undefined
	}


	/** Test whether node is a variable name identifier. */
	function isVariableIdentifier(node: TS.Node): node is TS.Identifier {
		if (!ts.isIdentifier(node)) {
			return false
		}

		// `a.b`, b is identifier, but not a variable identifier.
		if (node.parent
			&& ts.isPropertyAccessExpression(node.parent)
			&& node === node.parent.name
		) {
			return false
		}

		// {a: 1}, a is identifier, but not variable identifier.
		if (node.parent
			&& (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent))
			&& node === node.parent.name
		) {
			return false
		}

		// Type node, not variable.
		if (node.parent
			&& ts.isTypeReferenceNode(node.parent)
		) {
			return false
		}

		// Identifier of type query node.
		if (node.parent
			&& ts.isTypeQueryNode(node.parent)
			&& node === node.parent.exprName
		) {
			return false
		}

		// Name of declaration of a class or interface, property, method, function name, get or set name.
		if (node.parent
			&& (ts.isClassDeclaration(node.parent)
				|| ts.isInterfaceDeclaration(node.parent)
				|| ts.isVariableDeclaration(node.parent)
				|| ts.isMethodDeclaration(node.parent)
				|| ts.isPropertyDeclaration(node.parent)
				|| ts.isFunctionDeclaration(node.parent)
				|| ts.isGetAccessorDeclaration(node.parent)
				|| ts.isSetAccessorDeclaration(node.parent)
				|| ts.isImportSpecifier(node.parent)
			)
			&& node === node.parent.name
		) {
			return false
		}

		// `undefined` is an identifier.
		if (node.text === 'undefined') {
			return false
		}

		return true
	}

	/** Whether be function, method, or get/set accessor, or arrow function. */
	function isFunctionLike(node: TS.Node): node is TS.FunctionLikeDeclaration {
		return isNonArrowFunctionLike(node)
			|| ts.isArrowFunction(node)
	}

	/** Whether be function, method, or get/set accessor, but arrow function is excluded. */
	function isNonArrowFunctionLike(node: TS.Node): node is TS.FunctionLikeDeclaration {
		return ts.isMethodDeclaration(node)
			|| ts.isMethodSignature(node)
			|| ts.isFunctionDeclaration(node)
			|| ts.isFunctionExpression(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isConstructorDeclaration(node)
	}

	/** Test whether be class, interface, or object like. */
	function isObjectLike(node: TS.Node): node is ObjectLike {
		return ts.isClassLike(node)
			|| ts.isInterfaceDeclaration(node)
			|| ts.isTypeLiteralNode(node)
	}

	/** Whether be a property declaration or signature. */
	function isPropertyLike(node: TS.Node): node is TS.PropertySignature | TS.PropertyDeclaration {
		return ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)
	}

	/** Whether be property or signature, or get accessor. */
	function isPropertyOrGetAccessor(node: TS.Node):
		node is TS.PropertySignature | TS.PropertyDeclaration | TS.GetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
	}

	/** Whether be property or signature, get/set accessor. */
	function isPropertyOrGetSetAccessor(node: TS.Node):
		node is TS.PropertySignature | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isSetAccessorDeclaration(node)
	}

	/** Whether be a constructor declaration or signature. */
	function isConstructorLike(node: TS.Node): node is TS.ConstructorDeclaration | TS.ConstructSignatureDeclaration {
		return ts.isConstructorDeclaration(node) || ts.isConstructSignatureDeclaration(node)
	}

	/** Whether be a method declaration or signature. */
	function isMethodLike(node: TS.Node): node is TS.MethodSignature | TS.MethodDeclaration {
		return ts.isMethodSignature(node) || ts.isMethodDeclaration(node)
	}

	/** Whether node represents a type-only node. */
	function isTypeDeclaration(node: TS.Node): node is TS.TypeAliasDeclaration | TS.InterfaceDeclaration {
		return ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
	}

	/** Whether be `this`. */
	function isThis(node: TS.Node): node is TS.ThisExpression {
		return node.kind === ts.SyntaxKind.ThisKeyword
	}

	/** Test whether be string, number, boolean, null, undefined. */
	function isLiteralLike(node: TS.Node): boolean {
		return node.kind === ts.SyntaxKind.TrueKeyword
        	|| node.kind === ts.SyntaxKind.FalseKeyword
			|| ts.isNumericLiteral(node)
			|| ts.isStringLiteralLike(node)
			|| node.kind === ts.SyntaxKind.NullKeyword
			|| ts.isIdentifier(node) && getText(node) === 'undefined'
	}

	/** Test whether of `Array` type. */
	function isArray(rawNode: TS.Node): boolean {
		let type = types.typeOf(rawNode)
		return types.isArrayType(type)
	}

	/** Whether function will instantly run. */
	function isInstantlyRunFunction(node: TS.Node): node is TS.FunctionLikeDeclaration {

		// [...].map(fn)
		return isFunctionLike(node)
			&& ts.isCallExpression(node.parent)
			&& access.isAccess(node.parent.expression)
			&& isArray((node.parent.expression as AccessNode).expression)
	}


	/** Whether returned `void` or `Promise<void>`. */
	function isVoidReturning(node: TS.FunctionLikeDeclaration): boolean {
		let type = types.getReturnTypeOfSignature(node)
		if (!type) {
			return false
		}

		let typeText = types.getTypeFullText(type)
		
		return typeText === 'void' || typeText === 'Promise<void>'
	}

	return {
		isRaw,
		getFullText,
		getText,
		getIdentifier,
		isVariableIdentifier,
		isFunctionLike,
		isNonArrowFunctionLike,
		isObjectLike,
		isPropertyLike,
		isPropertyOrGetAccessor,
		isPropertyOrGetSetAccessor,
		isConstructorLike,
		isMethodLike,
		isTypeDeclaration,
		isThis,
		isLiteralLike,
		isVoidReturning,
		isArray,
		isInstantlyRunFunction,
	}
}
