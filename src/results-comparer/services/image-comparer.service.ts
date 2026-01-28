import { Injectable } from "@nestjs/common";

@Injectable()
export class ImageComparerService {
  /**
   * Check if two images are identical (base64 comparison)
   */
  areEqual(imagePathA: string, imagePathB: string): boolean {
    // TODO: Implement base64 comparison
    // See _original/results-comparer/entities/ImageComparer.ts
    // throw new Error("Not implemented");
    console.log(imagePathA, imagePathB);
    return false;
  }

  /**
   * Create a visual difference map between two images
   */
  async createDifferenceMap(
    imagePathA: string,
    imagePathB: string,
    outputPath: string,
  ): Promise<void> {
    // TODO: Implement pixelmatch comparison
    // See _original/results-comparer/entities/ImageComparer.ts
    // throw new Error("Not implemented");
    console.log(imagePathA, imagePathB, outputPath);
    return Promise.resolve();
  }
}
