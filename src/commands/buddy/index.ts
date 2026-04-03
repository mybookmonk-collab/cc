import type { Command } from '../../commands.js'

const buddy = {
  type: 'local',
  name: 'buddy',
  description: 'Interact with your buddy pet',
  aliases: ['pet'],
  supportsNonInteractive: true,
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
