import type { LocalCommandCall } from '../../types/command.js'
import {
  getCompanion,
  companionUserId,
  roll,
  rollWithSeed,
  generateRandomSeed,
} from '../../buddy/companion.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
  RARITY_STARS,
  STAT_NAMES,
  SPECIES,
  EYES,
  HATS,
  RARITIES,
  type Species,
  type Eye,
  type Hat,
  type Rarity,
} from '../../buddy/types.js'
import { renderSprite } from '../../buddy/sprites.js'
import { stringWidth } from '../../ink/stringWidth.js'
import sliceAnsi from '../../utils/sliceAnsi.js'

// Personality descriptions for each species
const SPECIES_DESCRIPTIONS: Record<string, string> = {
  duck: "A quack-tastic debugger who waddles through your code and always finds the bugs hiding in the reeds.",
  goose: "A honking great code reviewer who charges into messy refactors and emerges victorious.",
  blob: "An amorphous problem-solver who oozes into tight corners of your codebase and smoothes out the wrinkles.",
  cat: "A purr-fectly patient programmer who lands on their feet no matter how many bugs you throw at them.",
  dragon: "A mythical bug-slayer who breathes fire into your code and melts away technical debt.",
  octopus: "A meditative eight-armed debugger who speaks in hushed suggestions and somehow always spots the null reference you missed three commits ago, yet refuses to judge you for it.",
  owl: "A wise old code owl who hoots insights at 3 AM and always knows where you left that missing semicolon.",
  penguin: "A dapper debugger in a tuxedo who waddles through your codebase with elegance and grace.",
  turtle: "A slow and steady refactorer who carries the weight of your technical debt and always crosses the finish line.",
  snail: "A meticulous code reviewer who leaves a trail of perfect commits in their wake.",
  ghost: "A spectral debugger who haunts your stack traces and whispers clues about segfaults.",
  axolotl: "A regenerative coding companion who regrows entire features from just a few lines of code.",
  capybara: "A chill coding buddy who gets along with everyone and keeps your team's morale high.",
  cactus: "A prickly but protective code guardian who keeps bad PRs away from your main branch.",
  robot: "A logical computing machine who calculates the optimal path through your algorithms.",
  rabbit: "A fast-hopping feature builder who multiplies your productivity with each sprint.",
  mushroom: "A fungi of knowledge who grows on your codebase and spawns creative solutions.",
  chonk: "A hefty helper who carries big features on their back and never skips leg day.",
}

// Rarity color ANSI codes
const RARITY_COLORS: Record<string, string> = {
  common: '\x1b[90m', // gray
  uncommon: '\x1b[32m', // green
  rare: '\x1b[34m', // blue
  epic: '\x1b[35m', // magenta
  legendary: '\x1b[33m', // yellow
}
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const CARD_CONTENT_WIDTH = 34
const CARD_TEXT_WIDTH = 34
const locale =
  process.env.LC_ALL ??
  process.env.LC_CTYPE ??
  process.env.LANG ??
  ''
const useWideAmbiguousWidth = /(?:^|[_.-])(zh|ja|ko)(?:[_@.-]|$)/i.test(locale)

// Generate stat bar visualization
function renderStatBar(value: number, width = 12): string {
  const filled = Math.round((value / 100) * width)
  const empty = width - filled

  // Use block characters for the bar
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return bar
}

function displayWidth(text: string): number {
  if (typeof Bun !== 'undefined' && typeof Bun.stringWidth === 'function') {
    return Bun.stringWidth(text, { ambiguousIsNarrow: !useWideAmbiguousWidth })
  }
  return stringWidth(text)
}

function normalizeAmbiguousChars(text: string): string {
  return text
    .replaceAll('★', '*')
    .replaceAll('☆', '*')
    .replaceAll('✦', '*')
    .replaceAll('✧', '*')
}

function escapeForMessage(text: string): string {
  return text.replaceAll('\\', '\\\\')
}

function fitDisplayWidth(text: string, width: number): string {
  const current = displayWidth(text)
  if (current === width) return text
  if (current < width) return text + ' '.repeat(width - current)
  return sliceAnsi(text, 0, width)
}

function frameLine(content: string): string {
  return `│  ${fitDisplayWidth(content, CARD_CONTENT_WIDTH)}  │`
}

function wrapByDisplayWidth(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (displayWidth(candidate) <= width) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (displayWidth(word) <= width) {
      current = word
      continue
    }

    // Extremely long single token: hard-wrap by display width.
    let rest = word
    while (displayWidth(rest) > width) {
      lines.push(sliceAnsi(rest, 0, width))
      rest = sliceAnsi(rest, width)
    }
    current = rest
  }

  if (current) lines.push(current)
  return lines
}

