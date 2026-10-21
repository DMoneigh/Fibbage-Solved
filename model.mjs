export function normalizeSnapshot(value, questionIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The snapshot must be a JSON object.');
  if (!Array.isArray(value.players)) throw new Error('The snapshot must include a players array.');
  if (value.players.length > 8) throw new Error('Fibbage XL supports up to 8 players.');
  const ids = new Set();
  const players = value.players.map((player, i) => {
    if (!player || typeof player !== 'object') throw new Error(`Player ${i + 1} is invalid.`);
    if (!['string', 'number'].includes(typeof player.id) || !String(player.id).trim()) throw new Error(`Player ${i + 1} needs an id.`);
    const id = String(player.id);
    if (ids.has(id)) throw new Error(`Duplicate player id: ${id}.`);
    ids.add(id);
    if (typeof player.name !== 'string' || !player.name.trim()) throw new Error(`Player ${i + 1} needs a name.`);
    if (player.score !== undefined && (!Number.isFinite(player.score) || player.score < 0)) throw new Error(`Invalid score for ${player.name}.`);
    if (player.connected !== undefined && typeof player.connected !== 'boolean') throw new Error(`Invalid connection state for ${player.name}.`);
    return { id, name: player.name.trim().slice(0, 80), score: player.score ?? null, connected: player.connected ?? null };
  });
  const questionId = value.questionId == null ? null : Number(value.questionId);
  if (questionId !== null && !questionIds.has(questionId)) throw new Error('The questionId does not exist in this archive.');
  if (value.lies !== undefined && !Array.isArray(value.lies)) throw new Error('Lies must be an array.');
  const lies = (value.lies || []).map((lie, i) => {
    if (!lie || typeof lie.text !== 'string' || !lie.text.trim()) throw new Error(`Lie ${i + 1} needs text.`);
    const playerId = lie.playerId == null ? null : String(lie.playerId);
    if (playerId !== null && !ids.has(playerId)) throw new Error(`Lie ${i + 1} references an unknown player.`);
    return { text: lie.text.trim().slice(0, 500), playerId };
  });
  return { players, questionId, lies, importedAt: new Date().toISOString() };
}

export function filterQuestions(questions, search = '', round = 'all') {
  const term = search.trim().toLowerCase();
  return questions.filter(q => (round === 'all' || q.round === round) &&
    (!term || [q.id, q.category, q.question, q.truth, ...q.suggestions].join(' ').toLowerCase().includes(term)));
}
