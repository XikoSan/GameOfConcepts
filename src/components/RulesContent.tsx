import { rulesText } from '../rulesText';

type RulesBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'diagram'; lines: string[] };

function parseRulesText(text: string): RulesBlock[] {
  const blocks: RulesBlock[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue;

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 3) as 1 | 2 | 3,
        text: headingMatch[2],
      });
      continue;
    }

    const unorderedListMatch = trimmedLine.match(/^-\s+(.+)$/);
    if (unorderedListMatch) {
      const previousBlock = blocks.at(-1);
      if (previousBlock?.type === 'list' && !previousBlock.ordered) {
        previousBlock.items.push(unorderedListMatch[1]);
      } else {
        blocks.push({ type: 'list', ordered: false, items: [unorderedListMatch[1]] });
      }
      continue;
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      const previousBlock = blocks.at(-1);
      if (previousBlock?.type === 'list' && previousBlock.ordered) {
        previousBlock.items.push(orderedListMatch[1]);
      } else {
        blocks.push({ type: 'list', ordered: true, items: [orderedListMatch[1]] });
      }
      continue;
    }

    if (line.startsWith('    ')) {
      const previousBlock = blocks.at(-1);
      if (previousBlock?.type === 'diagram') {
        previousBlock.lines.push(line);
      } else {
        blocks.push({ type: 'diagram', lines: [line] });
      }
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmedLine });
  }

  return blocks;
}

export function RulesContent() {
  const blocks = parseRulesText(rulesText);

  return (
    <div className="rules-content">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = `h${block.level}` as const;
          return <HeadingTag key={`${block.text}-${index}`}>{block.text}</HeadingTag>;
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={`${block.items[0]}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'diagram') {
          return (
            <pre className="rules-diagram" key={`${block.lines.join('-')}-${index}`}>
              {block.lines.join('\n')}
            </pre>
          );
        }

        return <p key={`${block.text}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
