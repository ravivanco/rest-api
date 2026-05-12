export const GET_APTITUDES_CLINICAS = `
  SELECT id_aptitud, codigo, nombre
  FROM aptitudes_clinicas
  ORDER BY id_aptitud ASC
`;
