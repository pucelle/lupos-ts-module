import type TS from 'typescript'
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

	/** Test whether has deleted a specified diagnostic. */
	protected hasDeleted(diag: {start: number | undefined, code: number}): boolean {
		return !!this.deleted.find(item => item.start === diag.start && item.code === diag.code)
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
		return [
			...startDiagnostics.filter(diag => !this.hasDeleted(diag)),
			...this.added,
		]
	}
}
