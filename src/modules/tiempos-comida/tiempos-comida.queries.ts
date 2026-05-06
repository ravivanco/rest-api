export const GET_TIEMPOS_COMIDA = `
SELECT
  id_tiempo_comida,
  nombre,
  to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
  to_char(hora_fin, 'HH24:MI') AS hora_fin,
  orden
FROM tiempos_comida
WHERE activo = TRUE
ORDER BY orden ASC
`;
