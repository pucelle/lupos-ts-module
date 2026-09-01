import type TS from 'typescript'
import type {HelperGroupContext} from './context'


export function createDecoratorHelpers(ts: typeof TS, context: HelperGroupContext) {
	const {symbol} = context

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

	return {deco}
}
