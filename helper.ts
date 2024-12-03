import type * as TS from 'typescript'


/** Property or element access types. */
export type AccessNode = TS.PropertyAccessExpression | TS.ElementAccessExpression

/** Property access types. */
export type AssignmentNode = TS.BinaryExpression | TS.PostfixUnaryExpression | TS.PrefixUnaryExpression

/** Resolved names after resolve importing of a node. */
export interface ResolvedImportNames {
	memberName: string
	moduleName: string
}

/** Type of Helper functions. */
export type Helper = ReturnType<typeof helperOfContext>


/** Help to get and check. */
export function helperOfContext(ts: typeof TS, typeChecker: TS.TypeChecker) {
	let printer = ts.createPrinter()


	
	//// Global

	/** Test whether a node is raw node. */
	function isRaw(node: TS.Node): boolean {
		return node.pos >= 0
	}

	/** Get node full text, can output from a newly created node. */
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

	/** get text without quoted for string, otherwise get full text. */
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


	/** Test whether a node is an variable name identifier. */
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

	/** Test whether of `Array` type. */
	function isArray(rawNode: TS.Node): boolean {
		let type = types.typeOf(rawNode)
		return types.isArrayType(type)
	}

	/** Test whether be element of `[a...]`. */
	function isArraySpreadElement(node: TS.Node): boolean {
		return node.parent && ts.isSpreadElement(node.parent)
			&& node.parent.parent && ts.isArrayLiteralExpression(node.parent.parent)
	}

	/** Whether function will instantly run. */
	function isInstantlyRunFunction(node: TS.Node): node is TS.FunctionLikeDeclaration {

		// [...].map(fn)
		return isFunctionLike(node)
			&& ts.isCallExpression(node.parent)
			&& access.isAccess(node.parent.expression)
			&& isArray(node.parent.expression.expression)
	}

	/** Test whether be `Map` or `Set`, or of `Array` type. */
	function isListStruct(rawNode: TS.Node): boolean {
		let type = types.typeOf(rawNode)
		let typeNode = types.getOrMakeTypeNode(rawNode)
		let objName = typeNode ? types.getTypeNodeReferenceName(typeNode) : undefined

		return objName === 'Map'
			|| objName === 'Set'
			|| types.isArrayType(type)
	}
	

	/** Walk node and all descendant nodes, test fn return a node to stop. */
	function walkInward(fromNode: TS.Node, test: (node: TS.Node) => TS.Node | void) : TS.Node | undefined {
		if (test(fromNode)) {
			return fromNode
		}

		let stop: TS.Node | undefined = undefined

		ts.forEachChild(fromNode, (n) => {
			stop ||= walkInward(n, test)
			return stop
		})

		return stop
	}

	/** Walk and all ancestral nodes, test fn return a node to stop. */
	function walkOutward(fromNode: TS.Node, test: (node: TS.Node) => TS.Node | void): TS.Node | null {
		if (test(fromNode)) {
			return fromNode
		}

		if (fromNode.parent) {
			return walkOutward(fromNode.parent, test)
		}

		return null
	}

	/** Visit node and all descendant nodes, find a node match test fn. */
	function findInward<T extends TS.Node>(fromNode: TS.Node, test: (node: TS.Node) => node is T) : T | undefined {
		if (test(fromNode)) {
			return fromNode
		}

		let found: TS.Node | undefined = undefined

		ts.forEachChild(fromNode, (n) => {
			found ||= findInward(n, test)
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


	/** Get innermost node at specified offset index. */
	function getNodeAtOffset(node: TS.Node, offset: number): TS.Node | undefined {
		if (offset >= node.getStart() && offset < node.getEnd()) {
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
		return comment.replace(/^\s*\/\/ ?|^\/\*\*[\s^\n]*|\s*\*\/\s*$|^\s*\* ?/gm, '')
	}




	/** Decorator Part */
	const deco = {

		/** Get all decorator from a class declaration, a property or method declaration. */
		getDecorators(
			node: TS.ClassLikeDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): TS.Decorator[] {
			return (node.modifiers?.filter((m: TS.ModifierLike) => ts.isDecorator(m)) || []) as TS.Decorator[]
		},

		/** Get the first decorator from a class declaration, a property or method declaration. */
		getFirst(
			node: TS.ClassLikeDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): TS.Decorator | undefined {
			return node.modifiers?.find((m: TS.ModifierLike) => ts.isDecorator(m)) as TS.Decorator | undefined
		},

		/** Get the first decorator from a class declaration, a property or method declaration. */
		getFirstName(
			node: TS.ClassLikeDeclaration | TS.MethodDeclaration | TS.PropertyDeclaration | TS.GetAccessorDeclaration | TS.SetAccessorDeclaration
		): string | undefined {
			let decorator = deco.getFirst(node)
			let decoName = decorator ? deco.getName(decorator) : undefined

			return decoName
		},

		/** Get the first decorator name of a decorator. */
		getName(node: TS.Decorator): string | undefined {
			let resolved = symbol.resolveImport(node)
			if (resolved) {
				return resolved.memberName
			}

			let decl = symbol.resolveDeclaration(node, ts.isFunctionDeclaration)
			if (!decl) {
				return undefined
			}

			return decl.name?.text
		},
	}



	/** Class part */
	const cls = {

		/** 
		 * Get name of a class member.
		 * For a constructor function, it returns `constructor`
		 */
		getMemberName(node: TS.ClassElement): string {
			if (ts.isConstructorDeclaration(node)) {
				return 'constructor'
			}
			else {
				return getFullText(node.name!)
			}
		},

		/** 
		 * Get one class member declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		getMember(node: TS.ClassLikeDeclaration, memberName: string, resolveExtend: boolean = false): TS.ClassElement | undefined {
			if (resolveExtend) {
				let prop = cls.getMember(node, memberName, false)
				if (prop) {
					return prop
				}

				let superClass = cls.getSuper(node)
				if (superClass) {
					return cls.getMember(superClass, memberName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return cls.getMemberName(m) === memberName
				}) as TS.PropertyDeclaration | undefined
			}
		},

		/** 
		 * Get one class property declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		getProperty(node: TS.ClassLikeDeclaration, propertyName: string, resolveExtend: boolean = false): TS.PropertyDeclaration | undefined {
			if (resolveExtend) {
				let prop = cls.getProperty(node, propertyName, false)
				if (prop) {
					return prop
				}

				let superClass = cls.getSuper(node)
				if (superClass) {
					return cls.getProperty(superClass, propertyName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isPropertyDeclaration(m)
						&& cls.getMemberName(m) === propertyName
				}) as TS.PropertyDeclaration | undefined
			}
		},

		/** 
		 * Get one class method declaration by it's name.
		 * `resolveExtend` specifies whether will look at extended class.
		 */
		getMethod(node: TS.ClassLikeDeclaration, methodName: string, resolveExtend: boolean = false): TS.MethodDeclaration | undefined {
			if (resolveExtend) {
				let prop = cls.getMethod(node, methodName, false)
				if (prop) {
					return prop
				}

				let superClass = cls.getSuper(node)
				if (superClass) {
					return cls.getMethod(superClass, methodName, resolveExtend)
				}

				return undefined
			}
			else {
				return node.members.find(m => {
					return ts.isMethodDeclaration(m)
						&& cls.getMemberName(m) === methodName
				}) as TS.MethodDeclaration | undefined
			}
		},

		/** Get extends expression. */
		getExtends(node: TS.ClassLikeDeclaration): TS.ExpressionWithTypeArguments | undefined {
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
		},

		/** Get super class declaration. */
		getSuper(node: TS.ClassLikeDeclaration): TS.ClassDeclaration | undefined {
			let extendsNode = cls.getExtends(node)
			if (!extendsNode) {
				return undefined
			}

			let exp = extendsNode.expression
			let superClass = symbol.resolveDeclaration(exp, ts.isClassDeclaration)

			return superClass as TS.ClassDeclaration | undefined
		},

		/** Walk super class declarations, not include current. */
		*walkSuper(node: TS.ClassLikeDeclaration): Iterable<TS.ClassDeclaration> {
			let superClass = cls.getSuper(node)
			if (superClass) {
				yield superClass
				yield *cls.walkSuper(superClass)
			}
		},

		/** Test whether is derived class of a specified named class, and of specified module. */
		isDerivedOf(node: TS.ClassLikeDeclaration, declName: string, moduleName: string): boolean {
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
				return cls.isDerivedOf(superClass, declName, moduleName)
			}

			return false
		},

		/** 
		 * Test whether class or super class implements a type with specified name and located at specified module.
		 * If `outerModuleName` specified, and importing from a relative path, it implies import from this module.
		 */
		isImplemented(node: TS.ClassLikeDeclaration, typeName: string, moduleName: string, outerModuleName?: string): boolean {
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

			let superClass = cls.getSuper(node)
			if (!superClass) {
				return false
			}

			return cls.isImplemented(superClass, typeName, moduleName)
		},

		/** Get constructor. */
		getConstructor(node: TS.ClassLikeDeclaration, resolveExtend: boolean = false): TS.ConstructorDeclaration | undefined {
			let cons = node.members.find(v => ts.isConstructorDeclaration(v)) as TS.ConstructorDeclaration | undefined
			if (cons) {
				return cons
			}

			if (resolveExtend) {
				let superClass = cls.getSuper(node)
				if (superClass) {
					return cls.getConstructor(superClass, resolveExtend)
				}
			}

			return undefined
		},

		/** Get constructor parameter list, even from super class. */
		getConstructorParameters(node: TS.ClassLikeDeclaration): TS.ParameterDeclaration[] | undefined {
			let constructor = cls.getConstructor(node, true)
			if (constructor) {
				return [...constructor.parameters]
			}
	
			return undefined
		},

		/** Whether property or method has specified modifier. */
		hasModifier(node: TS.PropertyDeclaration | TS.PropertySignature | TS.AccessorDeclaration | TS.MethodDeclaration, name: 'readonly' | 'static' | 'protected' | 'private' | 'public'): boolean {
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
				else if (modifier.kind === ts.SyntaxKind.PublicKeyword && name === 'public') {
					return true
				}
			}

			return false
		},
		
		/** Returns the visibility of given node. */
		getVisibility(node: TS.PropertyDeclaration | TS.PropertySignature | TS.AccessorDeclaration | TS.MethodDeclaration): 'public' | 'protected' | 'private' {
			if (cls.hasModifier(node, 'private') || node.name.getText().startsWith('$')) {
				return 'private'
			}
			else if (cls.hasModifier(node, 'protected')) {
				return 'protected'
			}
			else {
				return 'public'
			}
		}
	}



	/** Property Access. */
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
	}



	/** Property Assignment */
	const assign = {

		/** Whether be property assignment like `a = x`. */
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
			else {
				return node.operand
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
			else {
				return [node.operand]
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



	/**
	 * `let {a: b} = c` =>
	 * - name: b
	 * - keys: ['a']
	 */
	interface VariableDeclarationName {
		node: TS.Identifier
		name: string
		keys: (string | number)[]
	}



	/** Variable declarations. */
	const variable = {

		/** 
		 * Walk for all declared variable names from a variable declaration.
		 * `let [a, b]` = ... -> `[a, b]`
		 * `let {a, b}` = ... -> `[a, b]`
		 */
		*walkDeclarationNames(node: TS.VariableDeclaration): Iterable<VariableDeclarationName> {
			return yield* walkVariablePatternElement(node.name, [])
		},
	}

	/** Get all declared variable name from a variable pattern. */
	function *walkVariablePatternElement(
		node: TS.BindingName | TS.BindingElement | TS.ObjectBindingPattern | TS.ArrayBindingPattern | TS.OmittedExpression,
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


	
	/** Type part */
	const types = {

		/** 
		 * Get type node of a node.
		 * Will firstly try to get type node when doing declaration,
		 * If can't find, make a new type node, but it can't be resolved.
		 */
		getOrMakeTypeNode(node: TS.Node): TS.TypeNode | undefined {
			let typeNode: TS.TypeNode | undefined

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
				typeNode = symbol.resolveDeclaration(node.expression, isFunctionLike)?.type
			}

			if (typeNode) {
				return typeNode
			}

			// This generated type node can't be resolved.
			return types.typeToTypeNode(types.typeOf(node))
		},

		/** Get type of a node. */
		typeOf(node: TS.Node): TS.Type {
			return typeChecker.getTypeAtLocation(node)
		},

		/** 
		 * Get type node of a type.
		 * Note the returned type node is not in source file, so can't be resolved.
		 */
		typeToTypeNode(type: TS.Type): TS.TypeNode | undefined {
			return typeChecker.typeToTypeNode(type, undefined, undefined)
		},

		/** Get type of a type node. */
		typeOfTypeNode(typeNode: TS.TypeNode): TS.Type | undefined {
			return typeChecker.getTypeFromTypeNode(typeNode)
		},

		/** Get full text of a type, all type parameters are included. */
		getTypeFullText(type: TS.Type): string {
			return typeChecker.typeToString(type)
		},

		/** Get the reference name of a type node, all type parameters are excluded. */
		getTypeNodeReferenceName(node: TS.TypeNode): string | undefined {
			if (!ts.isTypeReferenceNode(node)) {
				return undefined
			}

			let typeName = node.typeName
			if (!ts.isIdentifier(typeName)) {
				return undefined
			}

			return typeName.text
		},

		/** Get the returned type of a method / function declaration. */
		getReturnType(node: TS.SignatureDeclaration): TS.Type | undefined {
			let signature = typeChecker.getSignatureFromDeclaration(node)
			if (!signature) {
				return undefined
			}

			return signature.getReturnType()
		},

		/** Whether returned `void` or `Promise<void>`. */
		isVoidReturning(node: TS.FunctionLikeDeclaration): boolean {
			let type = types.getReturnType(node)
			if (!type) {
				return false
			}

			let typeText = types.getTypeFullText(type)
			
			return typeText === 'void' || typeText === 'Promise<void>'
		},


		/** Test whether type is object. */
		isObjectType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isObjectType(t))
			}

			return (type.getFlags() & ts.TypeFlags.Object) > 0
		},

		/** Test whether type represents a value. */
		isValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isValueType(t))
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
		},

		/** Test whether type represents a string. */
		isStringType(type: TS.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.StringLike) > 0
		},

		/** Test whether type represents a number. */
		isNumericType(type: TS.Type): boolean {
			return (type.getFlags() & ts.TypeFlags.NumberLike) > 0
		},

		/** Test whether type represents a value, and not null or undefined. */
		isNonNullableValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isNonNullableValueType(t))
			}

			return (type.getFlags() & (
				ts.TypeFlags.StringLike
					| ts.TypeFlags.NumberLike
					| ts.TypeFlags.BigIntLike
					| ts.TypeFlags.BooleanLike
					| ts.TypeFlags.ESSymbolLike
			)) > 0
		},

		/** 
		 * Test whether type of a node extends `Array<any>`.
		 * Note array tuple like `[number, number]` is not included.
		 */
		isArrayType(type: TS.Type): boolean {
			return typeChecker.isArrayType(type)
		},


		/** Analysis whether the property declaration resolve from a node is readonly. */
		isReadonly(node: TS.Node): boolean {

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

				let expTypeNode = types.getOrMakeTypeNode(exp)
				if (!expTypeNode) {
					return false
				}

				if (ts.isTypeReferenceNode(expTypeNode)) {
					let name = types.getTypeNodeReferenceName(expTypeNode)
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
		},
		
		
		/** 
		 * `A & B` -> `[A, B]`
		 * `Omit<A, B>` -> `[A, B]`
		 */
		destructTypeNode(node: TS.TypeNode):
			(TS.TypeReferenceNode | TS.TypeLiteralNode | TS.TypeQueryNode)[]
		{
			let list: (TS.TypeReferenceNode | TS.TypeLiteralNode)[] = []
			destructTypeNodeRecursively(node, list)

			return list
		},

	}

	function destructTypeNodeRecursively(node: TS.Node, list: TS.TypeNode[]) {
		if (ts.isTypeReferenceNode(node) || ts.isTypeLiteralNode(node) || ts.isTypeQueryNode(node)) {
			list.push(node)
		}

		ts.forEachChild(node, (n: TS.Node) => destructTypeNodeRecursively(n, list))
	}



	/** 
	 * Symbol & Resolving
	 * Performance test: each resolving cost about 1~5 ms.
	 */
	const symbol = {

		/** Test whether a node has an import name and located at a module. */
		isImportedFrom(node: TS.Node, memberName: string, moduleName: string): boolean {
			let nm = symbol.resolveImport(node)

			if (nm && nm.memberName === memberName && nm.moduleName === moduleName) {
				return true
			}
			else {
				return false
			}
		},

		/** Resolve the import name and module. */
		resolveImport(node: TS.Node): ResolvedImportNames | undefined {
			let memberName: string | null = null
			let moduleName: string | null = null

			// `import * as M`, and use it's member like `M.member`.
			if (ts.isPropertyAccessExpression(node)) {
				memberName = getFullText(node.name)

				let decl = symbol.resolveDeclaration(node.expression, ts.isNamespaceImport, false)
				if (decl) {
					let moduleNameNode = decl.parent.parent.moduleSpecifier
					moduleName = ts.isStringLiteral(moduleNameNode) ? moduleNameNode.text : ''
				}
			}
			else {
				let decl = symbol.resolveDeclaration(node, ts.isImportSpecifier, false)
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
		},

		/** 
		 * Resolve the symbol of a given node.
		 * The symbol links to all it's declarations.
		 * 
		 * `resolveAlias` determines whether stop resolving when meet an alias declaration.
		 *  - If wanting to resolve to it's original declared place, set to `true`.
		 *  - If wanting to resolve to it's latest imported place, set to `false`.
		 * Default value is `false`.
		 */
		resolveSymbol(node: TS.Node, resolveAlias: boolean): TS.Symbol | undefined {
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
		},

		/** Resolves the declarations of a node. */
		resolveDeclarations<T extends TS.Declaration>(
			node: TS.Node,
			test?: (node: TS.Node) => node is T,
			resolveAlias: boolean = true
		): T[] | undefined {
			let sym = symbol.resolveSymbol(node, resolveAlias)
			if (!sym) {
				return undefined
			}

			let decls = sym.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		},

		/** Resolves the first declaration from a node. */
		resolveDeclaration<T extends TS.Node>(
			node: TS.Node,
			test?: (node: TS.Node) => node is T,
			resolveAlias: boolean = true
		): T | undefined {
			let decls = symbol.resolveDeclarations(node, undefined, resolveAlias)
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		},

		/** Resolves all declarations from a symbol. */
		resolveDeclarationsBySymbol<T extends TS.Node>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T[] | undefined {
			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		},

		/** Resolves the first declaration from a symbol. */
		resolveDeclarationBySymbol<T extends TS.Node>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T | undefined {
			let decls = symbol.getDeclarations()
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		},


		/** 
		 * Resolve interface and all it's extended interfaces,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		*resolveChainedInterfaces(node: TS.Node): Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode> {
			
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
					yield* symbol.resolveChainedInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* symbol.resolveChainedInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* symbol.resolveChainedInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: TS.Node): n is TS.InterfaceDeclaration | TS.TypeAliasDeclaration => {
					return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
				}

				let resolved = symbol.resolveDeclarations(node, test)
				if (resolved) {
					for (let res of resolved) {
						yield* symbol.resolveChainedInterfaces(res)
					}
				}
			}
		},


		/** 
		 * Resolve class declarations and interface and all it's extended,
		 * and all the interface like type literals: `type A = {...}`.
		 */
		*resolveChainedClassesAndInterfaces(node: TS.Node):
			Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode | TS.ClassLikeDeclaration | TS.ClassExpression>
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
					yield* symbol.resolveChainedClassesAndInterfaces(type.expression)
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
					yield* symbol.resolveChainedClassesAndInterfaces(type.expression)
				}
			}

			// `type B = A`
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let typeNode of types.destructTypeNode(node.type)) {
					yield* symbol.resolveChainedClassesAndInterfaces(typeNode)
				}
			}

			// Identifier of type reference.
			else if (ts.isTypeReferenceNode(node)) {
				yield* symbol.resolveChainedClassesAndInterfaces(node.typeName)
			}

			// Resolve and continue.
			else {
				let test = (n: TS.Node): n is TS.InterfaceDeclaration | TS.TypeAliasDeclaration | TS.ClassLikeDeclaration => {
					return ts.isInterfaceDeclaration(n)
						|| ts.isTypeAliasDeclaration(n)
						|| ts.isClassLike(n)
				}

				let resolved = symbol.resolveDeclarations(node, test)
				
				if (resolved) {
					for (let res of resolved) {
						yield* symbol.resolveChainedClassesAndInterfaces(res)
					}
				}
			}
		},


		/** 
		 * Resolve class declarations from type nodes like:
		 * - `typeof Cls`
		 * - `{new(): Cls}`
		 */
		*resolveInstanceDeclarations(typeNode: TS.TypeNode): Iterable<TS.ClassLikeDeclaration> {
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
						TS.ConstructSignatureDeclaration | TS.ConstructorDeclaration | undefined

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
		},
	

		/** 
		 * Resolve all the class type parameters,
		 * which are the extended parameters of a final heritage class,
		 * and are interface like or type literal like.
		 */
		resolveExtendedInterfaceLikeTypeParameters(
			node: TS.ClassLikeDeclaration, finalHeritageName: string, finalHeritageTypeParameterIndex: number
		): (TS.InterfaceDeclaration | TS.TypeLiteralNode)[] {

			let classDecl: TS.ClassLikeDeclaration | undefined = node

			// <A & B, C> -> [[A, B], [C]]
			let refedTypeParameters: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] = []
			
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
		},

		/** Check whether a property or get accessor declare in typescript library. */
		isOfTypescriptLib(rawNode: TS.Node): boolean {

			// Like `this.el.style.display`
			let decl = symbol.resolveDeclaration(rawNode)
			if (!decl) {
				return false
			}

			let fileName = decl.getSourceFile().fileName
			return /\/typescript\/lib\//.test(fileName)
		}
	}

	
	/** Destruct type node, and resolve class declarations of each. */
	function* resolveInstanceDeclarationsOfTypeNodeNormally(typeNode: TS.TypeNode): Iterable<TS.ClassLikeDeclaration> {
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

	/** Analysis type references, and remap type reference from input parameters to super parameters. */
	function remapRefedTypeParameters(
		refed: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][],
		selfParameters: TS.NodeArray<TS.TypeParameterDeclaration> | undefined,
		extendsParameters: TS.NodeArray<TS.TypeNode>
	): (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] {
		let selfMap: Map<string, (TS.InterfaceDeclaration | TS.TypeLiteralNode)[]> = new Map()
		let remapped: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] = []

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
			let paramRefed: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[] = []

			for (let ref of destructed) {
				if (ts.isTypeReferenceNode(ref)) {
					let refName = getFullText(ref.typeName)

					// Use input parameter.
					if (selfMap.has(refName)) {
						paramRefed.push(...selfMap.get(refName)!)
					}

					// Use declared interface, or type literal.
					else {
						let chain = symbol.resolveChainedInterfaces(ref)
						paramRefed.push(...chain)
					}
				}
			}

			remapped.push(paramRefed)
		}

		return remapped
	}



	/** Import part. */
	const imports = {

		/** Get import statement come from specified module name. */
		getImportFromModule(moduleName: string, sourceFile: TS.SourceFile): TS.ImportDeclaration | undefined {
			return sourceFile.statements.find(st => {
				return ts.isImportDeclaration(st)
					&& ts.isStringLiteral(st.moduleSpecifier)
					&& st.moduleSpecifier.text === moduleName
					&& st.importClause?.namedBindings
					&& ts.isNamedImports(st.importClause?.namedBindings)
			}) as TS.ImportDeclaration | undefined
		},
	}


	return {
		ts,
		isRaw,
		getFullText,
		getText,
		getIdentifier,
		isVariableIdentifier,
		isFunctionLike,
		isNonArrowFunctionLike,
		isPropertyLike,
		isPropertyOrGetAccessor,
		isPropertyOrGetSetAccessor,
		isMethodLike,
		isTypeDeclaration,
		isThis,
		isArray,
		isArraySpreadElement,
		isInstantlyRunFunction,
		isListStruct,
		walkInward,
		walkOutward,
		findInward,
		findOutward,
		findOutwardUntil,
		findAllInward,
		getNodeAtOffset,
		getNodeDescription,
		deco,
		class: cls,
		access,
		assign,
		variable,
		types,
		symbol,
		imports,
	}
}