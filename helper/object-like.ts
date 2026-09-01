import type TS from 'typescript'
import type {ObjectLike} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createObjectLikeHelpers(ts: typeof TS, core: HelperCore, context: HelperGroupContext) {
	const {getFullText, isObjectLike} = core
	const {symbol} = context

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
					&& node.getSourceFile().fileName.includes('/' + moduleName.replace('@pucelle/', '') + '/')
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
			name: 'readonly' | 'static' | 'protected' | 'private' | 'public' | 'declare'
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
				else if (modifier.kind === ts.SyntaxKind.DeclareKeyword && name === 'declare') {
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

	return {objectLike}
}