// Render the buddy card
function renderBuddyCard(companion: any): string {
  const stars = normalizeAmbiguousChars(RARITY_STARS[companion.rarity as keyof typeof RARITY_STARS])
  const color = RARITY_COLORS[companion.rarity as keyof typeof RARITY_COLORS] || ''

  const sprite = renderSprite(companion, 0)
  const centeredSprite = sprite.map(line => {
    const safeLine = normalizeAmbiguousChars(line)
    const inner = fitDisplayWidth(safeLine, 12)
    const sidePad = Math.max(0, Math.floor((CARD_CONTENT_WIDTH - 12) / 2))
    return `${' '.repeat(sidePad)}${inner}${' '.repeat(CARD_CONTENT_WIDTH - 12 - sidePad)}`
  })

  while (centeredSprite.length < 5) {
    centeredSprite.unshift(' '.repeat(CARD_CONTENT_WIDTH))
  }

  const description = SPECIES_DESCRIPTIONS[companion.species] || "A delightful coding companion who's always ready to help."
  const lines: string[] = []

  lines.push('┌──────────────────────────────────────┐')

  // Header line
  const rarityText = `${stars} ${companion.rarity.toUpperCase()}`
  const speciesText = companion.species.toUpperCase()
  const left = `${color}${rarityText}${RESET}`
  const right = `${color}${speciesText}${RESET}`
  const middlePad = Math.max(1, CARD_CONTENT_WIDTH - displayWidth(rarityText) - displayWidth(speciesText))
  lines.push(frameLine(`${left}${' '.repeat(middlePad)}${right}`))

  lines.push(frameLine(''))

  // Sprite lines
  for (const line of centeredSprite) {
    lines.push(frameLine(`${color}${line}${RESET}`))
  }

  lines.push(frameLine(''))

  // Name line
  const nameWidth = displayWidth(companion.name)
  const namePad = Math.max(0, Math.floor((CARD_CONTENT_WIDTH - nameWidth) / 2))
  lines.push(frameLine(`${' '.repeat(namePad)}${BOLD}${color}${companion.name}${RESET}`))

  lines.push(frameLine(''))

  // Description lines
  const descLines = wrapByDisplayWidth(description, CARD_TEXT_WIDTH)
  for (const line of descLines) {
    lines.push(frameLine(`${color}${line}${RESET}`))
  }

  lines.push(frameLine(''))

  // Stat lines
  for (const stat of STAT_NAMES) {
    const value = companion.stats[stat] || 0
    const bar = renderStatBar(value)
    const statLabel = fitDisplayWidth(stat, 10)
    const valueStr = String(value).padStart(3, ' ')
    lines.push(frameLine(`${color}${statLabel} ${bar} ${valueStr}${RESET}`))
  }

  lines.push('└──────────────────────────────────────┘')

  return lines.map(escapeForMessage).join('\n')
}

// Show help information
function showHelp(): string {
  return `🐾 Buddy Commands 🐾

/buddy                    - Show your current buddy
/buddy pet                - Pet your buddy
/buddy help               - Show this help message

/buddy rename <name>      - Rename your buddy
/buddy reroll             - Hatch a completely new random buddy
/buddy list [category]    - List available options
   - /buddy list species  - List all species
   - /buddy list eyes     - List all eye styles
   - /buddy list hats     - List all hats
   - /buddy list rarities - List all rarities

/buddy species <species>  - Change your buddy's species
/buddy eye <eye>          - Change your buddy's eye style
/buddy hat <hat>          - Change your buddy's hat (uncommon+ rarity only)
/buddy rarity <rarity>    - Change your buddy's rarity

Example:
  /buddy rename Fluffball
  /buddy species dragon
  /buddy eye ◉
  /buddy hat crown
  /buddy rarity legendary`
}

// List available options
function listOptions(category: string): string {
  switch (category?.toLowerCase()) {
    case 'species':
    case 'specie':
      return `Available species:\n${SPECIES.map(s => `  • ${s}`).join('\n')}`
    case 'eye':
    case 'eyes':
      return `Available eyes:\n${EYES.map(e => `  • ${e}`).join('\n')}`
    case 'hat':
    case 'hats':
      const availableHats = HATS.filter(h => h !== 'none')
      return `Available hats:\n${availableHats.map(h => `  • ${h}`).join('\n')}\n\nNote: Hats require at least uncommon rarity.`
    case 'rarity':
    case 'rarities':
      return `Available rarities:\n${RARITIES.map(r => `  • ${r}`).join('\n')}`
    default:
      return `Usage: /buddy list [category]\n\nCategories:\n  • species  - List all species\n  • eyes     - List all eye styles\n  • hats     - List all hats\n  • rarities - List all rarities`
  }
}

