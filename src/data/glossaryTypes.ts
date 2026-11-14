export interface GlossaryEntry {
  definitionId: string;
  term: string;
  definition: string;
  meanings?: readonly string[];
  aliases?: readonly string[];
  sources: readonly { label: string; url: string }[];
}
