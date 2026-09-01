import type TS from 'typescript'
import type {ObjectLike} from './index'


export interface HelperCore {
	getFullText(node: TS.Node): string
	getText(node: TS.Node): string
	getIdentifier(node: TS.Node): TS.Identifier | undefined
	isVariableIdentifier(node: TS.Node): node is TS.Identifier
	isFunctionLike(node: TS.Node): node is TS.FunctionLikeDeclaration
	isObjectLike(node: TS.Node): node is ObjectLike
	isPropertyLike(node: TS.Node): node is TS.PropertySignature | TS.PropertyDeclaration
	isPropertyOrGetAccessor(node: TS.Node): node is TS.PropertySignature | TS.PropertyDeclaration | TS.GetAccessorDeclaration
	isConstructorLike(node: TS.Node): node is TS.ConstructorDeclaration | TS.ConstructSignatureDeclaration
	isMethodLike(node: TS.Node): node is TS.MethodSignature | TS.MethodDeclaration
}


export interface HelperGroupContext {
	cls: any
	objectLike: any
	access: any
	assign: any
	variable: any
	parameter: any
	types: any
	symbol: any
}


export function createHelperGroupContext(): HelperGroupContext {
	return {
		cls: {},
		objectLike: {},
		access: {},
		assign: {},
		variable: {},
		parameter: {},
		types: {},
		symbol: {},
	}
}
