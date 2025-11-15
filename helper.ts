import type * as TS from 'typescript'
import {assignableChecker} from './assignable-checker'


/** Property or element access types. */
export type AccessNode = TS.PropertyAccessExpression | TS.ElementAccessExpression

/** Property access types. */
export type AssignmentNode = TS.BinaryExpression | TS.PostfixUnaryExpression | TS.PrefixUnaryExpression | TS.DeleteExpression

/** Class, interface, or object like. */
export type ObjectLike = TS.InterfaceDeclaration | TS.TypeLiteralNode | TS.ClassLikeDeclaration

/** Resolved names after resolve importing of a node. */
export interface ResolvedImportNames {
	memberName: string
	moduleName: string
}

/**
 * `let {a: b} = c` =>
 * - name: 'b'
 * - node: b
 * - init: c
 * - keys: ['a']
 * 
 * `let {a: b} = {a: 1}` =>
 * - name: `b`
 * - node: b
 * - init: 1
 * - keys: []
 */
export interface DeconstructedVariableDeclarationItem {
	name: string
	node: TS.Identifier
	keys: (string | number)[]
	initializer: TS.Expression | undefined
}

/**
 * `f(a)` `function f(b: T)` =>
 * - arg: a
 * - type: T
 * 
 * `f([a])` `function f(b: [T])` =>
 * - arg: a
 * - type: T
 */
export interface DeconstructedArgumentTypeItem {
	arg: TS.Expression
	typeNode: TS.TypeNode | undefined
}


/** Type of Helper functions. */
export type Helper = ReturnType<typeof helperOfContext>


