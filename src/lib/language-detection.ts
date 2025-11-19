/**
 * Simple language detection utility
 * Detects language from text using common patterns and keywords
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

/**
 * Detects language from text using common patterns
 * Returns language code or "en" as default
 */
export function detectLanguage(text: string): LanguageCode {
  if (!text || text.trim().length < 10) {
    return "en"; // Default to English for very short text
  }

  const lowerText = text.toLowerCase();
  const sample = lowerText.substring(0, Math.min(500, text.length));

  // Spanish indicators
  const spanishPatterns = [
    /\b(el|la|los|las|un|una|es|son|está|están|con|por|para|que|de|del|en|a|al)\b/g,
    /\b(y|o|pero|como|cuando|donde|porque|más|muy|también|más|hasta|desde)\b/g,
  ];
  const spanishMatches = spanishPatterns.reduce((sum, pattern) => {
    const matches = sample.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
  if (spanishMatches > 5) return "es";

  // French indicators
  const frenchPatterns = [
    /\b(le|la|les|un|une|est|sont|avec|pour|que|de|du|en|à|au|aux)\b/g,
    /\b(et|ou|mais|comme|quand|où|parce|plus|très|aussi|jusqu|depuis)\b/g,
  ];
  const frenchMatches = frenchPatterns.reduce((sum, pattern) => {
    const matches = sample.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
  if (frenchMatches > 5) return "fr";

  // German indicators
  const germanPatterns = [
    /\b(der|die|das|ein|eine|ist|sind|mit|für|dass|von|dem|im|am|zum)\b/g,
    /\b(und|oder|aber|wie|wann|wo|weil|mehr|sehr|auch|bis|seit)\b/g,
  ];
  const germanMatches = germanPatterns.reduce((sum, pattern) => {
    const matches = sample.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
  if (germanMatches > 5) return "de";

  // Italian indicators
  const italianPatterns = [
    /\b(il|la|lo|gli|le|un|una|è|sono|con|per|che|di|del|nel|al)\b/g,
    /\b(e|o|ma|come|quando|dove|perché|più|molto|anche|fino|da)\b/g,
  ];
  const italianMatches = italianPatterns.reduce((sum, pattern) => {
    const matches = sample.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
  if (italianMatches > 5) return "it";

  // Portuguese indicators
  const portuguesePatterns = [
    /\b(o|a|os|as|um|uma|é|são|com|por|para|que|de|do|no|ao)\b/g,
    /\b(e|ou|mas|como|quando|onde|porque|mais|muito|também|até|desde)\b/g,
  ];
  const portugueseMatches = portuguesePatterns.reduce((sum, pattern) => {
    const matches = sample.match(pattern);
    return sum + (matches ? matches.length : 0);
  }, 0);
  if (portugueseMatches > 5) return "pt";

  // Japanese indicators (hiragana/katakana/kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(sample)) return "ja";

  // Chinese indicators (simplified/traditional)
  if (/[\u4E00-\u9FFF]/.test(sample)) return "zh";

  // Korean indicators
  if (/[\uAC00-\uD7AF]/.test(sample)) return "ko";

  // Arabic indicators
  if (/[\u0600-\u06FF]/.test(sample)) return "ar";

  // Russian indicators (Cyrillic)
  if (/[\u0400-\u04FF]/.test(sample)) return "ru";

  // Default to English
  return "en";
}

/**
 * Gets language name from code
 */
export function getLanguageName(code: LanguageCode): string {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.name || "English";
}

