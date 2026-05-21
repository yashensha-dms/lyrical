import { countWordSyllables } from './syllables';

// Map of complex, formal, or non-conversational words to simpler, songwriting-friendly alternatives.
export const SIMPLIFIER_DICTIONARY: Record<string, string[]> = {
  utilize: ['use'],
  subsequent: ['next', 'later', 'after'],
  initiate: ['start', 'begin'],
  terminate: ['end', 'stop'],
  endeavor: ['try'],
  request: ['ask', 'want'],
  require: ['need'],
  purchase: ['buy'],
  construct: ['build', 'make'],
  observe: ['watch', 'see'],
  position: ['place', 'spot'],
  indicate: ['show'],
  assistance: ['help'],
  additional: ['more'],
  commence: ['start', 'begin'],
  demonstrate: ['show', 'prove'],
  individual: ['person', 'one'],
  numerous: ['many', 'a lot'],
  sufficiently: ['enough'],
  approximately: ['about'],
  modify: ['change'],
  obtain: ['get'],
  reside: ['live'],
  locate: ['find'],
  attempt: ['try'],
  conceal: ['hide'],
  disclose: ['show', 'tell'],
  generate: ['make'],
  verify: ['check'],
  perform: ['do'],
  complete: ['finish', 'done'],
  function: ['work'],
  select: ['pick', 'choose'],
  reflect: ['think'],
  perceive: ['see', 'feel'],
  comprehend: ['get', 'know'],
  anticipate: ['wait for', 'expect'],
  delay: ['wait'],
  encounter: ['meet'],
  declare: ['say', 'tell'],
  state: ['say'],
  suggest: ['hint', 'say'],
  clarify: ['explain', 'show'],
  consume: ['eat', 'drink'],
  fatigued: ['tired'],
  exhausted: ['tired', 'spent'],
  melancholy: ['sad'],
  ecstatic: ['glad', 'happy'],
  terrified: ['scared'],
  furious: ['mad', 'angry'],
  massive: ['big', 'huge'],
  miniature: ['small'],
  immense: ['huge'],
  substantial: ['big'],
  deficient: ['lacking'],
  superior: ['better'],
  inferior: ['worse'],
  correct: ['right'],
  incorrect: ['wrong'],
  accurate: ['right'],
  challenging: ['hard'],
  difficult: ['hard'],
  convenient: ['easy'],
  straightforward: ['simple'],
  complex: ['hard'],
  complicated: ['hard'],
  intricate: ['deep'],
  profound: ['deep'],
  obvious: ['clear'],
  apparent: ['clear'],
  essential: ['key', 'must'],
  crucial: ['key'],
  vital: ['key'],
  urgent: ['fast'],
  rapid: ['fast'],
  swift: ['fast'],
  sluggish: ['slow'],
  deliberate: ['slow'],
  frequent: ['often'],
  rare: ['seldom'],
  initial: ['first'],
  ultimate: ['last', 'final'],
  internal: ['inside'],
  external: ['outside'],
  maximum: ['most'],
  minimum: ['least'],
  optimal: ['best'],
  prior: ['before'],
  former: ['past'],
  latter: ['second'],
  vacant: ['empty'],
  occupied: ['busy', 'full'],
  abundant: ['plenty'],
  scarce: ['low'],
  hazardous: ['unsafe', 'bad'],
  secure: ['safe'],
  identical: ['same'],
  distinct: ['other'],
  variable: ['changing'],
  static: ['still'],
  temporary: ['short'],
  permanent: ['long'],
  transparent: ['clear'],
  opaque: ['dark'],
  elevate: ['raise', 'lift'],
  descend: ['fall', 'go down'],
  ascend: ['climb', 'go up'],
  withdraw: ['leave', 'pull out'],
  accumulate: ['pile up', 'gather'],
  diminish: ['fade', 'shrink'],
  expand: ['grow'],
  establish: ['set up'],
  preserve: ['keep', 'save'],
  transform: ['change'],
  negotiate: ['talk', 'deal'],
  cooperate: ['help'],
  contribute: ['give'],
  validate: ['check'],
  evaluate: ['rate'],
  analyze: ['study'],
  investigate: ['search'],
  fabricate: ['make', 'lie'],
  duplicate: ['copy'],
  execute: ['do', 'run'],
  dispatch: ['send'],
  transport: ['carry', 'move'],
  transmit: ['send'],
  receive: ['get'],
  possess: ['have'],
  retain: ['keep'],
  sustain: ['keep up'],
  tolerate: ['stand', 'bear'],
  endure: ['stand', 'last'],
  oppose: ['fight'],
  resist: ['fight'],
  conquer: ['win'],
  capture: ['take'],
  liberate: ['free'],
  release: ['let go'],
  protect: ['guard', 'keep'],
  defend: ['guard'],
  attack: ['hit'],
  eliminate: ['get rid of'],
  restore: ['fix'],
  renovate: ['fix'],
  repair: ['fix'],
  satisfy: ['please'],
  provoke: ['anger', 'start'],
  pacify: ['calm'],
  furthermore: ['then', 'also'],
  nevertheless: ['but', 'still'],
  nonetheless: ['but', 'still'],
  consequently: ['so'],
  therefore: ['so'],
  concerning: ['about'],
  regarding: ['about'],
  despite: ['though'],
  acquire: ['get'],
  accumulated: ['piled up'],
  ascertain: ['find out', 'check'],
  compensate: ['pay'],
  designate: ['name', 'pick'],
  endeavoured: ['tried'],
  expedite: ['speed up', 'rush'],
  facilitate: ['help', 'ease'],
  hence: ['so'],
  inquire: ['ask'],
  magnitude: ['size'],
  objective: ['goal', 'aim'],
  subsequently: ['later', 'next'],
  sufficient: ['enough'],
  visualize: ['see', 'picture'],
  conversational: ['simple'],
  nonconversational: ['fancy'],
};

export interface ComplexityMatch {
  word: string;
  index: number;
  suggestions: string[];
  reason: 'dictionary' | 'syllables';
}

/**
 * Scans a block of text for complex/formal words and high-syllable words.
 */
export function scanComplexity(text: string): ComplexityMatch[] {
  if (!text) return [];

  // Match words, ignoring punctuation but keeping apostrophes
  const wordRegex = /\b[a-zA-Z']+\b/g;
  const matches: ComplexityMatch[] = [];
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const lowerWord = word.toLowerCase();
    const index = match.index;

    // 1. Check dictionary first
    if (SIMPLIFIER_DICTIONARY[lowerWord]) {
      matches.push({
        word,
        index,
        suggestions: SIMPLIFIER_DICTIONARY[lowerWord],
        reason: 'dictionary',
      });
      continue;
    }

    // 2. Fallback: flag words with 4 or more syllables
    const syllables = countWordSyllables(word);
    if (syllables >= 4) {
      // Create generic suggestions based on syllable count
      matches.push({
        word,
        index,
        suggestions: ['try a shorter word'],
        reason: 'syllables',
      });
    }
  }

  return matches;
}
