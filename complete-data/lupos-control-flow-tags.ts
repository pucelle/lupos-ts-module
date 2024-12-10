export const LuposControlFlowTags: CompletionDataItem[] = [
	{
		name: "lu:await",
		description: "`<lu:await ${promise}>Pending</>`",
	},
	{
		name: "lu:then",
		description: "`<lu:then>Resolved</>`, follows `<lu:await>`",
	},
	{
		name: "lu:catch",
		description: "`<lu:catch>Rejected</>`, follows `<lu:await>` or `<lu:then>`",
	},
	{
		name: "lu:for",
		description: "`<lu:for ${iterable}>(item, index) => {...}`",
	},
	{
		name: "lu:if",
		description: "`<lu:if ${condition}>Content when condition is true like.</>`",
	},
	{
		name: "lu:elseif",
		description: "`<lu:elseif ${condition}>Content when condition is true like.</>`, follows `<lu:if>` or `<lu:elseif>`",
	},
	{
		name: "lu:else",
		description: "`<lu:else>Content when all other conditions are falsy.</>`, follows `<lu:if>` or `<lu:elseif>`",
	},
	{
		name: "lu:keyed",
		description: "`<lu:keyed ${key}>Keyed Content</>`, it regenerates 'Keyed Content' after `key` get changed.",
	},
	{
		name: "lu:switch",
		description: "`<lu:switch ${matchingValue}>...</>` switches a case branch matches `matchingValue`, or choose default branch if no value matched, contains `<lu:case>` and `<lu:default>`.",
	},
	{
		name: "lu:case",
		description: "`<lu:case ${matchingValue}>Case Content</> shows content when `matchingValue` matches parental `<lu:switch>` matching value.",
	},
	{
		name: "lu:default",
		description: "`<lu:default>Default Content</> shows content when all case `matchingValue` mismatched.",
	},
]