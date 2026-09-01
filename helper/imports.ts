import type TS from 'typescript'


export function createImportHelpers(ts: typeof TS) {
	

	const imports = {

		/** Get import statement come from specified module name. */
		getImportFromModule(moduleName: string, sourceFile: TS.SourceFile): TS.ImportDeclaration | undefined {
			return sourceFile.statements.find(st => {
				return ts.isImportDeclaration(st)
					&& ts.isStringLiteral(st.moduleSpecifier)
					&& st.moduleSpecifier.text === moduleName
					&& st.importClause?.namedBindings
					&& ts.isNamedImports(st.importClause?.namedBindings)
			}) as TS.ImportDeclaration | undefined
		},
	}

	return {imports}
}
