const { espRequest } = require('../esp');
const acState = require('../data/ac-state');

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/*
 * Calcula el estado absoluto, lo envia al ESP y solo persiste si el equipo
 * responde. Devuelve { state, changed } o lanza si el ESP no esta disponible.
 */
async function applyAcState(partial) {
  const candidate = acState.preview(partial);
  const query = buildQuery(acState.toEspParams(candidate));
  await espRequest(`/api/ac/set?${query}`);
  acState.commit(candidate);
  return candidate;
}

module.exports = { applyAcState, buildQuery };
