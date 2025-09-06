import type * as TS from 'typescript'
import {Helper} from '../helper'
import {DiagnosticCode} from './codes'


/** It helps to modify all the diagnostics of a source file. */
export class DiagnosticModifier {
	
	readonly helper: Helper

	protected sourceFile!: TS.SourceFile
	protected added: TS.Diagnostic[] = []
	protected deleted: {start: number, code: number}[] = []

	constructor(helper: Helper) {
		this.helper = helper
	}

	/** Initialize before visit a new source file. */
	setSourceFile(sourceFile: TS.SourceFile) {
		this.sourceFile = sourceFile
	}

	/** Add a diagnostic object. */
	addDiagnostic(diag: TS.Diagnostic) {
		if (diag.start === undefined) {
			return
		}

		this.added.push(diag)
	}

	/** Add a diagnostic by parameters. */
	add(start: number, length: number, code: DiagnosticCode, message: string, category: TS.DiagnosticCategory = this.helper.ts.DiagnosticCategory.Error) {
		let diag: TS.Diagnostic = {
			category,
			code,
			messageText: message,
			file: this.sourceFile,
			start,
			length,
		}

		this.added.push(diag)
	}

	/** 
	 * Add usage of a import specifier node, delete it's diagnostic.
	 * It will try to extend node and test if diagnostic located on whole import statement.
	 */
	deleteNeverReadFromNodeExtended(node: TS.Node) {
		let ts = this.helper.ts

		// If all imported members are not read,
		// diagnostic located at import declaration.
		if (this.helper.ts.isImportSpecifier(node)) {
			let importDecl = node.parent.parent.parent

			if (this.helper.ts.isImportDeclaration(importDecl)) {
				this.deleteOfNode(importDecl, [DiagnosticCode.ValueNeverRead, DiagnosticCode.AllImportsUnused])

				// Note not return here, all imports, and specified
				// import diagnostics exist at the same time.
			}
		}

		// Diagnostic normally locate at declaration identifier.
		let decl = this.helper.getIdentifier(node) ?? node

		// Also delete same named interfaces for class declaration, must locate in same source file.
		if (ts.isClassDeclaration(node)) {
			let interfaces = this.helper.symbol.resolveDeclarations(decl, ts.isInterfaceDeclaration)
			if (interfaces) {
				let sameFileInterfaces = interfaces.filter(i => i.getSourceFile() === node.getSourceFile())
				
				for (let i of sameFileInterfaces) {
					let iName = this.helper.getIdentifier(i) ?? node
					this.deleteOfNode(iName, [DiagnosticCode.ValueNeverRead, DiagnosticCode.NeverRead])
				}
			}
		}

		this.deleteOfNode(decl, [DiagnosticCode.ValueNeverRead, DiagnosticCode.NeverRead])
	}

	/** For binding multiple parameters `:bind=${a, b}`. */
	deleteOfNode(node: TS.Node, codes: DiagnosticCode[]) {
		let start = node.getStart()

		for (let code of codes) {
			this.deleted.push({start, code})
		}
	}

	/** Get all diagnostics after modified. */
	getModified(startDiagnostics: TS.Diagnostic[]) {
		let diags = startDiagnostics.filter(diag => {
			return !this.deleted.find(item => item.start === diag.start && item.code === diag.code)
		})

		return [...diags, ...this.added]
	}
}
