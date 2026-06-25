export interface GenerateImageParams {
  prompt: string;
  size?: string;
}

export interface GenerateImageResult {
  url: string;
  raw: unknown;
}

export interface ImageProvider {
  readonly name: string;
  generate(params: GenerateImageParams): Promise<GenerateImageResult>;
}
