import * as ts from 'typescript'


/** Property or element access types. */
export type AccessNode = ts.PropertyAccessExpression | ts.ElementAccessExpression

/** Property access types. */
export type AssignmentNode = ts.BinaryExpression | ts.PostfixUnaryExpression | ts.PrefixUnaryExpression

/** Resolved names after resolve importing of a node. */
export interface ResolvedImportNames {
	memberName: string
	moduleName: string
}


/** Help to get and check. */
export namespace Helper {

	let printer: ts.Printer = ts.createPrinter()
	let typeChecker: ts.TypeChecker
	let transformContext: ts.TransformationContext | undefined = undefined


	
	//// Set context checker and transformation context.
	export function setContext(checker: ts.TypeChecker, context: ts.TransformationContext | undefined) {
		typeChecker = checker
		transformContext = context
	}



	//// Global, share

	/** Get node full text, can output from a newly created node. */
	export function getFullText(node: ts.Node) {
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

	/** get text without quoted for string, otherwise get full text. */
	export function getText(node: ts.Node): string {
		if (ts.isStringLiteral(node)) {
			return node.text
		}
		else {
			return getFullText(node)
		}
	}

	/** Returns the identifier, like variable or declaration name of a given node if possible. */
	export function getIdentifier(node: ts.Node): ts.Identifier | undefined {

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


	/** Test whether a node is an variable name identifier. */
	export function isVariableIdentifier(node: ts.Node): node is ts.Identifier {
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
		if (ts.isTypeQueryNode(node.parent)
			&& node === node.parent.exprName
		) {
			return false
		}

		// Name of declaration of a class or interface, property, method, function name, get or set name.
		if ((ts.isClassDeclaration(node.parent)
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
	export function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
		return isNonArrowFunctionLike(node)
			|| ts.isArrowFunction(node)
	}

	/** Whether be function, method, or get/set accessor, but arrow function is excluded. */
	export function isNonArrowFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
		return ts.isMethodDeclaration(node)
			|| ts.isMethodSignature(node)
			|| ts.isFunctionDeclaration(node)
			|| ts.isFunctionExpression(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isConstructorDeclaration(node)
	}

	/** Whether be a property declaration or signature. */
	export function isPropertyLike(node: ts.Node): node is ts.PropertySignature | ts.PropertyDeclaration {
		return ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)
	}

	/** Whether be property or signature, or get accessor. */
	export function isPropertyOrGetAccessor(node: ts.Node):
		node is ts.PropertySignature | ts.PropertyDeclaration | ts.GetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
	}

	/** Whether be property or signature, get/set accessor. */
	export function isPropertyOrGetSetAccessor(node: ts.Node):
		node is ts.PropertySignature | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
	{
		return ts.isPropertySignature(node)
			|| ts.isPropertyDeclaration(node)
			|| ts.isGetAccessorDeclaration(node)
			|| ts.isSetAccessorDeclaration(node)
	}

	/** Whether be a method declaration or signature. */
	export function isMethodLike(node: ts.Node): node is ts.MethodSignature | ts.MethodDeclaration {
		return ts.isMethodSignature(node) || ts.isMethodDeclaration(node)
	}

	/** Whether node represents a type-only node. */
	export function isTypeDeclaration(node: ts.Node): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
		return ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
	}

	/** Whether be `this`. */
	export function isThis(node: ts.Node): node is ts.ThisExpression {
		return node.kind === ts.SyntaxKind.ThisKeyword
	}

	/** Test whether of `Array` type. */
	export function isArray(rawNode: ts.Node): boolean {
		let type = Helper.types.typeOf(rawNode)
		return Helper.types.isArrayType(type)
	}

	/** Test whether be element of `[a...]`. */
	export function isArraySpreadElement(node: ts.Node): boolean {
		return node.parent && ts.isSpreadElement(node.parent)
			&& node.parent.parent && ts.isArrayLiteralExpression(node.parent.parent)
	}

	/** Whether function will instantly run. */
	export function isInstantlyRunFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {

		// [...].map(fn)
		return isFunctionLike(node)
			&& ts.isCallExpression(node.parent)
			&& Helper.access.isAccess(node.parent.expression)
			&& isArray(node.parent.expression.expression)
	}

	/** Test whether be `Map` or `Set`, or of `Array` type. */
	export function isListStruct(rawNode: ts.Node): boolean {
		let type = Helper.types.typeOf(rawNode)
		let typeNode = Helper.types.getOrMakeTypeNode(rawNode)
		let objName = typeNode ? Helper.types.getTypeNodeReferenceName(typeNode) : undefined

		return objName === 'Map'
			|| objName === 'Set'
			|| Helper.types.isArrayType(type)
	}
	

	/** Visit node and all descendant nodes, find a node match test fn. */
	export function findInward(node: ts.Node, test: (node: ts.Node) => boolean) : ts.Node | null {
		if (test(node)) {
			return node
		}

		let found: ts.Node | null = null

		ts.visitEachChild(node, (n) => {
			found ||= findInward(n, test)
			return n
		}, transformContext)

		return found
	}



	/** Decorator Part */
	export namespace deco {

		/** Get all decorator from a class declaration, a property or method declaration. */
		export function getDecorators(
			node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
		): ts.Decorator[] {
			return (node.modifiers?.filter((m: ts.ModifierLike) => ts.isDecorator(m)) || []) as ts.Decorator[]
		}

		/** Get the first decorator from a class declaration, a property or method declaration. */
		export function getFirst(
			node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
		): ts.Decorator | undefined {
			return node.modifiers?.find((m: ts.ModifierLike) => ts.isDecorator(m)) as ts.Decorator | undefined
		}

		/** Get the first decorator from a class declaration, a property or method declaration. */
		export function getFirstName(
			node: ts.ClassDeclaration | ts.MethodDeclaration | ts.PropertyDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration
		): string | undefined {
			let decorator = getFirst(node)
			let decoName = decorator ? getName(decorator) : undefined

			return decoName
		}

		/** Get the first decorator name of a decorator. */
		export function getName(node: ts.Decorator): string | undefined {
			let resolved = symbol.resolveImport(node)
			if (resolved) {
				return resolved.memberName
			}

			let decl = symbol.resolveDeclaration(node, ts.isFunctionDeclaration)
			if (!decl) {
				return undefined
			}

			return decl.name?.text
		}
	}



	/** Class part */
	export namespace cls {

		/** 
		 * Get name of a class member.
		 * For a constructor function, it returns `constructor`
		 */
		export function getMemberName(node: ts.ClassElement): string {
			if (ts.isConstructorDeclaration(node)) {
				return 'constructor'
			}
			else {
				return getFullText(node.name!)
			}
		}

		/** 
		 * Get one class member declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getMember(node: ts.ClassDeclaration, memberName: string, resolveExtend: boolean = false): ts.ClassElement | undefined {
			if (resolveExtend) {
				let prop = getMember(node, memberName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getMember(superClass, memberName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return getMemberName(m) === memberName
				}) as ts.PropertyDeclaration | undefined
			}
		}

		/** 
		 * Get one class property declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getProperty(node: ts.ClassDeclaration, propertyName: string, resolveExtend: boolean = false): ts.PropertyDeclaration | undefined {
			if (resolveExtend) {
				let prop = getProperty(node, propertyName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getProperty(superClass, propertyName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isPropertyDeclaration(m)
						&& getMemberName(m) === propertyName
				}) as ts.PropertyDeclaration | undefined
			}
		}

		/** 
		 * Get one class method declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		export function getMethod(node: ts.ClassDeclaration, methodName: string, resolveExtend: boolean = false): ts.MethodDeclaration | undefined {
			if (resolveExtend) {
				let prop = getMethod(node, methodName, false)
				if (prop) {
					return prop
				}

				let superClass = getSuper(node)
				if (superClass) {
					return getMethod(superClass, methodName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isMethodDeclaration(m)
						&& getMemberName(m) === methodName
				}) as ts.MethodDeclaration | undefined
			}
		}

		/** Get extends expression. */
		export function getExtends(node: ts.ClassDeclaration): ts.ExpressionWithTypeArguments | undefined {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return undefined
			}

			let firstType = extendHeritageClause.types[0]
			if (!firstType) {
				return undefined
			}

			return firstType
		}

		/** Get super class declaration. */
		export function getSuper(node: ts.ClassDeclaration): ts.ClassDeclaration | undefined {
			let extendsNode = getExtends(node)
			if (!extendsNode) {
				return undefined
			}

			let exp = extendsNode.expression
			let superClass = symbol.resolveDeclaration(exp, ts.isClassDeclaration)

			return superClass as ts.ClassDeclaration | undefined
		}

		/** Test whether is derived class of a specified named class, and of specified module. */
		export function isDerivedOf(node: ts.ClassDeclaration, declName: string, moduleName: string): boolean {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return false
			}

			let firstType = extendHeritageClause.types[0]
			if (!firstType || !ts.isExpressionWithTypeArguments(firstType)) {
				return false
			}

			let exp = firstType.expression

			let resolved = symbol.resolveImport(exp)
			if (resolved) {
				if (resolved.moduleName === moduleName && resolved.memberName === declName) {
					return true
				}
			}

			let superClass = symbol.resolveDeclaration(exp, ts.isClassDeclaration)
			if (superClass) {
				return isDerivedOf(superClass, declName, moduleName)
			}

			return false
		}

