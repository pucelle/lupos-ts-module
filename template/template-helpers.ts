import type * as TS from 'typescript'
import {Helper} from '../helper'
import {TemplateSlotPlaceholder} from '../html-syntax'
import {ScopeTree} from '../scope'


export namespace TemplateHelpers {

	/** Try resolve component declarations. */
	export function *resolveComponentDeclarations(
		tagName: string,
		node: TS.Node,
		valueNodes: TS.Node[],
		scopeTree: ScopeTree,
		helper: Helper
	): Iterable<TS.ClassLikeDeclaration> {
		let isNamedComponent = TemplateSlotPlaceholder.isNamedComponent(tagName)
		let isDynamicComponent = TemplateSlotPlaceholder.isDynamicComponent(tagName)

		if (!isNamedComponent && !isDynamicComponent) {
			return
		}

		// Resolve class declarations directly.
		if (isNamedComponent) {
			let ref = scopeTree.getDeclarationOrReferenceByName(tagName, node)
			if (!ref) {
				return
			}

			let decls = helper.symbol.resolveDeclarations(ref, helper.ts.isClassDeclaration)
			if (decls) {
				yield* decls
			}
		}

		// Resolve instance type of constructor interface.
		else {
			let ref = valueNodes[TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)!]
			let decls = helper.symbol.resolveDeclarations(ref, helper.ts.isClassDeclaration)
			if (decls && decls.length > 0) {
				yield* decls
				return
			}

			// Note made type node can't be resolved.
			let typeNode = helper.types.getOrMakeTypeNode(ref)
			if (typeNode) {
				yield* helper.symbol.resolveInstanceDeclarations(typeNode)
				return
			}
		}
	}
}