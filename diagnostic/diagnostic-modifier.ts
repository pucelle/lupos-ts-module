import type * as TS from 'typescript'
import {Helper} from '../helper'
import {DiagnosticCode} from './codes'


/** It helps to modify all the diagnostics of a source file. */
export class DiagnosticModifier {

	readonly helper: Helper

	protected sourceFile!: TS.SourceFile
	protected added: TS.Diagnostic[] = []
	protected deleted: {start: number, code: number}[] = []
	protected potentialAllImportsUnUsed: TS.ImportDeclaration[] = []

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

	/** Add a diagnostic by parameters. */
	getByNode(node: TS.Node, code: DiagnosticCode, message: string, category: TS.DiagnosticCategory = this.helper.ts.DiagnosticCategory.Error) {
		let start = node.getStart()
		let length = node.getEnd() - start

		let diag: TS.Diagnostic = {
			category,
			code,
			messageText: message,
			file: this.sourceFile,
			start,
			length,
		}

		return diag
	}

	/** Test whether has added a specified diagnostic. */
	protected hasAdded(start: number, code: DiagnosticCode): boolean {
		return !!this.added.find(item => item.start === start && item.code === code)
	}

	/** Test whether has deleted a specified diagnostic. */
	protected hasDeleted(start: number, code: DiagnosticCode): boolean {
		return !!this.deleted.find(item => item.start === start && item.code === code)
	}

	/** 
	 * Add usage of a import specifier node, delete it's diagnostic.
	 * It will try to extend node and test if diagnostic located on whole import statement.
	 */
	deleteNeverRead(node: TS.Node) {
		let ts = this.helper.ts

		// If all imported members are not read,
		// diagnostic located at import declaration.
		if (ts.isImportSpecifier(node)) {
			let importDecl = node.parent.parent.parent

			if (ts.isImportDeclaration(importDecl)) {
				this.deleteByNode(importDecl, [DiagnosticCode.ValueNeverRead, DiagnosticCode.AllImportsUnused])

				if (!this.potentialAllImportsUnUsed.includes(importDecl)) {
					this.potentialAllImportsUnUsed.push(importDecl)
				}
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
					this.deleteByNode(iName, [DiagnosticCode.ValueNeverRead, DiagnosticCode.NeverRead])
				}
			}
		}

		this.deleteByNode(decl, [DiagnosticCode.ValueNeverRead, DiagnosticCode.NeverRead])
	}

	/** For binding multiple parameters `:bind=${a, b}`. */
	deleteByNode(node: TS.Node, codes: DiagnosticCode[]) {
		let start = node.getStart()

		for (let code of codes) {
			this.deleted.push({start, code})
		}
	}

	/** Get all diagnostics after modified. */
	getModified(startDiagnostics: TS.Diagnostic[]) {
		let filtered: TS.Diagnostic[] = []
		let restUnImported: TS.Diagnostic[] = []

		for (let diag of startDiagnostics) {
			if (this.hasDeleted(diag.start!, diag.code)) {
				restUnImported.push(...this.getSiblingImportDiags(diag.start!))
			}
			else {
				filtered.push(diag)
			}
		}
		
		return [...filtered, ...this.added, ...restUnImported]
	}

	private getSiblingImportDiags(start: number): TS.Diagnostic[] {
		let importDecl = this.potentialAllImportsUnUsed.find(decl => decl.getStart() === start)
		if (!importDecl) {
			return []
		}

		let unImported: TS.Diagnostic[] = []

		for (let element of (importDecl.importClause!.namedBindings! as TS.NamedImports).elements) {
			if (!this.hasDeleted(element.name.getStart(), DiagnosticCode.ValueNeverRead)) {
				unImported.push(this.getByNode(
					element.name,
					DiagnosticCode.ValueNeverRead,
					`'${this.helper.getText(element.name)}' is declared but its value is never read.`
				))
			}
		}
		
		return unImported
	}
}
