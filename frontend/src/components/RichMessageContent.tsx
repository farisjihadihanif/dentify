import React from 'react';

export interface RichMessageContentProps {
  content: string;
  className?: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Parse **bold** pairs first, then strip any stray unmatched ** markers
  const nodes: React.ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match = boldRegex.exec(text);
  let keyIdx = 0;

  while (match !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index).replace(/\*\*/g, '');
      if (plain) nodes.push(<React.Fragment key={`t-${keyIdx++}`}>{plain}</React.Fragment>);
    }
    const boldInner = match[1].replace(/\*\*/g, '').trim();
    if (boldInner) {
      nodes.push(
        <strong key={`b-${keyIdx++}`} className="font-semibold">
          {boldInner}
        </strong>,
      );
    }
    lastIndex = match.index + match[0].length;
    match = boldRegex.exec(text);
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex).replace(/\*\*/g, '');
    if (tail) nodes.push(<React.Fragment key={`t-${keyIdx++}`}>{tail}</React.Fragment>);
  }

  return nodes;
}

type Block =
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

function parseMarkdownBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') {
        last.items.push(ulMatch[1]);
      } else {
        blocks.push({ type: 'ul', items: [ulMatch[1]] });
      }
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') {
        last.items.push(olMatch[1]);
      } else {
        blocks.push({ type: 'ol', items: [olMatch[1]] });
      }
      continue;
    }

    const headingCleaned = trimmed.replace(/^#{1,6}\s+/, '');
    blocks.push({ type: 'p', text: headingCleaned });
  }

  return blocks;
}

/**
 * Clean Markdown / Rich-Text Formatter for Deni's responses:
 * - Converts `**bold**` into `<strong>`
 * - Converts `- ` / `* ` / `• ` lists into styled `<ul><li>` and numbered lists into `<ol><li>`
 * - Strips any stray unmatched `**` so raw markdown asterisks are never displayed.
 */
export function RichMessageContent({ content, className = '' }: RichMessageContentProps) {
  const blocks = parseMarkdownBlocks(content || '');

  return (
    <div className={['space-y-2 leading-relaxed', className].filter(Boolean).join(' ')}>
      {blocks.map((block, idx) => {
        if (block.type === 'ul') {
          return (
            <ul key={`ul-${idx}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIdx) => (
                <li key={`uli-${itemIdx}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={`ol-${idx}`} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIdx) => (
                <li key={`oli-${itemIdx}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ol>
          );
        }
        return <p key={`p-${idx}`}>{renderInlineFormatting(block.text)}</p>;
      })}
    </div>
  );
}

export default RichMessageContent;
