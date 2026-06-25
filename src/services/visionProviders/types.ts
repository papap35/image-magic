export interface RecognizeImageParams {
  imageUrl: string;
}

export interface RecognizeImageResult {
  caption: string;
  tags: string[];
  raw: unknown;
}

export interface VisionProvider {
  readonly name: string;
  recognize(params: RecognizeImageParams): Promise<RecognizeImageResult>;
}
