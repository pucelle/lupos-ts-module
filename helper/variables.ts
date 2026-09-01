import type TS from 'typescript'
import type {DeconstructedVariableDeclarationItem} from './index'
import type {HelperCore} from './context'


export function createVariableHelpers(ts: typeof TS, core: HelperCore) {
	const {getFullText, getText} = core

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

	return {variable}
}
