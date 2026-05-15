import { ImageAnnotatorClient } from '@google-cloud/vision';

type ServiceAccountCredentials = {
  project_id?: string;
  private_key?: string;
  client_email?: string;
};

function buildVisionClient(): ImageAnnotatorClient {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;

    return new ImageAnnotatorClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      projectId: credentials.project_id,
    });
  }

  return new ImageAnnotatorClient();
}

export const visionClient = buildVisionClient();
