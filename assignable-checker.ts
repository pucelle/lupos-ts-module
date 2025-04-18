import type * as TS from 'typescript'


/** Help to get and check. */
export function assignableChecker(ts: typeof TS, typeCheckerGetter: () => TS.TypeChecker) {

	/** All value types. */
	const ValueTypeFlags = ts.TypeFlags.StringLike
		| ts.TypeFlags.NumberLike
		| ts.TypeFlags.BigIntLike
		| ts.TypeFlags.BooleanLike
		| ts.TypeFlags.ESSymbolLike
		| ts.TypeFlags.Undefined
		| ts.TypeFlags.Null
		

	/** Normally use this to test generic assignable. */
	function isAssignableTo(from: TS.Type, to: TS.Type, depth: number): boolean {
		if (from === to) {
			return true
		}

		if (depth <= 0) {
			return false
		}

		/** `any` can assign to any. */
		if (from.flags & ts.TypeFlags.Any) {
			return true
		}

		/** `never` can assign to nothing. */
		if (from.flags & ts.TypeFlags.Never) {
			return false
		}

		// Generic type works as any.
		if (isGenericType(from) || isGenericType(to)) {
			return true
		}

		// Value types, check whether they have intersection with value type flags.
		if (from.flags & ValueTypeFlags && to.flags & ValueTypeFlags) {
			return isValueTypeAssignable(from, to)
		}

		if (from.isUnionOrIntersection()) {
			return (from as TS.UnionOrIntersectionType).types.every(ft => {
				return isAssignableTo(ft, to, depth - 1)
			})
		}

		if (to.isUnion()) {
			return (to as TS.UnionType).types.some(tt => {
				return isAssignableTo(from, tt, depth - 1)
			})
		}

		// Recently can't rightly handle intersection of 'to'.
		if (to.isIntersection()) {
			return (to as TS.IntersectionType).types.every(tt => {
				return isAssignableTo(from, tt, depth - 1)
			})
		}

		// If one is conditional, if it's true or false brach match, then match.
		if (from.flags & ts.TypeFlags.Conditional) {
			return isConditionalTypeMatch(from as TS.ConditionalType, to, depth - 1)
		}

		if (to.flags & ts.TypeFlags.Conditional) {
			return isConditionalTypeMatch(to as TS.ConditionalType, from, depth - 1)
		}

		// Compare object types.
		if (from.flags & ts.TypeFlags.Object) {
			if (to.flags & ts.TypeFlags.Object) {
				return isObjectTypeAssignableTo(from as TS.ObjectType, to as TS.ObjectType, depth - 1)
			}
			else {
				return false
			}
		}

		return false
	}

	/** Value types, check whether they have intersection with value type flags. */
	function isValueTypeAssignable(from: TS.Type, to: TS.Type) {
		if (from.flags & ts.TypeFlags.StringLike && to.flags & ts.TypeFlags.StringLike) {

			// One problem here is when having to type restrict, 'a' will be inferred as string, not 'a' literal.
			if (from.flags & ts.TypeFlags.StringLiteral && to.flags & ts.TypeFlags.StringLiteral) {
				return (from as TS.StringLiteralType).value === (to as TS.StringLiteralType).value
			}

			if (to.flags & ts.TypeFlags.String) {
				return true
			}

			return true
		}

		if (from.flags & ts.TypeFlags.NumberLike && to.flags & ts.TypeFlags.NumberLike) {
			if (from.flags & ts.TypeFlags.NumberLiteral && to.flags & ts.TypeFlags.NumberLiteral) {
				return (from as TS.NumberLiteralType).value === (to as TS.NumberLiteralType).value
			}

			if (to.flags & ts.TypeFlags.Number) {
				return true
			}

			return true
		}

		if (from.flags & ts.TypeFlags.BooleanLike && to.flags & ts.TypeFlags.BooleanLike) {
			if (from.flags & ts.TypeFlags.BooleanLiteral && to.flags & ts.TypeFlags.BooleanLiteral) {
				return from === to
			}

			if (to.flags & ts.TypeFlags.Boolean) {
				return true
			}

			return true
		}

		if (from.flags & ts.TypeFlags.ESSymbolLike && to.flags & ts.TypeFlags.ESSymbolLike) {
			return true
		}

		return (from.flags & to.flags & ValueTypeFlags) > 0
	}

	function isGenericType(from: TS.Type): boolean {
		return (from.flags & ts.TypeFlags.TypeParameter) > 0
	}

	function isConditionalTypeMatch(conditional: TS.ConditionalType, type: TS.Type, depth: number): boolean {
		let trueType = conditional.resolvedTrueType
			let falseType = conditional.resolvedFalseType

		return !!trueType && isAssignableTo(type, trueType, depth - 1)
			|| !!falseType && isAssignableTo(type, falseType, depth - 1)
	}

	function isObjectTypeAssignableTo(from: TS.ObjectType, to: TS.ObjectType, depth: number): boolean {

		// Compare functions, they are normally also Anonymous, so must check this before checking Anonymous.
		if (from.getCallSignatures().length > 0) {
			if (to.getCallSignatures().length === 0) {
				return false
			}

			return isCallTypeAssignableTo(from as TS.ObjectType, to as TS.ObjectType, depth - 1)
		}

		// Compare type reference
		if (from.objectFlags & ts.ObjectFlags.Reference) {
			if (to.objectFlags & ts.ObjectFlags.Reference) {
				return isReferenceTypeAssignableTo(from as TS.TypeReference, to as TS.TypeReference, depth - 1)
			}
		}

		// Compare instantiated type, like `ListItem<T>`.
		if (from.objectFlags & ts.ObjectFlags.Instantiated) {
			if (to.objectFlags & ts.ObjectFlags.Instantiated) {
				return isInstantiatedTypeAssignableTo(from, to, depth - 1)
			}
		}

		// Compare object members.
		return isObjectMembersAssignableTo(from, to, depth - 1)
	}

	function isReferenceTypeAssignableTo(from: TS.TypeReference, to: TS.TypeReference, depth: number): boolean {
		let fromTarget = from.target
		let toTarget = to.target

		if ((fromTarget !== from || toTarget !== to)
			&& !isAssignableTo(fromTarget, toTarget, depth - 1)
		) {
			return false
		}

		let fromArguments = from.typeArguments ?? []
		let toArguments = to.typeArguments ?? []

		if (!isTypeArgumentsAssignableTo(fromArguments, toArguments, depth - 1)) {
			return false
		}

		// Not validate generic parameter at `aliasTypeArguments`, equals treating them as any.

		return true
	}

	function isInstantiatedTypeAssignableTo(from: TS.ObjectType, to: TS.ObjectType, depth: number): boolean {
		let fromTarget = (from as any).target
		let toTarget = (to as any).target

		if (!fromTarget || !toTarget) {
			return false
		}

		if ((fromTarget !== from || toTarget !== to)
			&& !isAssignableTo(fromTarget, toTarget, depth - 1)
		) {
			return false
		}

		// Not validate generic parameter at `aliasTypeArguments`, equals treating them as any.

		return true
	}

	function isTypeArgumentsAssignableTo(from: readonly TS.Type[] | undefined, to: readonly TS.Type[] | undefined, depth: number) {

		// Can provide fewer arguments for 'from'.
		let fromLength = from ? from.length : 0
		let toLength = to ? to.length : 0

		if (fromLength === 0) {
			return true
		}

		if (fromLength > toLength) {
			return false
		}

		for (let i = 0; i < from!.length; i++) {
			if (!isAssignableTo(from![i], to![i], depth - 1)) {
				return false
			}
		}

		return true
	}

	function isCallTypeAssignableTo(from: TS.ObjectType, to: TS.ObjectType, depth: number): boolean {
		let fromSignature = from.getCallSignatures()
		let toSignature = to.getCallSignatures()

		for (let fromS of fromSignature) {
			for (let toS of toSignature) {
				if (isSignatureAssignableTo(fromS, toS, depth - 1)) {
					return true
				}
			}
		}

		return false
	}

	function isSignatureAssignableTo(from: TS.Signature, to: TS.Signature, depth: number): boolean {
		let checker = typeCheckerGetter()

		// let fromThis = from.thisParameter ? [checker.getTypeOfSymbol(from.thisParameter)] : undefined
		// let toThis = to.thisParameter ? [checker.getTypeOfSymbol(to.thisParameter)] : undefined

		// if (!isTypeParametersAssignableTo(fromThis, toThis, depth - 1)) {
		// 	return false
		// }

		let fromParameters = from.parameters ? from.parameters.map(p => checker.getTypeOfSymbol(p)) : undefined
		let toParameters = to.parameters ? to.parameters.map(p => checker.getTypeOfSymbol(p)) : undefined

		if (!isParameterTypesAssignableTo(fromParameters, toParameters, depth - 1)) {
			return false
		}

		let fromReturned = from.getReturnType()
		let toReturned = to.getReturnType()

		// Ant returning can assign to void returning.
		if (toReturned.flags & ts.TypeFlags.Void) {
			return true
		}

		if (!isAssignableTo(fromReturned, toReturned, depth - 1)) {
			return false
		}

		return true
	}

	function isParameterTypesAssignableTo(from: readonly TS.Type[] | undefined, to: readonly TS.Type[] | undefined, depth: number) {

		// Can provide fewer parameters for 'from'.
		let fromLength = from ? from.length : 0
		let toLength = to ? to.length : 0

		if (fromLength === 0) {
			return true
		}

		if (fromLength > toLength) {
			return false
		}

		for (let i = 0; i < from!.length; i++) {

			// If 'from' exists, it must be wider.
			if (!isAssignableTo(to![i], from![i], depth - 1)) {
				return false
			}
		}

		return true
	}

	function isObjectMembersAssignableTo(from: TS.ObjectType, to: TS.ObjectType, depth: number) {
		let checker = typeCheckerGetter()
		let fromMembers = checker.getPropertiesOfType(from)
		let toMembers = checker.getPropertiesOfType(to)
		let fromMap = new Map(fromMembers.map(m => [m.escapedName, m]))

		for (let toMember of toMembers) {
			let toType = checker.getTypeOfSymbol(toMember)
			let fromMember = fromMap.get(toMember.escapedName)

			if (!fromMember) {
				if (toMember.flags & ts.SymbolFlags.Optional) {
					continue
				}

				return false
			}

			let fromType = checker.getTypeOfSymbol(fromMember)

			if (!isAssignableTo(fromType, toType, depth - 1)) {
				return false
			}
		}

		return true
	}

	return {
		isAssignableTo,
	}
}