export const call: LocalCommandCall = async (args) => {
  const config = getGlobalConfig()
  let companion = getCompanion()
  const argList = args.trim().split(' ').filter(Boolean)
  const subcommand = argList[0]?.toLowerCase()

  // Handle /buddy help
  if (subcommand === 'help') {
    return { type: 'text', value: showHelp() }
  }

  // Handle /buddy list
  if (subcommand === 'list') {
    const category = argList[1]
    return { type: 'text', value: listOptions(category) }
  }

  // Handle /buddy pet
  if (subcommand === 'pet') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    return { type: 'text', value: '♥ ♥ ♥ Your buddy loves the attention!' }
  }

  // Handle /buddy rename
  if (subcommand === 'rename') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    const newName = argList.slice(1).join(' ').trim()
    if (!newName) {
      return { type: 'text', value: "Usage: /buddy rename <name>\nExample: /buddy rename Fluffball" }
    }
    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion ? { ...current.companion, name: newName } : undefined,
    }))
    const updatedCompanion = getCompanion()
    return {
      type: 'text',
      value: `✨ Renamed to ${newName}! ✨\n\n${updatedCompanion ? renderBuddyCard(updatedCompanion) : ''}`,
    }
  }

  // Handle /buddy reroll
  if (subcommand === 'reroll') {
    const userId = companionUserId()
    const newSeed = generateRandomSeed()
    const { bones } = rollWithSeed(newSeed)

    const names = ['Ducky', 'Goose', 'Blob', 'Kitty', 'Dragon', 'Octo', 'Owl', 'Penny', 'Terry', 'Snail', 'Ghost', 'Axo', 'Capy', 'Cactus', 'Robo', 'Bunny', 'Mush', 'Chonky', 'Flumewise']
    const name = names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.5 ? Math.floor(Math.random() * 100) : '')

    const newCompanion = {
      name,
      personality: 'friendly',
      hatchedAt: Date.now(),
    }

    saveGlobalConfig((current) => ({
      ...current,
      companion: newCompanion,
      companionSeed: { seed: newSeed },
    }))

    const updatedCompanion = getCompanion()
    if (updatedCompanion) {
      return {
        type: 'text',
        value: `✨ A new buddy hatched! ✨\n\n${renderBuddyCard(updatedCompanion)}\n\n${updatedCompanion.name} is here • it'll chime in as you code\nyour buddy won't count toward your usage\nsay its name to get its take • /buddy pet • /buddy help`,
      }
    }
  }

  // Handle /buddy species
  if (subcommand === 'species') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    const speciesName = argList[1]?.toLowerCase()
    if (!speciesName) {
      return { type: 'text', value: `Usage: /buddy species <species>\n\nAvailable species:\n${SPECIES.map(s => `  • ${s}`).join('\n')}` }
    }
    if (!SPECIES.includes(speciesName as any)) {
      return { type: 'text', value: `Unknown species: ${speciesName}\n\nAvailable species:\n${SPECIES.map(s => `  • ${s}`).join('\n')}` }
    }

    // Update or create companionSeed with species override
    const currentSeed = (config as any).companionSeed || { seed: generateRandomSeed() }
    saveGlobalConfig((current) => ({
      ...current,
      companionSeed: {
        ...currentSeed,
        seed: currentSeed.seed || generateRandomSeed(),
        species: speciesName,
      },
    }))

    const updatedCompanion = getCompanion()
    return {
      type: 'text',
      value: `✨ Changed species to ${speciesName}! ✨\n\n${updatedCompanion ? renderBuddyCard(updatedCompanion) : ''}`,
    }
  }

  // Handle /buddy eye
  if (subcommand === 'eye') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    const eyeStyle = argList[1]
    if (!eyeStyle) {
      return { type: 'text', value: `Usage: /buddy eye <eye>\n\nAvailable eyes:\n${EYES.map(e => `  • ${e}`).join('\n')}` }
    }
    if (!EYES.includes(eyeStyle as any)) {
      return { type: 'text', value: `Unknown eye style: ${eyeStyle}\n\nAvailable eyes:\n${EYES.map(e => `  • ${e}`).join('\n')}` }
    }

    const currentSeed = (config as any).companionSeed || { seed: generateRandomSeed() }
    saveGlobalConfig((current) => ({
      ...current,
      companionSeed: {
        ...currentSeed,
        seed: currentSeed.seed || generateRandomSeed(),
        eye: eyeStyle,
      },
    }))

    const updatedCompanion = getCompanion()
    return {
      type: 'text',
      value: `✨ Changed eye style! ✨\n\n${updatedCompanion ? renderBuddyCard(updatedCompanion) : ''}`,
    }
  }

  // Handle /buddy hat
  if (subcommand === 'hat') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    const hatStyle = argList[1]?.toLowerCase() || 'none'

    if (hatStyle !== 'none' && !HATS.includes(hatStyle as any)) {
      return { type: 'text', value: `Unknown hat: ${hatStyle}\n\nAvailable hats:\n${HATS.filter(h => h !== 'none').map(h => `  • ${h}`).join('\n')}\n\nUse "/buddy hat none" to remove hat.` }
    }

    if (companion.rarity === 'common' && hatStyle !== 'none') {
      return { type: 'text', value: `Hats require at least uncommon rarity!\n\nYour buddy is ${companion.rarity}. Try /buddy reroll to get a rarer buddy.` }
    }

    const currentSeed = (config as any).companionSeed || { seed: generateRandomSeed() }
    saveGlobalConfig((current) => ({
      ...current,
      companionSeed: {
        ...currentSeed,
        seed: currentSeed.seed || generateRandomSeed(),
        hat: hatStyle === 'none' ? undefined : hatStyle,
      },
    }))

    const updatedCompanion = getCompanion()
    return {
      type: 'text',
      value: `✨ ${hatStyle === 'none' ? 'Removed hat' : `Changed hat to ${hatStyle}`}! ✨\n\n${updatedCompanion ? renderBuddyCard(updatedCompanion) : ''}`,
    }
  }

  // Handle /buddy rarity
  if (subcommand === 'rarity') {
    if (!companion) {
      return { type: 'text', value: "You don't have a buddy yet! Type /buddy to hatch one." }
    }
    const rarityName = argList[1]?.toLowerCase()
    if (!rarityName) {
      return { type: 'text', value: `Usage: /buddy rarity <rarity>\n\nAvailable rarities:\n${RARITIES.map(r => `  • ${r}`).join('\n')}` }
    }
    if (!RARITIES.includes(rarityName as any)) {
      return { type: 'text', value: `Unknown rarity: ${rarityName}\n\nAvailable rarities:\n${RARITIES.map(r => `  • ${r}`).join('\n')}` }
    }

    // Update or create companionSeed with rarity override
    const currentSeed = (config as any).companionSeed || { seed: generateRandomSeed() }
    saveGlobalConfig((current) => ({
      ...current,
      companionSeed: {
        ...currentSeed,
        seed: currentSeed.seed || generateRandomSeed(),
        rarity: rarityName,
      },
    }))

    const updatedCompanion = getCompanion()
    return {
      type: 'text',
      value: `✨ Changed rarity to ${rarityName}! ✨\n\n${updatedCompanion ? renderBuddyCard(updatedCompanion) : ''}`,
    }
  }

  // If no companion exists, hatch one
  if (!companion) {
    const userId = companionUserId()
    const { bones } = roll(userId)

    const names = ['Ducky', 'Goose', 'Blob', 'Kitty', 'Dragon', 'Octo', 'Owl', 'Penny', 'Terry', 'Snail', 'Ghost', 'Axo', 'Capy', 'Cactus', 'Robo', 'Bunny', 'Mush', 'Chonky', 'Flumewise']
    const name = names[Math.floor(Math.random() * names.length)] + (Math.random() > 0.5 ? Math.floor(Math.random() * 100) : '')

    const newCompanion = {
      name,
      personality: 'friendly',
      hatchedAt: Date.now(),
    }

    saveGlobalConfig((current) => ({
      ...current,
      companion: newCompanion,
    }))

    // Get the companion with full bones
    companion = getCompanion()

    if (companion) {
      return {
        type: 'text',
        value: `✨ A new buddy hatched! ✨\n\n${renderBuddyCard(companion)}\n\n${companion.name} is here • it'll chime in as you code\nyour buddy won't count toward your usage\nsay its name to get its take • /buddy pet • /buddy help`,
      }
    }
  }

  if (companion) {
    return {
      type: 'text',
      value: `${renderBuddyCard(companion)}\n\n${companion.name} is here • it'll chime in as you code\nyour buddy won't count toward your usage\nsay its name to get its take • /buddy pet • /buddy help`,
    }
  }

  return { type: 'text', value: "No buddy found. Type /buddy to hatch one!" }
}
