declare module 'cloudinary' {
  export const v2: {
    config(options: Record<string, unknown>): void;
    uploader: {
      upload(file: string, options?: Record<string, unknown>): Promise<unknown>;
      destroy(publicId: string, options?: Record<string, unknown>): Promise<unknown>;
    };
  };
}
