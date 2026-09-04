import type TS from 'typescript'
import {createDecoratorHelpers} from './decorators'
import {createClassHelpers} from './classes'
import {createHelperGroupContext} from './context'
import {createASTHelpers} from './ast'
import {createTraversalHelpers} from './traversal'
import {createObjectLikeHelpers} from './object-like'
import {createAccessHelpers} from './access'
import {createAssignmentHelpers} from './assignment'
import {createVariableHelpers} from './variables'
import {createParameterHelpers} from './parameters'
import {createTypeHelpers} from './types'
import {createSymbolHelpers} from './symbols'
import {createImportHelpers} from './imports'
import {createPackHelpers} from './pack'


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

/** The helper type. */
export type Helper = ReturnType<typeof makeHelperOfContext>


/** Type of Helper functions. */
export const Helpers: WeakMap<TS.Program, Helper> = new WeakMap()


/** Help to get and check. */
export function helperOfContext(ts: typeof TS, program: TS.Program) {
	let helper = Helpers.get(program)
	if (!helper) {
		helper = makeHelperOfContext(ts, program)
		Helpers.set(program, helper)
	}

	return helper
}


/** Help to get and check. */
export function makeHelperOfContext(ts: typeof TS, program: TS.Program) {
	const context = createHelperGroupContext()
	const ast = createASTHelpers(ts, context)
	const traversal = createTraversalHelpers(ts, ast)

	const {
		isRaw, getFullText, getText, getIdentifier, isVariableIdentifier,
		isFunctionLike, isNonArrowFunctionLike, isObjectLike, isPropertyLike,
		isPropertyOrGetAccessor, isPropertyOrGetSetAccessor, isConstructorLike,
		isMethodLike, isTypeDeclaration, isThis, isLiteralLike, isVoidReturning,
		isArray, isInstantlyRunFunction,
	} = ast
	
	const {
		walkInward, walkOutward, findInward, findOutward, findOutwardUntil,
		findAllInward, findInstantlyRunInward, getNodeAtOffset, getNodeDescription,
	} = traversal

	const core = {
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
		walkInward,
		walkOutward,
		findInward,
		findOutward,
		findOutwardUntil,
		findAllInward,
		findInstantlyRunInward,
		getNodeAtOffset,
		getNodeDescription,
	}

	const {deco} = createDecoratorHelpers(ts, context)
	const {cls} = createClassHelpers(ts, core, context)
	const {objectLike} = createObjectLikeHelpers(ts, core, context)
	const {access} = createAccessHelpers(ts, core, context)
	const {assign} = createAssignmentHelpers(ts, context)
	const {variable} = createVariableHelpers(ts, core)
	const {parameter} = createParameterHelpers(ts, core, context)
	const {types} = createTypeHelpers(ts, program, core, context)
	const {symbol} = createSymbolHelpers(ts, core, context)
	const {imports} = createImportHelpers(ts)
	const {pack} = createPackHelpers(ts)

	Object.assign(context.cls, cls)
	Object.assign(context.objectLike, objectLike)
	Object.assign(context.access, access)
	Object.assign(context.assign, assign)
	Object.assign(context.variable, variable)
	Object.assign(context.parameter, parameter)
	Object.assign(context.types, types)
	Object.assign(context.symbol, symbol)


	let helper = {
		ts,
		factory: ts.factory,
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

	return helper
}
