import type { Message } from '../types/message.js'
import { getCompanion } from './companion.js'
import { getGlobalConfig } from '../utils/config.js'

// Simple placeholder reactions for the companion
const REACTIONS = [
  'Quack!',
  'Hmm...',
  'Interesting!',
  '*nods*',
  '✨',
  'Indeed!',
  'Fascinating.',
  '*tilts head*',
  'Oh!',
  'I see!',
]

export function observeMessagesForCompanion(
  messages: readonly Message[],
): string | undefined {
  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return undefined

  // Simple reaction logic: 20% chance to react to a new message
  if (Math.random() > 0.2) return undefined

  return REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
}
