/** Parse an explicit #123 review ID; ordinary text remains free-text search. */
export function parseKnowledgeCandidateIdQuery(query: string): number | null {
  const match = /^#([1-9][0-9]*)$/.exec(query.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}
