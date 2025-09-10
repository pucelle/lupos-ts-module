export const LuposFlowControlTags: CompletionDataItem[] = [
	{
		name: "lu:await",
		description: "`<lu:await ${promise}>Pending</>`, shows contents before promise resolved or rejected.",
	},
	{
		name: "lu:then",
		description: "`<lu:then>Resolved</>`, shows contents after promise resolved, follows `<lu:await>`.",
	},
	{
		name: "lu:catch",
		description: "`<lu:catch>Rejected</>`, shows contents after promise rejected, follows `<lu:await>` or `<lu:then>`",
	},
	{
		name: "lu:for",
		description: "`<lu:for ${iterable}>(item, index) => {...}`, map an iterable and get mapped contents.",
	},
	{
		name: "lu:if",
		description: "`<lu:if ${condition}>Content</>`, shows content when condition is true.\n\nIf `cache` attribute specified, will cache removed contents for later restoring.",
	},
	{
		name: "lu:elseif",
		description: "`<lu:elseif ${condition}>Content</>`, shows content when condition is true, follows `<lu:if>`.",
	},
	{
		name: "lu:else",
		description: "`<lu:else>Content</>`, shows content when all other conditions are falsy, follows `<lu:if>` or `<lu:elseif>`.",
	},
	{
		name: "lu:keyed",
		description: "`<lu:keyed ${key}>Keyed Content</>`, it regenerates 'Keyed Content' after `key` get changed.\n\nIf `cache` attribute specified, will cache removed contents by key for later restoring.\n\nIf `weakCache` attribute specified, will cache removed contents in a weak map by key for later restoring, and key must be an object.",
	},
	{
		name: "lu:switch",
		description: "`<lu:switch ${matchingValue}>...</>` switches a `case` branch matches `matchingValue`, or choose `default` branch if no value matched. \n\nIf `cache` attribute specified, will cache removed contents for later restoring.",
	},
	{
		name: "lu:case",
		description: "`<lu:case ${matchingValue}>Case Content</>` shows content when `matchingValue` matches parental `<lu:switch>` matching value.",
	},
	{
		name: "lu:default",
		description: "`<lu:default>Default Content</>` shows content when all case `matchingValue` mismatched.",
	},
]