		/** 
		 * Test whether class or super class implements a type with specified name and located at specified module.
		 * If `outerModuleName` specified, and importing from a relative path, it implies import from this module.
		 */
		export function isImplemented(node: ts.ClassDeclaration, typeName: string, moduleName: string, outerModuleName?: string): boolean {
			let implementClauses = node.heritageClauses?.find(h => {
				return h.token === ts.SyntaxKind.ImplementsKeyword
			})

			if (implementClauses) {
				let implementModules = implementClauses.types.find(type => {
					let resolved = symbol.resolveImport(type.expression)

					if (!resolved) {
						return false
					}

					if (resolved.memberName !== typeName) {
						return false
					}
					
					if (resolved.moduleName === moduleName) {
						return true
					}

					// Import relative module, try match outer module name/
					if (outerModuleName
						&& resolved.moduleName.startsWith('.')
					) {
						if (moduleName === outerModuleName) {
							return true
						}
					}
					
					return false
				})

				if (implementModules) {
					return true
				}
			}

			let superClass = getSuper(node)
			if (!superClass) {
				return false
			}

			return isImplemented(superClass, typeName, moduleName)
		}

		/** Get constructor. */
		export function getConstructor(node: ts.ClassDeclaration, resolveExtend: boolean = false): ts.ConstructorDeclaration | undefined {
			let cons = node.members.find(v => ts.isConstructorDeclaration(v)) as ts.ConstructorDeclaration | undefined
			if (cons) {
				return cons
			}

			if (resolveExtend) {
				let superClass = getSuper(node)
				if (superClass) {
					return getConstructor(superClass, resolveExtend)
				}
			}

			return undefined
		}

