import type TS from 'typescript'
import type {ObjectLike, ResolvedImportNames} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createSymbolHelpers(ts: typeof TS, core: HelperCore, context: HelperGroupContext) {
	const {getFullText, getText, getIdentifier, isObjectLike} = core
	const {objectLike, types} = context
	const UnaliasedSymbolCache: WeakMap<TS.Node, TS.Symbol | null> = new WeakMap()
	const AliasedSymbolCache: WeakMap<TS.Node, TS.Symbol | null> = new WeakMap()
	const ResolvedImportCache: WeakMap<TS.Node, ResolvedImportNames | null> = new WeakMap()

	/** Symbol and declaration resolution helpers. */
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
				&& node.getSourceFile().fileName.includes('/' + moduleName.replace('@pucelle/', '') + '/')
			) {
				return true
			}

			return false
		},

		/** Resolve the import name and module. */
		resolveImport(node: TS.Node): ResolvedImportNames | undefined {
			let cached = ResolvedImportCache.get(node)
			if (cached !== undefined) {
				return cached ?? undefined
			}

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

			// Compile codes within `lupos.html` library.
			if (moduleName && moduleName.startsWith('.')) {
				let fileName = node.getSourceFile().fileName

				// In lupos tests.
				if (fileName.includes('/lupos/tests/src/')) {
					moduleName = 'lupos'
				}

				// In lupos.html tests.
				if (fileName.includes('/lupos.html/tests/src/')
					|| fileName.includes('/lupos.html/out/')
				) {
					moduleName = 'lupos.html'
				}
			}

			let resolved = moduleName !== null && memberName !== null
				? {
					memberName,
					moduleName,
				}
				: null

			ResolvedImportCache.set(node, resolved)
			return resolved ?? undefined
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
			let cache = resolveAlias ? AliasedSymbolCache : UnaliasedSymbolCache
			let cached = cache.get(node)
			if (cached !== undefined) {
				return cached ?? undefined
			}

			let resolved = types.typeChecker.getSymbolAtLocation(node)

			// Get symbol from identifier.
			if (!resolved && !ts.isIdentifier(node)) {
				let identifier = getIdentifier(node)
				resolved = identifier ? types.typeChecker.getSymbolAtLocation(identifier) : undefined
			}

			// Resolve aliased symbols to it's original declared place.
			if (resolveAlias && resolved && (resolved.flags & ts.SymbolFlags.Alias) > 0) {
				resolved = types.typeChecker.getAliasedSymbol(resolved)
			}

			cache.set(node, resolved ?? null)
			return resolved
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
		 * Resolve class declarations deeply from a base declaration.
		 * 
		 * - `class {...}`
		 * - `let node = new Class()`
		 * - `let node: Class = ...`
		 * - `let node = xxx as Class`
		 * - `let node = resolveRegistry<ItemSourceBundle>('ItemSourceBundle')`
		 */
		*resolveDeepDeclClassDeclarations(decl: TS.Declaration): Iterable<TS.ClassDeclaration> {

			// Already an class declaration.
			if (ts.isClassDeclaration(decl)) {
				yield decl
				return
			}

			// Resolve from variable declaration.
			if (ts.isVariableDeclaration(decl)) {
				if (decl.type) {
					yield* symbol._resolveTypeNodeClassDeclarations(decl.type)
					return
				}
				else if (decl.initializer) {
					let decls = [...symbol.resolveDeepExpClassDeclarations(decl.initializer)]
					if (decls.length > 0) {
						yield* decls
					}
				}
			}

			// Directly resolve, like from `ImportSpecifier`.
			let decls = symbol.resolveDeclarations(decl, ts.isClassDeclaration)
			if (decls) {
				yield* decls
			}
		},

		/** Resolve class declarations deeply from an expression. */
		*resolveDeepExpClassDeclarations(exp: TS.Expression): Iterable<TS.ClassDeclaration> {

			// Resolve from `as Type`.
			if (ts.isAsExpression(exp)) {
				yield* symbol._resolveTypeNodeClassDeclarations(exp.type)
			}

			// Resolve from the `new Class`.
			else if (ts.isNewExpression(exp)) {
				yield* symbol.resolveDeepExpClassDeclarations(exp.expression)
			}

			else {

				// Directly resolve.
				let decls = symbol.resolveDeclarations(exp, ts.isClassDeclaration)
				if (decls && decls.length > 0) {
					yield* decls
				}

				// Resolve from type node, not always work.
				else {
					let typeNode = types.getTypeNode(exp, false)
					if (typeNode) {
						yield* symbol._resolveTypeNodeClassDeclarations(typeNode)
						return
					}
				}
			}
		},
		
		/** 
		 * Resolve class declarations from type nodes like:
		 * - `typeof Cls`
		 * - `{new(): Cls}`
		 */
		*_resolveTypeNodeClassDeclarations(fromTypeNode: TS.TypeNode): Iterable<TS.ClassDeclaration> {
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

	return {symbol}
}
