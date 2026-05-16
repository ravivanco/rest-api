import { ImageAnnotatorClient } from '@google-cloud/vision';

type ServiceAccountCredentials = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

function buildVisionClient(): ImageAnnotatorClient {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (credentialsJson) {
    let parsed: string;

    try {
      // Render puede inyectar saltos de línea literales dentro del JSON,
      // lo que rompe JSON.parse. Intentamos primero tal cual; si falla,
      // reemplazamos saltos de línea reales fuera de comillas y reintentamos.
      try {
        parsed = credentialsJson;
        JSON.parse(parsed); // prueba rápida
      } catch {
        // Reemplaza saltos de línea literales dentro del valor de private_key
        // (los `\n` reales que Render introduce al pegar JSON multi-línea)
        parsed = credentialsJson.replace(/\n/g, '\\n');
      }

      const credentials = JSON.parse(parsed) as ServiceAccountCredentials;

      // Restaurar los \n escapados del private_key como saltos de línea reales
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }

      const client = new ImageAnnotatorClient({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        },
        projectId: credentials.project_id,
      });

      console.log(
        '[vision] Cliente inicializado desde GOOGLE_CREDENTIALS_JSON | '
        + `project_id=${credentials.project_id || 'sin_project_id'} | `
        + `client_email=${credentials.client_email ? 'presente' : 'ausente'}`,
      );

      return client;
    } catch (err) {
      console.error('[vision] Error al parsear GOOGLE_CREDENTIALS_JSON:', err);
      console.warn('[vision] Iniciando cliente Vision sin credenciales explícitas.');
    }
  }

  console.warn('[vision] Cliente Vision inicializado con Application Default Credentials.');
  return new ImageAnnotatorClient();
}

export const visionClient = buildVisionClient();
