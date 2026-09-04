import type TS from 'typescript'
import type {AccessNode} from './index'
import type {HelperCore, HelperGroupContext} from './context'


export function createTypeHelpers(ts: typeof TS, program: TS.Program, core: HelperCore, context: HelperGroupContext) {
	const {isVariableIdentifier, isFunctionLike, isPropertyLike, isPropertyOrGetAccessor} = core
	const {access, symbol} = context

	let typeChecker = program.getTypeChecker()
	let templateTypeQuery: ((node: TS.Node) => {type: TS.Type, checker: TS.TypeChecker} | undefined) | undefined

	/** Type part */
	const types = {

		/** Get newest type checker. */
		typeChecker: typeChecker,

		/** Optional semantic source for virtual template locals. Types stay with their owning checker. */
		setTemplateTypeQuery(query: typeof templateTypeQuery) {
			templateTypeQuery = query
		},

		/** Mirror construction must not recursively request its own semantic types. */
		withOriginalTypes<T>(callback: () => T): T {
			let query = templateTypeQuery
			templateTypeQuery = undefined

			try {
				return callback()
			}
			finally {
				templateTypeQuery = query
			}
		},

		/** 
		 * Get the mirrored template value type.
		 * If have no mirrored type, return original type.
		 */
		getMirroredTypeChecker(node: TS.Node): TS.TypeChecker {
			let resolved = templateTypeQuery?.(node)
			let checker = resolved?.checker ?? typeChecker
	
			return checker
		},

		/** 
		 * Get the mirrored template value type.
		 * If have no mirrored type, return original type.
		 */
		getMirroredType(node: TS.Node): TS.Type {
			let resolved = templateTypeQuery?.(node)
			let checker = resolved?.checker ?? typeChecker
			let type = resolved?.type ?? checker.getTypeAtLocation(node)

			return type
		},

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
		typeToTypeNode(type: TS.Type, checker: TS.TypeChecker = typeChecker): TS.TypeNode | undefined {
			return checker.typeToTypeNode(type, undefined, undefined)
		},



		/** Get type of a node. */
		typeOf(node: TS.Node, checker: TS.TypeChecker = typeChecker): TS.Type {
			return checker.getTypeAtLocation(node)
		},

		/** Get type of a type node. */
		typeOfTypeNode(typeNode: TS.TypeNode, checker: TS.TypeChecker = typeChecker): TS.Type | undefined {
			return checker.getTypeFromTypeNode(typeNode)
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
		getTypeFullText(type: TS.Type, checker: TS.TypeChecker = typeChecker): string {
			return checker.typeToString(type)
		},

		/** Get the returned type of a method / function declaration. */
		getReturnTypeOfSignature(node: TS.SignatureDeclaration, checker: TS.TypeChecker = typeChecker): TS.Type | undefined {
			let signature = checker.getSignatureFromDeclaration(node)
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

		/** 
		 * Test whether type represents a value.
		 * Note it only detect a direct boolean type, can't check type extends value type.
		 */
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

		/** 
		 * Test whether type represents a string.
		 * Note it only detect a direct boolean type, can't check type extends string.
		 */
		isStringType(type: TS.Type): boolean {
			return (type.flags & ts.TypeFlags.StringLike) > 0
		},

		/** 
		 * Test whether type represents a number.
		 * Note it only detect a direct boolean type, can't check type extends number.
		 */
		isNumericType(type: TS.Type): boolean {
			return (type.flags & ts.TypeFlags.NumberLike) > 0
		},

		/** 
		 * Test whether type represents a boolean.
		 * Note it only detect a direct boolean type, can't check type extends boolean.
		 */
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
		isArrayType(type: TS.Type, checker: TS.TypeChecker = typeChecker): boolean {
			return checker.isArrayType(type)
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

		/** Analysis whether the property declaration resolve from a node is readonly. */
		isReadonly(node: TS.Node): boolean {

			// `class A{readonly p}` -> `p` and `this['p']` are readonly.
			// `interface A{readonly p}` -> `p` and `this['p']` are readonly.
			let propDecl = symbol.resolveDeclaration(node, isPropertyLike) as TS.PropertySignature | TS.PropertyDeclaration | undefined
			if (propDecl && propDecl.modifiers?.find((m: TS.ModifierLike) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
				return true
			}

			// `a: Readonly<{p: 1}>` -> `a.p` is readonly, not observe.
			// `a: ReadonlyArray<...>` -> `a.?` is readonly, not observe.
			// `readonly {...}` -> it may not 100% strict.
			if (access.isAccess(node)) {
				let exp = (node as AccessNode).expression
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

	return {types}
}