/** Help to get and check. */
export function helperOfContext(ts: typeof TS, typeCheckerGetter: () => TS.TypeChecker) {
	let printer = ts.createPrinter()
	let theAssignableChecker = assignableChecker(ts, typeCheckerGetter)

	
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
			&& isArray(node.parent.expression.expression)
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



	/** Class part. */
	const cls = {

		/** 
		 * Get one property declaration by it's name.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getProperty(
			node: ObjectLike,
			propertyName: string,
			resolveChained: boolean
		): TS.PropertyDeclaration | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === propertyName
					&& ts.isPropertyDeclaration(member)
				) {
					return member
				}
			}
			
			return undefined
		},

		/** 
		 * Get method declaration by it's name, and which will always have body.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getMethod(
			node: TS.ClassLikeDeclaration,
			methodName: string,
			resolveChained: boolean
		): TS.MethodDeclaration | TS.MethodSignature | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === methodName
					&& isMethodLike(member)
				) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get constructor declaration.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getConstructor(
			node: ObjectLike,
			resolveChained: boolean
		): TS.ConstructorDeclaration | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (ts.isConstructorDeclaration(member)) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get constructor parameter list, even from super class.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getConstructorParameters(
			node: ObjectLike,
			resolveChained: boolean
		): TS.ParameterDeclaration[] | undefined {
			let constructor = cls.getConstructor(node, resolveChained)
			if (constructor) {
				return [...constructor.parameters]
			}

			return undefined
		},

		/** 
		 * Get super class declaration.
		 * Note it can't resolve unions of object literals.
		 */
		getSuper(node: TS.ClassLikeDeclaration): TS.ClassLikeDeclaration | undefined {
			let extendsNodes = objectLike.getExtends(node)
			if (!extendsNodes) {
				return undefined
			}

			let extendsNode = extendsNodes.length > 0 ? extendsNodes[0] : undefined
			if (!extendsNode) {
				return undefined
			}

			return extendsNode
		},

		/** 
		 * Walk chained super class, not include current.
		 * Note it doesn't include
		 */
		*walkChainedSuper(node: TS.ClassLikeDeclaration):Iterable<TS.ClassLikeDeclaration> {
			let superClass = cls.getSuper(node)
			if (superClass) {
				yield superClass
				yield *cls.walkChainedSuper(superClass)
			}
		},

		/** Walk `node` and chained super class declarations, not include current. */
		*walkSelfAndChainedSuper(node: TS.ClassLikeDeclaration): Iterable<TS.ClassLikeDeclaration> {
			yield node
			yield* cls.walkChainedSuper(node)
		},

		/** Get implements expression. */
		getImplements(node: TS.ClassLikeDeclaration): TS.ExpressionWithTypeArguments[] {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ImplementsKeyword
			})

			if (!extendHeritageClause) {
				return []
			}

			return Array.from(extendHeritageClause.types)
		},

		/** 
		 * Test whether class or super class implements a type with specified name and located at specified module.
		 * If `outerModuleName` specified, and importing from a relative path, it implies import from this module.
		 */
		isImplementedOf(node: TS.ClassLikeDeclaration, typeName: string, moduleName: string): boolean {
			return !!cls.getFirstImplementedOf(node, [typeName], moduleName)
		},

		/** 
		 * Get first of the class or super class implemented types with specified name and located at specified module.
		 * If `outerModuleName` specified, and importing from a relative path, it implies import from this module.
		 */
		getFirstImplementedOf(node: TS.ClassLikeDeclaration, typeNames: string[], moduleName: string): string | null {
			let implementClauses = node.heritageClauses?.find(h => {
				return h.token === ts.SyntaxKind.ImplementsKeyword
			})

			if (implementClauses) {
				for (let type of implementClauses.types) {
					let resolved = symbol.resolveImport(type.expression)

					if (!resolved) {
						continue
					}

					if (!typeNames.includes(resolved.memberName)) {
						continue
					}
					
					if (resolved.moduleName === moduleName) {
						return resolved.memberName
					}

					// Import relative module, try match file path after excluding user part.
					if (resolved.moduleName.startsWith('.')
						&& node.getSourceFile().fileName.includes('/' + moduleName.replace(/^@[\w-]+\//, '') + '/')
					) {
						return resolved.memberName
					}
				}
			}

			let superClass = cls.getSuper(node)
			if (!superClass) {
				return null
			}

			return cls.getFirstImplementedOf(superClass, typeNames, moduleName)
		},
	}



	/** Member of classes, interfaces, or object like. */
	const objectLike = {

		/** Test whether is derived class of a specified named class, and of specified module. */
		isDerivedOf(node: TS.ClassLikeDeclaration | TS.InterfaceDeclaration, declName: string, moduleName: string): boolean {
			return !!objectLike.getFirstDerivedOf(node, [declName], moduleName)
		},

		/** Get first of the derived class of a specified named class, and of specified module. */
		getFirstDerivedOf(node: TS.ClassLikeDeclaration | TS.InterfaceDeclaration, declNames: string[], moduleName: string): string | null {
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return null
			}

			let firstType = extendHeritageClause.types[0]
			if (!firstType || !ts.isExpressionWithTypeArguments(firstType)) {
				return null
			}

			let exp = firstType.expression

			let resolved = symbol.resolveImport(exp)
			if (resolved && declNames.includes(resolved.memberName)) {
				if (resolved.moduleName === moduleName) {
					return resolved.memberName
				}

				// Import relative module, try match file path.
				if (resolved.moduleName.startsWith('.')
					&& node.getSourceFile().fileName.includes('/' + moduleName + '/')
				) {
					return resolved.memberName
				}
			}

			let superDecl = symbol.resolveDeclaration(exp, ts.isClassDeclaration)
			if (superDecl) {
				return objectLike.getFirstDerivedOf(superDecl, declNames, moduleName)
			}

			return null
		},

		/** Whether property or method has specified modifier. */
		hasModifier(
			node: TS.PropertyDeclaration | TS.PropertySignature | TS.AccessorDeclaration | TS.MethodDeclaration | TS.MethodSignature,
			name: 'readonly' | 'static' | 'protected' | 'private' | 'public'
		): boolean {
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
	
		/** Returns the visibility modifier of given node. */
		getVisibilityModifier(
			node: TS.PropertyDeclaration | TS.PropertySignature | TS.AccessorDeclaration | TS.MethodDeclaration | TS.MethodSignature
		): 'public' | 'protected' | 'private' {
			if (objectLike.hasModifier(node, 'private') || node.name.getText().startsWith('$')) {
				return 'private'
			}
			else if (objectLike.hasModifier(node, 'protected')) {
				return 'protected'
			}
			else {
				return 'public'
			}
		},

		/** 
		 * Get name of an object like member.
		 * For a constructor function, it returns `constructor`
		 */
		getMemberName(node: TS.ClassElement | TS.TypeElement): string {
			if (ts.isConstructorDeclaration(node)) {
				return 'constructor'
			}
			else {
				return getFullText(node.name!)
			}
		},

		/** 
		 * Get one object like member declaration or signature by it's name.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getMember(
			node: ObjectLike,
			memberName: string,
			resolveChained: boolean
		): TS.ClassElement | TS.TypeElement | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === memberName) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get one property declaration or signature by it's name.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getProperty(
			node: ObjectLike,
			propertyName: string,
			resolveChained: boolean
		): TS.PropertyDeclaration | TS.PropertySignature | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === propertyName
					&& (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member))
				) {
					return member
				}
			}
			
			return undefined
		},

		/** 
		 * Get method declaration or signature by it's name.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getMethod(
			node: TS.ClassLikeDeclaration,
			methodName: string,
			resolveChained: boolean
		): TS.MethodDeclaration | TS.MethodSignature | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === methodName
					&& (ts.isMethodDeclaration(member) || ts.isMethodSignature(member))
				) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get constructor declaration or signature.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getConstructor(
			node: ObjectLike,
			resolveChained: boolean
		): TS.ConstructorDeclaration | TS.ConstructSignatureDeclaration | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (ts.isConstructorDeclaration(member) || ts.isConstructSignatureDeclaration(member)) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get constructor parameter list, even from super class.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getConstructorParameters(
			node: ObjectLike,
			resolveChained: boolean
		): TS.ParameterDeclaration[] | undefined {
			let constructor = objectLike.getConstructor(node, resolveChained)
			if (constructor) {
				return [...constructor.parameters]
			}

			return undefined
		},

		/** 
		 * Get the directly extended class or interface declarations.
		 * Note it can't be used to resolve unioned object literals.
		 */
		getExtends<T extends TS.ClassLikeDeclaration | TS.InterfaceDeclaration>(node: T):
			Array<T extends TS.ClassLikeDeclaration ? T : ObjectLike> | undefined
		{
			let extendExps = objectLike.getExtendExpressions(node)
			if (!extendExps) {
				return undefined
			}

			return extendExps.map(extendExp => {
				let exp = extendExp.expression
				let superDecl = symbol.resolveDeclaration(exp, isObjectLike)

				return superDecl as T extends TS.ClassLikeDeclaration ? T : ObjectLike
			}).filter(v => v)
		},

		/** Get extend expressions, the expressions which after `extends` keyword. */
		getExtendExpressions(node: TS.ClassLikeDeclaration | TS.InterfaceDeclaration):
			Array<TS.ExpressionWithTypeArguments> | undefined
		{
			let extendHeritageClause = node.heritageClauses?.find(hc => {
				return hc.token === ts.SyntaxKind.ExtendsKeyword
			})

			if (!extendHeritageClause) {
				return undefined
			}

			return [...extendHeritageClause.types]
		},

		/** 
		 * Resolve class or interface or object literal and all it's extended interfaces,
		 * and walk their members.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		*walkMembers(
			node: ObjectLike,
			resolveChained: boolean
		): Iterable<TS.ClassElement | TS.TypeElement> {
			if (resolveChained) {
				for (let chained of objectLike.walkChained(node)) {
					yield* chained.members
				}
			}
			else {
				yield* node.members
			}
		},

		/** 
		 * Resolve class or interface or object literal, and all it's extended interfaces,
		 * and all the object literal chain like:
		 * `interface A extends B {...}`
		 * `class A extends B implements C {...}`
		 * `type A = B & {...}`
		 * Will sort chained result by depth.
		 */
		*walkChained(node: ObjectLike): Iterable<ObjectLike> {
			let os = [...objectLike._resolveAndWalkChainedNodesRecursively(node, 0, new Set())]
			os.sort((a, b) => a.depth - b.depth)

			yield* os.map(o => o.o)
		},

		/** Resolves and iterates all chained nodes. */
		*_resolveAndWalkChainedNodesRecursively(
			node: TS.Node,
			depth: number,
			walked: Set<TS.Node>
		): Iterable<{o: ObjectLike, depth: number}> {
			if (walked.has(node)) {
				return
			}

			walked.add(node)
	
			// `interface A {...}`, `class A {...}`
			if (ts.isInterfaceDeclaration(node) || ts.isClassLike(node)) {
				yield {o: node, depth}

				let extended = objectLike.getExtends(node)
				if (extended) {
					for (let n of extended) {
						yield* objectLike._resolveAndWalkChainedNodesRecursively(n, depth + 1, walked)
					}
				}

				let sameNameResolved = symbol.resolveDeclarations(node, ts.isInterfaceDeclaration)
				if (sameNameResolved) {
					for (let res of sameNameResolved) {
						yield* objectLike._resolveAndWalkChainedNodesRecursively(res, depth, walked)
					}
				}
			}
		
			// `{...}`
			else if (ts.isTypeLiteralNode(node)) {
				yield {o: node, depth}
			}

			// `type B = A`, resolve A.
			else if (ts.isTypeAliasDeclaration(node)) {
				for (let decl of symbol.resolveTypeNodeDeclarations(node.type)) {
					yield* objectLike._resolveAndWalkChainedNodesRecursively(decl, depth + 1, walked)
				}
			}

			// Reference like `A`, resolve `A`.
			else if (ts.isTypeReferenceNode(node)) {
				for (let decl of symbol.resolveTypeNodeDeclarations(node)) {
					yield* objectLike._resolveAndWalkChainedNodesRecursively(decl, depth + 1, walked)
				}
			}

			// Resolve and continue.
			else {
				let resolved = symbol.resolveDeclarations(node)
				if (resolved) {
					for (let res of resolved) {
						yield* objectLike._resolveAndWalkChainedNodesRecursively(res, depth + 1, walked)
					}
				}
			}
		},
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

		/** 
		 * Test whether be all elements read access like:
		 *   - `[...a]`, or `{...a}`
		 *   - `Object.keys(a)`, `Object.values(a)`, `Object.entries(a)`
		 *   - `Object.assign(..., a)`
		 */
		isAllElementsReadAccess(node: TS.Node): boolean {

			// `[...a]`, or `{...a}`
			if (node.parent
				&& (ts.isSpreadElement(node.parent)
					|| ts.isSpreadAssignment(node.parent)
				)
				&& !assign.isWithinAssignmentTo(node)
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
		isAllElementsWriteAccess(node: TS.Node): boolean {
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
					if (cls.isImplementedOf(superDecl, 'MethodsObserved', '@pucelle/lupos')) {
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
				return propName === 'has' || propName === 'get' || propName === 'size'
			}
			else if (objName === 'Set') {
				return propName === 'has' || propName === 'size'
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
				let methodsHalfObservedImplement = implemented.find(im => getText(im.expression) === 'MethodsObserved')
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


	/** Property Assignment */
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



	/** To handle variable declarations. */
	const variable = {

		/** 
		 * Walk for all declared variable names from a variable declaration.
		 * `let [a, b]` = ... -> `[a, b]`
		 * `let {a, b}` = ... -> `[a, b]`
		 */
		*walkDeconstructedDeclarationItems(node: TS.VariableDeclaration): Iterable<DeconstructedVariableDeclarationItem> {
			return yield* variable._walkDeconstructedArgumentTypeItemsRecursively(node.name, node.initializer, [])
		},

		
		/** Get all declared variable name from a variable pattern. */
		*_walkDeconstructedArgumentTypeItemsRecursively(
			node: TS.BindingName | TS.BindingElement | TS.ObjectBindingPattern | TS.ArrayBindingPattern | TS.OmittedExpression,
			initializer: TS.Expression | undefined,
			keys: (string | number)[]
		): Iterable<DeconstructedVariableDeclarationItem> {
			if (ts.isOmittedExpression(node)) {
				return
			}

			// `let {a: b} = ...`
			// `let {b} = ...`
			if (ts.isObjectBindingPattern(node)) {
				let initMap: Map<string, TS.Expression> | null = null
				let restObj: TS.Expression | null = null

				if (initializer && ts.isObjectLiteralExpression(initializer)) {
					let o = variable._makeObjectLiteralMap(initializer)
					initMap = o.map
					restObj = o.rest.length > 0 ? o.rest[o.rest.length - 1] : null
				}

				for (let element of node.elements) {
	
					// `b`
					let key = getText(element.propertyName ?? element.name)

					if (initMap?.has(key)) {
						let subInitializer = initMap.get(key)!
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, subInitializer, [])
					}

					// May be defined in the rest part.
					// `let {b} = {...c}`
					else if (restObj) {
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, restObj, [key])
					}
					else {
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, initializer, [...keys, key])
					}
				}
			}

			// `let [a] = ...`
			else if (ts.isArrayBindingPattern(node)) {
				let initList: TS.Expression[] | null = null
				let initRest: TS.Expression | null = null

				if (initializer && ts.isArrayLiteralExpression(initializer)) {
					let o = variable.splitArrayLiteral(initializer)
					initList = o.list
					initRest = o.rest.length > 0 ? o.rest[o.rest.length - 1] : null
				}

				for (let i = 0; i < node.elements.length; i++) {
					let element = node.elements[i]

					if (initList && initList.length > i) {
						let subInitializer = initList[i]
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, subInitializer, [])
					}
					// May be defined in the rest part.
					// Don't know about which key to use, directly use '' to represent all keys.
					// `let [a, b] = [...c]`
					else if (initRest) {
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, initRest, [''])
					}
					else {
						yield* variable._walkDeconstructedArgumentTypeItemsRecursively(element, initializer, [...keys, i])
					}
				}
			}
			else if (ts.isBindingElement(node)) {
				yield* variable._walkDeconstructedArgumentTypeItemsRecursively(node.name, initializer, keys)
			}
			else if (ts.isIdentifier(node)) {
				yield {
					node,
					name: getFullText(node),
					initializer,
					keys,
				}
			}
		},

		/** Make full object key-value map. */
		_makeObjectLiteralMap(obj: TS.ObjectLiteralExpression): {map: Map<string, TS.Expression>, rest: TS.Expression[]} {
			let map: Map<string, TS.Expression> = new Map()
			let rest: TS.Expression[] = []

			variable._makeObjectLiteralMapRecursively(obj, map, rest)

			return {map, rest}
		},

		_makeObjectLiteralMapRecursively(obj: TS.ObjectLiteralExpression, map: Map<string, TS.Expression>, rest: TS.Expression[]) {
			for (let property of obj.properties) {
				if (ts.isPropertyAssignment(property)) {
					let key = getText(property.name)
					map.set(key, property.initializer)
				}
				else if (ts.isSpreadAssignment(property)) {
					if (ts.isObjectLiteralExpression(property.expression)) {
						variable._makeObjectLiteralMapRecursively(property.expression, map, rest)
					}
					else {
						rest.push(property.expression)
					}
				}
			}
		},

		/** 
		 * `[a, b, ... c]` -> `{list: [a, b], rest: [c]}`
		 * Split array items to a list and rest.
		 * `list` contains all items listed,
		 * while `rest` contains list of items that need to spread.
		 */
		splitArrayLiteral(arr: TS.ArrayLiteralExpression): {list: TS.Expression[], rest: TS.Expression[]} {
			let list: TS.Expression[] = []
			let rest: TS.Expression[] = []

			variable._splitArrayLiteralRecursively(arr, list, rest)

			return {list, rest}
		},

		_splitArrayLiteralRecursively(arr: TS.ArrayLiteralExpression, list: TS.Expression[], rest: TS.Expression[]) {
			for (let element of arr.elements) {
				if (ts.isSpreadElement(element)) {
					if (ts.isArrayLiteralExpression(element.expression)) {

						// Have spread, not push items to list.
						if (rest.length > 0) {
							variable._splitArrayLiteralRecursively(element.expression, [], rest)
						}
						else {
							variable._splitArrayLiteralRecursively(element.expression, list, rest)
						}
					}

					// Don't know how many elements to push, so not push to push.
					else {
						rest.push(element.expression)
					}
				}
				else {
					list.push(element)
				}
			}
		},
	}


	const parameter = {

		/** Get method or constructor  */
		getCallParameters(callExp: TS.CallExpression | TS.NewExpression): TS.NodeArray<TS.ParameterDeclaration> | undefined	{
			let decl: TS.FunctionLikeDeclaration | TS.MethodSignature | TS.MethodDeclaration | TS.ConstructorDeclaration | undefined
			if (ts.isCallExpression(callExp)) {
				decl = symbol.resolveDeclaration(callExp.expression, n => isFunctionLike(n) || isMethodLike(n))
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
		 * Walk for all mapped deconstructed argument expression and parameter type node.
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
						yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(arg.expression, param.type)
					}

					// Should be type of `param.type[]`, simply ignores it.
					else {
						yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(arg.expression, undefined)
					}
				}
				else {
					yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(arg, param?.type)
				}

				// `function f(...p)`
				if (param && !param.dotDotDotToken) {
					paramIndex++
					param = params.length > paramIndex ? params[0] : undefined
				}
			}
		},

		/** 
		 * Walk for all mapped deconstructed argument and parameter type node.
		 * `f({a})` ~ `function f(p: {a:T})` -> `{arg: a, type: T}`
		 * `f([a])` ~ `function f(p: [T])` -> `{arg: a, type: T}`
		 */
		*_walkDeconstructedArgumentTypeItemsRecursively(arg: TS.Expression, paramType: TS.TypeNode | undefined): Iterable<DeconstructedArgumentTypeItem> {

			//`f({a})` ~ `function f(p: {a:T})`
			if (ts.isObjectLiteralExpression(arg)) {
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
					yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(arg, type)
				}
	
				for (let restItem of rest) {
					yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(restItem, paramType)
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
						yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(item, type)
					}
				}

				// `T[]`
				else if (paramType && ts.isArrayTypeNode(paramType)) {
					for (let item of list) {
						yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(item, paramType.elementType)
					}
				}

				// `Array<T>`
				else if (paramType && ts.isTypeReferenceNode(paramType)) {
					let name = types.getTypeNodeReferenceName(paramType)?.text
					if ((name === 'Array' || name === 'ReadonlyArray')
						&& paramType.typeArguments?.length === 1
					) {
						for (let item of list) {
							yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(item, paramType.typeArguments[0])
						}
					}
				}

				for (let restItem of rest) {
					yield* parameter._walkDeconstructedArgumentTypeItemsRecursively(restItem, paramType)
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


	
	/** Type part */
	const types = {

		/** 
		 * Get type node of a node.
		 * Will firstly try to get type node when doing declaration,
		 * If can't find and `makeIfNotExist` is true, make a new type node, but it can't be resolved.
		 */
		getTypeNode(node: TS.Node, makeIfNotExist: boolean = false): TS.TypeNode | undefined {
			let typeNode: TS.TypeNode | undefined

			// Getting type of source file raise an error.
			if (ts.isSourceFile(node)) {
				return undefined
			}

			// `(...)`
			if (ts.isParenthesizedExpression(node)) {
				return types.getTypeNode(node.expression, makeIfNotExist)
			}

			// `...!`
			if (ts.isNonNullExpression(node)) {
				return types.getTypeNode(node.expression, makeIfNotExist)
			}

			// `class {a: Type = xxx}`
			if (access.isAccess(node)) {
				let resolved = symbol.resolveDeclaration(node)
				if (resolved) {
					return types.getTypeNode(resolved, makeIfNotExist)
				}
			}

			// `a`
			if (isVariableIdentifier(node)) {
				let resolved = symbol.resolveDeclaration(node)
				if (resolved) {
					return types.getTypeNode(resolved, makeIfNotExist)
				}
			}

			// `let a: Type`
			if (ts.isVariableDeclaration(node)) {
				typeNode = node.type

				if (!typeNode && node.initializer) {
					return types.getTypeNode(node.initializer, makeIfNotExist)
				}
			}

			// `(a: Type) => {}`
			if (ts.isParameter(node)) {
				typeNode = node.type

				if (!typeNode && node.initializer) {
					return types.getTypeNode(node.initializer, makeIfNotExist)
				}
			}

			// `a` of `a.b`
			if (isPropertyOrGetAccessor(node)) {
				typeNode = node.type
			}

			// `() => Type`
			else if (ts.isCallExpression(node)) {
				typeNode = symbol.resolveDeclaration(node.expression, isFunctionLike)?.type
			}

			// `(a as Type)`
			else if (ts.isAsExpression(node)) {
				typeNode = node.type
			}


			if (typeNode) {
				return typeNode
			}

			// This generated type node can't be resolved.
			if (makeIfNotExist) {
				return types.typeToTypeNode(types.typeOf(node))
			}

			return undefined
		},

		/** 
		 * Get type node of a type.
		 * Note the returned type node is newly created and not in source file,
		 * so they can't be resolved.
		 */
		typeToTypeNode(type: TS.Type): TS.TypeNode | undefined {
			return typeCheckerGetter().typeToTypeNode(type, undefined, undefined)
		},



		/** Get type of a node. */
		typeOf(node: TS.Node): TS.Type {
			return typeCheckerGetter().getTypeAtLocation(node)
		},

		/** Get type of a type node. */
		typeOfTypeNode(typeNode: TS.TypeNode): TS.Type | undefined {
			return typeCheckerGetter().getTypeFromTypeNode(typeNode)
		},
		
		/** 
		 * Get the reference name as an identifier of a type node, all type parameters are excluded.
		 * `A<B, C>` -> `A`
		 */
		getTypeNodeReferenceName(node: TS.TypeNode): TS.Identifier | undefined {
			if (!ts.isTypeReferenceNode(node)) {
				return undefined
			}

			let typeName = node.typeName
			if (!ts.isIdentifier(typeName)) {
				return undefined
			}

			return typeName
		},

		/** 
		 * Get the parameters of a type node.
		 * `A<B, C>` -> `[B, C]`
		 * `T[]` -> `T`
		 */
		getTypeNodeParameters(node: TS.TypeNode): TS.TypeNode[] | undefined {
			if (ts.isTypeReferenceNode(node)) {
				return node.typeArguments ? [...node.typeArguments] : undefined
			}
			else if (ts.isArrayTypeNode(node)) {
				return [node.elementType]
			}

			return undefined
		},

		/** Get full text of a type, all type parameters are included. */
		getTypeFullText(type: TS.Type): string {
			return typeCheckerGetter().typeToString(type)
		},

		/** Get the returned type of a method / function declaration. */
		getReturnTypeOfSignature(node: TS.SignatureDeclaration): TS.Type | undefined {
			let signature = typeCheckerGetter().getSignatureFromDeclaration(node)
			if (!signature) {
				return undefined
			}

			return signature.getReturnType()
		},

		/** Test whether type is object. */
		isObjectType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isObjectType(t))
			}

			return (type.flags & ts.TypeFlags.Object) > 0
		},

		/** Test whether type represents a value. */
		isValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isValueType(t))
			}

			return (type.flags & (
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
			return (type.flags & ts.TypeFlags.StringLike) > 0
		},

		/** Test whether type represents a number. */
		isNumericType(type: TS.Type): boolean {
			return (type.flags & ts.TypeFlags.NumberLike) > 0
		},

		/** Test whether type represents a boolean. */
		isBooleanType(type: TS.Type): boolean {
			return (type.flags & ts.TypeFlags.BooleanLike) > 0
		},

		/** Test whether type represents a value, and not null or undefined. */
		isNonNullableValueType(type: TS.Type): boolean {
			if (type.isUnionOrIntersection()) {
				return type.types.every(t => types.isNonNullableValueType(t))
			}

			return (type.flags & (
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
			return typeCheckerGetter().isArrayType(type)
		},

		/** Test whether type implements `Iterator`. */
		isIterableType(type: TS.Type): boolean {
			return !!type.getProperties().find(v => v.getName().startsWith('__@iterator'))
		},

		/** Test whether type is function. */
		isFunctionType(type: TS.Type): boolean {
			return type.getCallSignatures().length > 0
		},

		/** Test whether type is `any`. */
		isAnyType(type: TS.Type): boolean {
			return (type.flags & ts.TypeFlags.Any) > 0
		},

		/** 
		 * Whether `from` can be assigned to `to`, which means `from` is narrower.
		 * You should note `from` and `to` must to be generated by same type checker,
		 * and they must be existing type, can't be newly generated type by your.
		 */
		isAssignableTo(from: TS.Type, to: TS.Type): boolean {
			return typeCheckerGetter().isTypeAssignableTo(from, to)
		},

		/** 
		 * A simple test about whether `from` can be assigned to `to`, which means `from` is narrower.
		 * Can include generic type, which will be transformed to any.
		 */
		isAssignableToExtended(from: TS.Type, to: TS.Type) {
			if (types.isAssignableTo(from, to)) {
				return true
			}

			// About each object literal cost 8~10 depth.
			return theAssignableChecker.isAssignableTo(from, to, 40)
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
			// `readonly {...}` -> it may not 100% strict.
			if (access.isAccess(node)) {
				let exp = node.expression
				return types.isElementsReadonly(exp)
			}

			return false
		},

		/** Analysis whether the elements of specified node - normally an array, are readonly. */
		isElementsReadonly(node: TS.Node): boolean {
			// `a: Readonly<{...}>` -> `a` is elements readonly, not observe.
			// `a: ReadonlyArray<...>` -> `a` is elements readonly, not observe.
			// `readonly {...}` to convert type properties readonly -> this may not 100% strict.
	
			let typeNode = types.getTypeNode(node)
			if (!typeNode) {
				return false
			}

			if (ts.isTypeReferenceNode(typeNode)) {
				let name = types.getTypeNodeReferenceName(typeNode)?.text
				if (name === 'Readonly' || name === 'ReadonlyArray') {
					return true
				}
			}

			// Type was expanded and alias get removed.
			else if (ts.isTypeOperatorNode(typeNode)) {
				if (typeNode.operator === ts.SyntaxKind.ReadonlyKeyword) {
					return true
				}
			}

			return false
		},

		/** `'A' | 'B'` -> `['A', 'B']` */
		splitUnionTypeToStringList(type: TS.Type): string[] {
			if (type.isUnion()) {
				return type.types.map(t => types.splitUnionTypeToStringList(t)).flat()
			}
			else if (type.isStringLiteral()) {
				return [types.getTypeFullText(type).replace(/['"]/g, '')]
			}
			else {
				return []
			}
		},
	}


	/** 
	 * Symbol & Resolving
	 * Performance test: each resolving cost about 1~5 ms.
	 */
	const symbol = {

		/** Check whether node resolve result declared in typescript library. */
		isOfTypescriptLib(rawNode: TS.Node): boolean {

			// Like `this.el.style.display`
			let decl = symbol.resolveDeclaration(rawNode)
			if (!decl) {
				return false
			}

			let fileName = decl.getSourceFile().fileName
			return /\/typescript\/lib\//.test(fileName)
		},

		/** Test whether a node has an import name and located at a module. */
		isImportedFrom(node: TS.Node, memberName: string, moduleName: string): boolean {
			let nm = symbol.resolveImport(node)

			if (!nm || nm.memberName !== memberName) {
				return false
			}

			if (nm.moduleName === moduleName) {
				return true
			}
				
			// Import relative module, try match file path.
			if (nm.moduleName.startsWith('.')
				&& node.getSourceFile().fileName.includes('/' + moduleName + '/')
			) {
				return true
			}

			return false
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
			if (moduleName && moduleName.startsWith('.')) {
				let fileName = node.getSourceFile().fileName

				// In lupos tests.
				if (fileName.includes('/lupos/tests/src/')) {
					moduleName = '@pucelle/lupos'
				}

				// In lupos.js tests.
				if (fileName.includes('/lupos.js/tests/src/')
					|| fileName.includes('/lupos.js/out/')
				) {
					moduleName = '@pucelle/lupos.js'
				}
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
			let symbol = typeCheckerGetter().getSymbolAtLocation(node)

			// Get symbol from identifier.
			if (!symbol && !ts.isIdentifier(node)) {
				let identifier = getIdentifier(node)
				symbol = identifier ? typeCheckerGetter().getSymbolAtLocation(identifier) : undefined
			}

			// Resolve aliased symbols to it's original declared place.
			if (resolveAlias && symbol && (symbol.flags & ts.SymbolFlags.Alias) > 0) {
				symbol = typeCheckerGetter().getAliasedSymbol(symbol)
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
		resolveDeclaration<T extends TS.Declaration>(
			node: TS.Node,
			test?: (node: TS.Node) => node is T,
			resolveAlias: boolean = true
		): T | undefined {
			let decls = symbol.resolveDeclarations(node, undefined, resolveAlias)
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		},

		/** Resolves all declarations from a symbol. */
		resolveDeclarationsBySymbol<T extends TS.Declaration>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T[] | undefined {
			let decls = symbol.getDeclarations()
			if (test && decls) {
				decls = decls.filter(decl => test(decl))
			}

			return decls as T[] | undefined
		},

		/** Resolves the first declaration from a symbol. */
		resolveDeclarationBySymbol<T extends TS.Declaration>(symbol: TS.Symbol, test?: (node: TS.Node) => node is T): T | undefined {
			let decls = symbol.getDeclarations()
			return (test ? decls?.find(test) : decls?.[0]) as T | undefined
		},

		/** Resolve for chained object like: classes, interfaces, or object types. */
		*resolveChainedObjectLike(node: TS.Node): Iterable<ObjectLike> {
			let objectLikeDecls = symbol.resolveDeclarations(node, isObjectLike)
			if (!objectLikeDecls) {
				return undefined
			}

			for (let decl of objectLikeDecls) {
				yield* objectLike.walkChained(decl)
			}
		},
		
		/** 
		 * Resolve class declarations from type nodes like:
		 * - `typeof Cls`
		 * - `{new(): Cls}`
		 */
		*resolveInstanceDeclarations(fromTypeNode: TS.TypeNode): Iterable<TS.ClassDeclaration> {
			let typeNodes = symbol.resolveTypeNodeComponents(fromTypeNode)
			
			for (let typeNode of typeNodes) {
	
				// `typeof Com`, resolves `Com`.
				if (ts.isTypeQueryNode(typeNode)) {
					let decls = symbol.resolveDeclarations(typeNode.exprName, ts.isClassDeclaration)
					if (decls) {
						yield* decls
					}
				}
	
				// Resolve returned type of `{new()...}`.
				else {
					for (let decl of symbol.resolveTypeNodeDeclarations(typeNode)) {
						if (!isObjectLike(decl)) {
							continue
						}

						let newCons = objectLike.getConstructor(decl, true)
						if (!newCons) {
							continue
						}

						let newTypeNode = newCons.type
						if (!newTypeNode) {
							continue
						}
		
						// Try resolve all type parameters and get all possible.
						let instanceDecls = symbol.resolveTypeNodeDeclarations(newTypeNode)
						for (let instanceDecl of instanceDecls) {
							if (ts.isClassDeclaration(instanceDecl)) {
								yield instanceDecl
							}
						}
					}
				}
			}
		},

		/** 
		 * Resolve component parts of a type node.
		 * Normally will resolve an type literal, or a type reference.
		 * Note it can't resolve self-built types, or complex type expressions.
		 * like `extends`, `infer`, `{[key in ...]}`.
		 * 
		 * `A & B` -> `[A, B]`
		 * `A | B` -> `[A, B]`
		 * `Partial<A>` -> `[A]`
		 * `Omit<A, B>` -> `[A]`
		 */
		*resolveTypeNodeComponents(node: TS.TypeNode, maxDepth: number = 10): Iterable<TS.TypeNode> {
			if (maxDepth === 0) {
				return
			}

			if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
				for (let type of node.types) {
					yield* symbol.resolveTypeNodeComponents(type, maxDepth - 1)
				}
			}
			else if (node.kind === ts.SyntaxKind.NumberKeyword
				|| node.kind === ts.SyntaxKind.StringKeyword
				|| node.kind === ts.SyntaxKind.BooleanKeyword
				|| node.kind === ts.SyntaxKind.TrueKeyword
				|| node.kind === ts.SyntaxKind.FalseKeyword
				|| node.kind === ts.SyntaxKind.NullKeyword
				|| node.kind === ts.SyntaxKind.UndefinedKeyword
				|| ts.isLiteralTypeNode(node)	// 1, '1'
				|| ts.isTypeQueryNode(node)		// typeof A
				|| ts.isTypeLiteralNode(node)	// {...}
			) {
				yield node
			}
			else if (ts.isTypeReferenceNode(node)) {
				let name = getText(node.typeName)
				if (name === 'Partial'
					|| name === 'Required'
					|| name === 'Readonly'
					|| name === 'Pick'
					|| name === 'Omit'
					|| name === 'NonNullable'
				) {
					let firstType = node.typeArguments?.[0]
					if (firstType) {
						yield* symbol.resolveTypeNodeComponents(firstType, maxDepth - 1)
					}
				}

				else {
					yield node
				}
			}
		},

		/** 
		 * Resolve component parts of a type node.
		 * Normally will resolve an type literal, or a type reference.
		 * Note it can't resolve self-built types, or complex type expressions.
		 * like `extends`, `infer`, `{[key in ...]}`.
		 */
		*resolveTypeNodeDeclarations(node: TS.TypeNode, maxDepth: number = 10): Iterable<TS.Declaration | TS.TypeLiteralNode> {
			for (let com of symbol.resolveTypeNodeComponents(node)) {
				if (ts.isTypeLiteralNode(com)) {
					yield com
				}

				else if (ts.isTypeReferenceNode(com)) {
					let decls = symbol.resolveDeclarations(com)
					if (!decls) {
						continue
					}

					for (let decl of decls) {
						if (ts.isTypeAliasDeclaration(decl)) {
							yield* symbol.resolveTypeNodeDeclarations(decl.type, maxDepth - 1)
						}
						else {
							yield decl
						}
					}
				}
			}
		},

		/** 
		 * Resolve for the specified class or interface type parameters,
		 * which are the extended parameters of a final heritage class and a type parameter.
		 * E.g., want to resolve all event interfaces which finally passes to `EventFirer<E>`.
		 */
		*resolveSpecifiedTypeParameter(
			node: TS.ClassLikeDeclaration | TS.InterfaceDeclaration,
			finalHeritageName: string,
			finalHeritageTypeParameterIndex: number
		): Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode> {
			yield* symbol._resolveSpecifiedTypeParameterRecursively(node, [], finalHeritageName, finalHeritageTypeParameterIndex)
		},

		/** Resolve for the specified class or interface type parameters recursively. */
		*_resolveSpecifiedTypeParameterRecursively(
			node: TS.ClassLikeDeclaration | TS.InterfaceDeclaration,
			refedTypeParameters: ReadonlyArray<(TS.InterfaceDeclaration | TS.TypeLiteralNode)[]>,
			finalHeritageName: string,
			finalHeritageTypeParameterIndex: number
		): Iterable<TS.InterfaceDeclaration | TS.TypeLiteralNode> {

			// Assumes `A<B> extends C<D & B>`

			// `B`
			let selfParameters = node.typeParameters

			// `C<D & B>`
			let extendExps = objectLike.getExtendExpressions(node)
			if (!extendExps) {
				return
			}

			for (let extendExp of extendExps) {
				let extendedRefedTypeParameters: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[][] = []

				// `D & B`, may have no parameter, but super have.
				let extendParameters = extendExp.typeArguments
				if (extendParameters) {
					extendedRefedTypeParameters = symbol._remapRefedTypeParameters(refedTypeParameters, selfParameters, extendParameters)

					// `C`
					if (getFullText(extendExp.expression) === finalHeritageName) {
						yield* extendedRefedTypeParameters[finalHeritageTypeParameterIndex]
						continue
					}
				}

				// `C<D & B>`
				let exp = extendExp.expression
				let superDecl = symbol.resolveDeclaration(exp, isObjectLike)

				if (!superDecl || !(ts.isClassLike(superDecl) || ts.isInterfaceDeclaration(superDecl))) {
					continue
				}

				yield* symbol._resolveSpecifiedTypeParameterRecursively(superDecl, extendedRefedTypeParameters, finalHeritageName, finalHeritageTypeParameterIndex)
			}
		},

		/** Analysis type references, and remap type references from input parameters to super parameters. */
		_remapRefedTypeParameters(
			refed: ReadonlyArray<(TS.InterfaceDeclaration | TS.TypeLiteralNode)[]>,
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
				let resolved = symbol.resolveTypeNodeComponents(param)
				let paramRefed: (TS.InterfaceDeclaration | TS.TypeLiteralNode)[] = []

				for (let ref of resolved) {
					if (ts.isTypeReferenceNode(ref)) {
						let refName = getFullText(ref.typeName)

						// Use input parameter.
						if (selfMap.has(refName)) {
							paramRefed.push(...selfMap.get(refName)!)
						}

						// Use declared interface, or type literal.
						else {
							let resolved = [...symbol.resolveChainedObjectLike(ref)]
								.filter(n => ts.isInterfaceDeclaration(n) || ts.isTypeLiteralNode(n))

							paramRefed.push(...resolved)
						}
					}
				}

				remapped.push(paramRefed)
			}

			return remapped
		},
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


	/** Do packing and unpacking. */
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


	return {
		ts,
		factory: ts.factory,
		get typeChecker() {
			return typeCheckerGetter()
		},
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
		isMethodLike,
		isTypeDeclaration,
		isThis,
		isLiteralLike,
		isVoidReturning,
		isArray,
		isInstantlyRunFunction,
		walkInward,
		walkOutward,
		findInward,
		findOutward,
		findOutwardUntil,
		findAllInward,
		findInstantlyRunInward,
		getNodeAtOffset,
		getNodeDescription,
		deco,
		class: cls,
		objectLike,
		access,
		assign,
		variable,
		parameter,
		types,
		symbol,
		imports,
		pack,
	}
}