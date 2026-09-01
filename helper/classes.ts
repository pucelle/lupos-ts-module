import type TS from 'typescript'
import type {ObjectLike} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createClassHelpers(ts: typeof TS, core: HelperCore, context: HelperGroupContext) {
	const {isConstructorLike, isMethodLike} = core
	const {objectLike, symbol} = context

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
		 * Get method declaration or signature by it's name, and which will always have body.
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
		 * Get method declaration by it's name, and which will always have body.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getMethodDeclaration(
			node: TS.ClassLikeDeclaration,
			methodName: string,
			resolveChained: boolean
		): TS.MethodDeclaration | undefined {
			for (let member of objectLike.walkMembers(node, resolveChained)) {
				if (objectLike.getMemberName(member) === methodName
					&& ts.isMethodDeclaration(member)
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
				if (isConstructorLike(member)) {
					return member
				}
			}

			return undefined
		},

		/** 
		 * Get constructor declaration.
		 * `resolveChained`: specifies whether will look at extended classes or interfaces.
		 */
		getConstructorDeclaration(
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
						&& node.getSourceFile().fileName.includes('/' + moduleName.replace('@pucelle/', '') + '/')
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

	return {cls}
}
