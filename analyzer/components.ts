import type * as TS from 'typescript'
import {LuposComponent, LuposEvent, LuposProperty} from './types'
import {Helper} from '../helper'


/** Walk and Discover all lupos components from a given node and it's children. */
export function analyzeLuposComponents(sourceFile: TS.SourceFile, helper: Helper): LuposComponent[] {
	let components: LuposComponent[] = []

	// Only visit root class declarations.
	helper.ts.forEachChild(sourceFile, (node: TS.Node) => {
		if ((helper.ts.isClassDeclaration(node))
			&& node.name
			&& helper.class.isDerivedOf(node, 'Component', '@pucelle/lupos.js')
		) {
			components.push(createLuposComponent(node, helper))
		}
	})

	return components
}


/** Can use it to create custom object. */
export function createLuposComponent(node: TS.ClassDeclaration | TS.InterfaceDeclaration, helper: Helper): LuposComponent {
	let properties: Record<string, LuposProperty> = {}
	let events: Record<string, LuposEvent> = {}
	let slotElements: Record<string, LuposProperty> = {}

	// Like mixin interface.
	let interfaceDecls = helper.symbol.resolveDeclarations(node.name!, helper.ts.isInterfaceDeclaration) ?? []

	for (let interfaceDecl of interfaceDecls) {
		for (let decl of helper.class.walkSelfAndSuper(interfaceDecl)) {

			// Here ignores events declaration, which needs to be re-declared in class declaration.

			for (let property of analyzeLuposComponentProperties(decl, helper)) {
				properties[property.name] = property
			}
		
			for (let slot of analyzeLuposComponentSubProperties(decl, 'slotElements', helper) || []) {
				slotElements[slot.name] = slot
			}
		}
	}

	for (let event of analyzeLuposComponentEvents(node, helper)) {
		events[event.name] = event
	}

	for (let property of analyzeLuposComponentProperties(node, helper)) {
		properties[property.name] = property
	}

	for (let slot of analyzeLuposComponentSubProperties(node, 'slotElements', helper) || []) {
		slotElements[slot.name] = slot
	}

	return {
		name: helper.getText(node.name!),
		nameNode: node.name!,
		declaration: node,
		description: helper.getNodeDescription(node) || '',
		sourceFile: node.getSourceFile(),
		properties,
		events,
		slotElements,
	}
}


/** Analyze event interfaces from `extends Component<XXXEvents>` of either a class or a interface declaration. */
export function analyzeLuposComponentEvents(decl: TS.ClassDeclaration | TS.InterfaceDeclaration, helper: Helper): LuposEvent[] {
	let events: LuposEvent[] = []

	// Resolve all the event interface items.
	let interfaceDecls = helper.symbol.resolveExtendedInterfaceLikeTypeParameters(decl, 'EventFirer', 0)

	for (let decl of interfaceDecls) {
		for (let member of decl.members) {
			if (!helper.ts.isPropertySignature(member)) {
				continue
			}

			if (!member.name) {
				continue
			}

			events.push({
				name: helper.getText(member.name),
				nameNode: member.name,
				description: helper.getNodeDescription(member) || '',
				sourceFile: decl.getSourceFile(),
			})
		}
	}

	return events
}



/** Analyze public properties from class. */
export function analyzeLuposComponentProperties(decl: TS.ClassLikeDeclaration | TS.InterfaceDeclaration, helper: Helper): LuposProperty[] {
	let properties: LuposProperty[] = []

	for (let member of decl.members) {
		let property = analyzeLuposComponentMemberProperty(member, helper)
		if (property) {
			properties.push(property)
		}
	}

	return properties
}


/** Matches class properties from child nodes of a class declaration node. */
function analyzeLuposComponentMemberProperty(decl: TS.ClassElement | TS.TypeElement, helper: Helper): LuposProperty | null {

	// `class {property = value, property: type = value}`, property must be public and not readonly.
	if (helper.ts.isPropertyDeclaration(decl) || helper.ts.isPropertySignature(decl)) {
		let bePublic = helper.class.getVisibility(decl) === 'public'
		let beStatic = helper.class.hasModifier(decl, 'static')

		if (!beStatic) {
			return {
				name: helper.getText(decl.name),
				nameNode: decl,
				description: helper.getNodeDescription(decl) || '',
				sourceFile: decl.getSourceFile(),
				public: bePublic,
			}
		}
	}

	// `class {set property(value)}`
	else if (helper.ts.isSetAccessor(decl)) {
		let bePublic = helper.class.getVisibility(decl) === 'public'
		let beStatic = helper.class.hasModifier(decl, 'static')

		if (!beStatic) {
			return{
				name: helper.getText(decl.name),
				nameNode: decl,
				description: helper.getNodeDescription(decl) || '',
				sourceFile: decl.getSourceFile(),
				public: bePublic,
			}
		}
	}

	return null
}


/** Analyze sub properties from class, like `refs` or slots. */
export function analyzeLuposComponentSubProperties(
	component: TS.ClassLikeDeclaration | TS.InterfaceDeclaration,
	propertyName: string,
	helper: Helper
): LuposProperty[] | null {
	let properties: LuposProperty[] | null = null
	let member = helper.class.getProperty(component, propertyName)
	
	if (!member) {
		return null
	}

	let typeNode = member.getChildren().find(child => helper.ts.isTypeNode(child))
	if (!typeNode) {
		return null
	}
	
	// refs: {...}
	if (!helper.ts.isTypeLiteralNode(typeNode)) {
		return null
	}

	properties = []

	for (let typeMember of typeNode.members) {
		if (!helper.ts.isPropertySignature(typeMember)) {
			continue
		}
		
		let property: LuposProperty = {
			name: helper.getText(typeMember.name),
			nameNode: typeMember,
			description: helper.getNodeDescription(typeMember) || '',
			sourceFile: typeMember.getSourceFile(),
			public: true,
		}

		properties.push(property)
	}

	return properties
}
