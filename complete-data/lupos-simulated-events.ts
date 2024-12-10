export const LuposSimulatedEvents: CompletionDataItem[] = [
	{
		name: 'tap',
		description: 'Quickly touch the screen and then lifts.',
	},
	{
		name: 'double-tap',
		description: 'Double quickly touch the screen and then lifts.',
	},
	{
		name: 'hold:start',
		description: 'After holding a finger touch screen for a specific duration.',
	},
	{
		name: 'hold:end',
		description: 'After finger leaves touch screen and end holding.',
	},
	{
		name: 'pinch-zoom:start',
		description: 'When begin to pinch zoom by two fingers on touch screen.',
	},
	{
		name: 'pinch-zoom:transform',
		description: 'Every time two fingers move and should update pinch zoom matrix.',
	},
	{
		name: 'pinch-zoom:end',
		description: 'After fingers leave touch screen and pinch zoom end.',
	},
	{
		name: 'pinch-transform:start',
		description: 'When begin to pinch transform by two fingers on touch screen. pinch transform includes zoom and rotation.',
	},
	{
		name: 'pinch-transform:transform',
		description: 'Every time two fingers move and should update pinch transform matrix.',
	},
	{
		name: 'pinch-transform:end',
		description: 'After fingers leave touch screen and pinch transform end.',
	},
	{
		name: 'slide',
		description: 'After finger slides at a specific direction on a touch screen.',
	},
]