		/** Get constructor parameter list, even from super class. */
		export function getConstructorParameters(node: ts.ClassDeclaration): ts.ParameterDeclaration[] | undefined {
			let constructor = getConstructor(node, true)
			if (constructor) {
				return [...constructor.parameters]
			}
	
			return undefined
		}

		/** Whether property or method has specified modifier. */
		export function hasModifier(node: ts.PropertyDeclaration | ts.MethodDeclaration, name: 'readonly' | 'static' | 'protected' | 'private'): boolean {
			for (let modifier of node.modifiers || []) {
				if (modifier.kind === ts.SyntaxKind.ReadonlyKeyword && name === 'readonly') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.StaticKeyword && name === 'static') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.ProtectedKeyword && name === 'protected') {
					return true
				}
				else if (modifier.kind === ts.SyntaxKind.PrivateKeyword && name === 'private') {
					return true
				}
			}

			return false
		}
	}



	/** Property Access. */
	export namespace access {

		/** Whether be accessing like `a.b` or `a[b]`. */
		export function isAccess(node: ts.Node): node is AccessNode {
			return ts.isPropertyAccessExpression(node)
				|| ts.isElementAccessExpression(node)
		}

		/** get accessing property node. */
		export function getPropertyNode(node: AccessNode): ts.Expression {
			return ts.isPropertyAccessExpression(node)
				? node.name
				: node.argumentExpression
		}

		/** get property accessing property text. */
		export function getPropertyText(node: AccessNode): string {
			let nameNode = getPropertyNode(node)
			return getText(nameNode)
		}

		/** 
		 * `a.b.c` -> `a`.
		 * `a.b!.c` -> `a`
		 * `(a.b as any).c` -> `a`
		 */
		export function getTopmost(node: AccessNode): ts.Expression {
			let topmost: ts.Expression = node

			while (true) {
				if (Helper.access.isAccess(topmost)) {
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
		}
	}



	/** Property Assignment */
	export namespace assign {

		/** Whether be property assignment like `a = x`. */
		export function isAssignment(node: ts.Node): node is AssignmentNode {
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

			return false
		}

		/** 
		 * get the value assigning from.
		 * `b` of `a = b`
		 */
		export function getFromExpression(node: AssignmentNode): ts.Expression {
			if (ts.isBinaryExpression(node)) {
				return node.right
			}
			else {
				return node.operand
			}
		}


		/** 
		 * get the expressions assigning to.
		 * `a` of `a = b`
		 * `a, b` of `[a, b] = c`
		 */
		export function getToExpressions(node: AssignmentNode): ts.Expression[] {
			if (ts.isBinaryExpression(node)) {
				return [...walkAssignToExpressions(node.left)]
			}
			else {
				return [node.operand]
			}
		}

		/** Walk for assign to expressions.  */
		function* walkAssignToExpressions(node: ts.Expression): Iterable<ts.Expression> {
			if (ts.isArrayLiteralExpression(node)) {
				for (let el of node.elements) {
					yield* walkAssignToExpressions(el)
				}
			}
			else if (ts.isObjectLiteralExpression(node)) {
				for (let prop of node.properties) {
					if (ts.isPropertyAssignment(prop)) {
						yield* walkAssignToExpressions(prop.initializer)
					}
				}
			}
			else {
				yield node
			}
		}
	}



	/** Variable declarations. */
	export namespace variable {

		/**
		 * `let {a: b} = c` =>
		 * - name: b
		 * - keys: ['a']
		 */
		interface VariableDeclarationName {
			node: ts.Identifier
			name: string
			keys: (string | number)[]
		}

		/** 
		 * Walk for all declared variable names from a variable declaration.
		 * `let [a, b]` = ... -> `[a, b]`
		 * `let {a, b}` = ... -> `[a, b]`
		 */
		export function* walkDeclarationNames(node: ts.VariableDeclaration): Iterable<VariableDeclarationName> {
			return yield* walkVariablePatternElement(node.name, [])
		}

		/** Get all declared variable name from a variable pattern. */
		function* walkVariablePatternElement(
			node: ts.BindingName | ts.BindingElement | ts.ObjectBindingPattern | ts.ArrayBindingPattern | ts.OmittedExpression,
			keys: (string | number)[]
		): Iterable<VariableDeclarationName> {
			if (ts.isOmittedExpression(node)) {
				return
			}

			if (ts.isObjectBindingPattern(node)) {
				for (let element of node.elements) {
					let key = getText(element.propertyName ?? element.name)
					yield* walkVariablePatternElement(element, [...keys, key])
				}
			}
			else if (ts.isArrayBindingPattern(node)) {
				for (let i = 0; i < node.elements.length; i++) {
					let element = node.elements[i]
					yield* walkVariablePatternElement(element, [...keys, i])
				}
			}
			else if (ts.isBindingElement(node)) {
				yield* walkVariablePatternElement(node.name, keys)
			}
			else if (ts.isIdentifier(node)) {
				yield {
					node,
					name: getFullText(node),
					keys,
				}
			}
		}
	}


	
	/** Type part */
	export namespace types {

		/** 
		 * Get type node of a node.
		 * Will firstly try to get type node when doing declaration,
		 * If can't find, make a new type node, but it can't be resolved.
		 */
		export function getOrMakeTypeNode(node: ts.Node): ts.TypeNode | undefined {
			let typeNode: ts.TypeNode | undefined

			// `class {a: Type = xxx}`
			if (access.isAccess(node)) {
				typeNode = symbol.resolveDeclaration(node, isPropertyOrGetAccessor)?.type
			}

			// `let a: Type`
			else if (isVariableIdentifier(node)) {
				typeNode = symbol.resolveDeclaration(node, ts.isVariableDeclaration)?.type
			}

			// `() => Type`
			else if (ts.isCallExpression(node)) {
				typeNode = symbol.resolveDeclaration(node.expression, Helper.isFunctionLike)?.type
			}

			if (typeNode) {
				return typeNode
			}

			// This generated type node can't be resolved.
			return typeToTypeNode(typeOf(node))
		}

		/** Get type of a node. */
		export function typeOf(node: ts.Node): ts.Type {
			return typeChecker.getTypeAtLocation(node)
		}

		/** 
		 * Get type node of a type.
		 * Note the returned type node is not in source file, so can't be resolved.
		 */
		export function typeToTypeNode(type: ts.Type): ts.TypeNode | undefined {
			return typeChecker.typeToTypeNode(type, undefined, undefined)
		}

		/** Get type of a type node. */
		export function typeOfTypeNode(typeNode: ts.TypeNode): ts.Type | undefined {
			return typeChecker.getTypeFromTypeNode(typeNode)
		}

		/** Get full text of a type, all type parameters are included. */
		export function getTypeFullText(type: ts.Type): string {
			return typeChecker.typeToString(type)
		}

		/** Get the reference name of a type node, all type parameters are excluded. */
		export function getTypeNodeReferenceName(node: ts.TypeNode): string | undefined {
			if (!ts.isTypeReferenceNode(node)) {
				return undefined
			}

			let typeName = node.typeName
			if (!ts.isIdentifier(typeName)) {
				return undefined
			}

			return typeName.text
		}

		/** Get the returned type of a method / function declaration. */
		export function getReturnType(node: ts.SignatureDeclaration): ts.Type | undefined {
			let signature = typeChecker.getSignatureFromDeclaration(node)
			if (!signature) {
				return undefined
			}

			return signature.getReturnType()
		}

		/** Whether returned `void` or `Promise<void>`. */
		export function isVoidReturning(node: ts.FunctionLikeDeclaration): boolean {
			let type = types.getReturnType(node)
			if (!type) {
				return false
			}

			let typeText = getTypeFullText(type)
			
			return typeText === 'void' || typeText === 'Promise<void>'
		}


		/** Test whether type is object. */
		export function isObjectType(type: ts.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isObjectType(t))
			}

			return (type.getFlags() & ts.TypeFlags.Object) > 0
		}

		/** Test whether type represents a value. */
		export function isValueType(type: ts.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isValueType(t))
			}

			return (type.getFlags() & (
				ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BigIntLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
					| ts.TypeFlags.Undefined
					| ts.TypeFlags.Null
			)) > 0
		}

		/** Test whether type represents a string. */
		export function isStringType(type: ts.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.StringLike) > 0
		}

		/** Test whether type represents a number. */
		export function isNumericType(type: ts.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.NumberLike) > 0
		}

		/** Test whether type represents a value, and not null or undefined. */
		export function isNonNullableValueType(type: ts.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => isNonNullableValueType(t))
			}

			return (type.getFlags() & (
				ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BigIntLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
			)) > 0
		}

		/** 
		 * Test whether type of a node extends `Array<any>`.
		 * Note array tuple like `[number, number]` is not included.
		 */
		export function isArrayType(type: ts.Type): boolean {
			return typeChecker.isArrayType(type)
		}


		/** Analysis whether the property declaration resolve from a node is readonly. */
		export function isReadonly(node: ts.Node): boolean {

			// `class A{readonly p}` -> `p` and `this['p']` are readonly.
			// `interface A{readonly p}` -> `p` and `this['p']` are readonly.
			let propDecl = symbol.resolveDeclaration(node, isPropertyLike)
			if (propDecl && propDecl.modifiers?.find(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
				return true
			}

			// `a: Readonly<{p: 1}>` -> `a.p` is readonly, not observe.
			// `a: ReadonlyArray<...>` -> `a.?` is readonly, not observe.
			// `a: DeepReadonly<...>` -> `a.?` and `d.?.?` are readonly, not observe.
			// `readonly {...}` -> it may not 100% strict.
			if (access.isAccess(node)) {
				let exp = node.expression

				let expTypeNode = getOrMakeTypeNode(exp)
				if (!expTypeNode) {
					return false
				}

				if (ts.isTypeReferenceNode(expTypeNode)) {
					let name = getTypeNodeReferenceName(expTypeNode)
					if (name === 'Readonly' || name === 'ReadonlyArray') {
						return true
					}
				}

				// Type was expanded and removed alias.
				else if (ts.isTypeOperatorNode(expTypeNode)) {
					if (expTypeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
						return true
					}
				}
			}

			return false
		}
		
		
		/** 
		 * `A & B` -> `[A, B]`
		 * `Omit<A, B>` -> `[A, B]`
		 */
		export function destructTypeNode(node: ts.TypeNode):
			(ts.TypeReferenceNode | ts.TypeLiteralNode | ts.TypeQueryNode)[]
		{
			let list: (ts.TypeReferenceNode | ts.TypeLiteralNode)[] = []
			ts.visitNode(node, (n: ts.TypeNode) => destructTypeNodeVisitor(n, list))

			return list
		}

		function destructTypeNodeVisitor(node: ts.Node, list: ts.TypeNode[]): ts.Node {
			if (ts.isTypeReferenceNode(node) || ts.isTypeLiteralNode(node) || ts.isTypeQueryNode(node)) {
				list.push(node)
			}

			return ts.visitEachChild(node, (n: ts.Node) => destructTypeNodeVisitor(n, list), transformContext)
		}
	}



	/** 
	 * Symbol & Resolving
	 * Performance test: each resolving cost about 1~5 ms.
	 */
	export namespace symbol {

		/** Test whether a node has an import name and located at a module. */
		export function isImportedFrom(node: ts.Node, memberName: string, moduleName: string): boolean {
			let nm = resolveImport(node)

			if (nm && nm.memberName === memberName && nm.moduleName === moduleName) {
				return true
			}
			else {
				return false
			}
		}

		/** Resolve the import name and module. */
		export function resolveImport(node: ts.Node): ResolvedImportNames | undefined {
			let memberName: string | null = null
			let moduleName: string | null = null

			// `import * as M`, and use it's member like `M.member`.
			if (ts.isPropertyAccessExpression(node)) {
				memberName = getFullText(node.name)

				let decl = resolveDeclaration(node.expression, ts.isNamespaceImport, false)
				if (decl) {
					let moduleNameNode = decl.parent.parent.moduleSpecifier
					moduleName = ts.isStringLiteral(moduleNameNode) ? moduleNameNode.text : ''
				}
			}
			else {
				let decl = resolveDeclaration(node, ts.isImportSpecifier, false)
				if (decl) {
					let moduleNameNode = decl.parent.parent.parent.moduleSpecifier
					memberName =  (decl.propertyName || decl.name).text
					moduleName = ts.isStringLiteral(moduleNameNode) ? moduleNameNode.text : ''
				}
			}

			// Compile codes within `lupos.js` library.
			if (moduleName && moduleName.startsWith('.')
				&& node.getSourceFile().fileName.includes('/lupos.js/tests/')
			) {
				moduleName = '@pucelle/lupos.js'
			}

			if (moduleName !== null && memberName !== null) {
				return {
					memberName,
					moduleName,
				}
			}

			return undefined
		}

		/** 
		 * Resolve the symbol of a given node.
		 * The symbol links to all it's declarations.
		 * 
		 * `resolveAlias` determines whether stop resolving when meet an alias declaration.
		 *  - If wanting to resolve to it's original declared place, set to `true`.
		 *  - If wanting to resolve to it's latest imported place, set to `false`.
		 * Default value is `false`.
		 */
		export function resolveSymbol(node: ts.Node, resolveAlias: boolean): ts.Symbol | undefined {
			let symbol = typeChecker.getSymbolAtLocation(node)

			// Get symbol from identifier.
			if (!symbol && !ts.isIdentifier(node)) {
				let identifier = getIdentifier(node)
				symbol = identifier ? typeChecker.getSymbolAtLocation(identifier) : undefined
			}

			// Resolve aliased symbols to it's original declared place.
			if (resolveAlias && symbol && (symbol.flags & ts.SymbolFlags.Alias) > 0) {
				symbol = typeChecker.getAliasedSymbol(symbol)
			}

			return symbol
		}

		/** Resolves the declarations of a node. */
		export function resolveDeclarations<T extends ts.Declaration>(
			node: ts.Node,
			test?: (node: ts.Node) => node is T,
			resolveAlias: boolean = true
		): T[] | undefined {
			let symbol = resolveSymbol(node, resolveAlias)
			if (!symbol) {
				return undefined
			}

			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		}

		/** Resolves the first declaration from a node. */
		export function resolveDeclaration<T extends ts.Node>(
			node: ts.Node,
			test?: (node: ts.Node) => node is T,
			resolveAlias: boolean = true
		): T | undefined {
			let decls = resolveDeclarations(node, undefined, resolveAlias)
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		}

		/** Resolves all declarations from a symbol. */
		export function resolveDeclarationsBySymbol<T extends ts.Node>(symbol: ts.Symbol, test?: (node: ts.Node) => node is T): T[] | undefined {
			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		}

		/** Resolves the first declaration from a symbol. */
		export function resolveDeclarationBySymbol<T extends ts.Node>(symbol: ts.Symbol, test?: (node: ts.Node) => node is T): T | undefined {
			let decls = symbol.getDeclarations()
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		}


		/** 
		 * Resolve interface and all it's extended interfaces,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		export function* resolveChainedInterfaces(node: ts.Node): Iterable<ts.InterfaceDeclaration | ts.TypeLiteralNode> {
			
			// `{...}`
			if (ts.isTypeLiteralNode(node)) {
				yield node
			}

			// `interface A {...}`
			else if (ts.isInterfaceDeclaration(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* resolveChainedInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* resolveChainedInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: ts.Node): n is ts.InterfaceDeclaration | ts.TypeAliasDeclaration => {
					return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
				}

				let resolved = resolveDeclarations(node, test)
				if (resolved) {
					for (let res of resolved) {
						yield* resolveChainedInterfaces(res)
					}
				}
			}
		}


		/** 
		 * Resolve class declarations and interface and all it's extended,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		export function* resolveChainedClassesAndInterfaces(node: ts.Node):
			Iterable<ts.InterfaceDeclaration | ts.TypeLiteralNode | ts.ClassDeclaration | ts.ClassExpression>
		{
			
			// `{...}`
			if (ts.isTypeLiteralNode(node)) {
				yield node
			}

			// `interface A {...}`
			else if (ts.isInterfaceDeclaration(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedClassesAndInterfaces(type.expression)
				}
			}

			// `class A {...}` or `class {...}`
			else if (ts.isClassLike(node)) {
				yield node

				let extendHeritageClause = node.heritageClauses?.find(hc => {
					return hc.token === ts.SyntaxKind.ExtendsKeyword
						|| hc.token === ts.SyntaxKind.ImplementsKeyword
				})
	
				if (!extendHeritageClause) {
					return
				}
				
				for (let type of extendHeritageClause.types) {
					yield* resolveChainedClassesAndInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* resolveChainedClassesAndInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* resolveChainedClassesAndInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: ts.Node): n is ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.ClassLikeDeclaration => {
					return ts.isInterfaceDeclaration(n)
						|| ts.isTypeAliasDeclaration(n)
						|| ts.isClassLike(n)
				}

				let resolved = resolveDeclarations(node, test)
				
				if (resolved) {
					for (let res of resolved) {
						yield* resolveChainedClassesAndInterfaces(res)
					}
				}
			}
		}


		/** 
		 * Resolve class declarations from type nodes like:
		 * - `typeof Cls`
		 * - `{new(): Cls}`
		 */
		export function* resolveInstanceDeclarations(typeNode: ts.TypeNode): Iterable<ts.ClassDeclaration> {
			let typeNodes = types.destructTypeNode(typeNode)
			if (typeNodes.length === 0) {
				return
			}

			for (let typeNode of typeNodes) {
	
				// `typeof Com`, resolve `Com`.
				if (ts.isTypeQueryNode(typeNode)) {
					let decls = symbol.resolveDeclarations(typeNode.exprName, ts.isClassDeclaration)
					if (decls) {
						yield* decls
					}
				}
	
				// Resolve returned type of constructor `{new()...}`.
				else {
					for (let decl of symbol.resolveChainedInterfaces(typeNode)) {
						let newCons = decl.members.find(m => ts.isConstructSignatureDeclaration(m) || ts.isConstructorDeclaration(m)) as
							ts.ConstructSignatureDeclaration | ts.ConstructorDeclaration | undefined

						if (!newCons) {
							continue
						}
	
						let newTypeNode = newCons.type
						if (!newTypeNode) {
							continue
						}
	
						yield* resolveInstanceDeclarationsOfTypeNodeNormally(newTypeNode)
					}
				}
			}
		}
		
		/** Destruct type node, and resolve class declarations of each. */
		function* resolveInstanceDeclarationsOfTypeNodeNormally(typeNode: ts.TypeNode): Iterable<ts.ClassDeclaration> {
			let typeNodes = types.destructTypeNode(typeNode)
			if (typeNodes.length === 0) {
				return
			}

			for (let typeNode of typeNodes) {
				let decls = symbol.resolveDeclarations(typeNode, ts.isClassDeclaration)
				if (decls) {
					yield* decls
				}
			}
		}
	

		/** 
		 * Resolve all the class type parameters,
		 * which are the extended parameters of a final heritage class,
		 * and are interface like or type literal like.
		 */
		export function resolveExtendedInterfaceLikeTypeParameters(
			node: ts.ClassDeclaration, finalHeritageName: string, finalHeritageTypeParameterIndex: number
		): (ts.InterfaceDeclaration | ts.TypeLiteralNode)[] {

			let classDecl: ts.ClassDeclaration | undefined = node

			// <A & B, C> -> [[A, B], [C]]
			let refedTypeParameters: (ts.InterfaceDeclaration | ts.TypeLiteralNode)[][] = []
			
			// Assumes `A<B> extends C<D & B>`
			while (classDecl) {

				// `B`
				let selfParameters = classDecl.typeParameters

				// `C<D & B>`
				let extendsNode = cls.getExtends(classDecl)
				if (!extendsNode) {
					break
				}

				// `D & B`
				let superParameters = extendsNode.typeArguments
				if (!superParameters) {
					break
				}

				refedTypeParameters = remapRefedTypeParameters(refedTypeParameters, selfParameters, superParameters)

				// `C`
				if (getFullText(extendsNode.expression) === finalHeritageName) {
					return refedTypeParameters[finalHeritageTypeParameterIndex]
				}

				classDecl = cls.getSuper(classDecl)
			}
			
			return []
		}

		/** Analysis type references, and remap type reference from input parameters to super parameters. */
		function remapRefedTypeParameters(
			refed: (ts.InterfaceDeclaration | ts.TypeLiteralNode)[][],
			selfParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
			extendsParameters: ts.NodeArray<ts.TypeNode>
		): (ts.InterfaceDeclaration | ts.TypeLiteralNode)[][] {
			let selfMap: Map<string, (ts.InterfaceDeclaration | ts.TypeLiteralNode)[]> = new Map()
			let remapped: (ts.InterfaceDeclaration | ts.TypeLiteralNode)[][] = []

			// Assume `A<B> extends C<D & B>`

			// `B`
			if (selfParameters) {
				for (let i = 0; i < selfParameters.length; i++) {
					let param = selfParameters[i]

					// May no this parameter inputted.
					if (refed[i]) {
						selfMap.set(param.name.text, refed[i])
					}
				}
			}

			for (let i = 0; i < extendsParameters.length; i++) {
				let param = extendsParameters[i]
				let destructed = types.destructTypeNode(param)
				let paramRefed: (ts.InterfaceDeclaration | ts.TypeLiteralNode)[] = []

				for (let ref of destructed) {
					if (ts.isTypeReferenceNode(ref)) {
						let refName = getFullText(ref.typeName)

						// Use input parameter.
						if (selfMap.has(refName)) {
							paramRefed.push(...selfMap.get(refName)!)
						}

						// Use declared interface, or type literal.
						else {
							let chain = resolveChainedInterfaces(ref)
							paramRefed.push(...chain)
						}
					}
				}

				remapped.push(paramRefed)
			}

			return remapped
		}


		/** Check whether a property or get accessor declare in typescript library. */
		export function isOfTypescriptLib(rawNode: ts.Node): boolean {

			// Like `this.el.style.display`
			let decl = resolveDeclaration(rawNode)
			if (!decl) {
				return false
			}

			let fileName = decl.getSourceFile().fileName
			return /\/typescript\/lib\//.test(fileName)
		}
	}



	/** Import part. */
	export namespace imports {

		/** Get import statement come from specified module name. */
		export function getImportFromModule(moduleName: string, sourceFile: ts.SourceFile): ts.ImportDeclaration | undefined {
			return sourceFile.statements.find(st => {
				return ts.isImportDeclaration(st)
					&& ts.isStringLiteral(st.moduleSpecifier)
					&& st.moduleSpecifier.text === moduleName
					&& st.importClause?.namedBindings
					&& ts.isNamedImports(st.importClause?.namedBindings)
			}) as ts.ImportDeclaration | undefined
		}
	}
}