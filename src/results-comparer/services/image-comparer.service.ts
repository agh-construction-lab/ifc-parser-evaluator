import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { ImageViewComparison } from "../types/comparison.types";

@Injectable()
export class ImageComparerService {
  private readonly logger = new Logger(ImageComparerService.name);

  /**
   * Compare images from two parser outputs for a specific view
   */
  compareImages(
    imagePathA: string,
    imagePathB: string,
    diffOutputPath: string,
  ): ImageViewComparison {
    const viewName = path.basename(diffOutputPath, ".png").replace("-diff", "");

    if (!fs.existsSync(imagePathA) || !fs.existsSync(imagePathB)) {
      this.logger.warn(`Missing images for comparison: ${viewName}`);
      return {
        viewName,
        imagePaths: [imagePathA, imagePathB],
        pixelDiffCount: -1,
        pixelDiffPercentage: -1,
        match: false,
      };
    }

    try {
      const img1 = PNG.sync.read(fs.readFileSync(imagePathA));
      const img2 = PNG.sync.read(fs.readFileSync(imagePathB));

      const { width, height } = img1;

      // Check if dimensions match
      if (img1.width !== img2.width || img1.height !== img2.height) {
        this.logger.warn(`Image dimensions mismatch for ${viewName}`);
        return {
          viewName,
          imagePaths: [imagePathA, imagePathB],
          pixelDiffCount: -1,
          pixelDiffPercentage: -1,
          match: false,
        };
      }

      const diff = new PNG({ width, height });
      const totalPixels = width * height;

      const pixelDiffCount = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 },
      );

      // Save difference image
      const diffDir = path.dirname(diffOutputPath);
      if (!fs.existsSync(diffDir)) {
        fs.mkdirSync(diffDir, { recursive: true });
      }
      fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));

      const pixelDiffPercentage = (pixelDiffCount / totalPixels) * 100;
      const match = pixelDiffCount === 0;

      this.logger.debug(
        `${viewName}: ${pixelDiffCount} pixels differ (${pixelDiffPercentage.toFixed(2)}%)`,
      );

      return {
        viewName,
        imagePaths: [imagePathA, imagePathB],
        diffImagePath: diffOutputPath,
        pixelDiffCount,
        pixelDiffPercentage,
        match,
      };
    } catch (error) {
      this.logger.error(`Error comparing images for ${viewName}: ${error}`);
      return {
        viewName,
        imagePaths: [imagePathA, imagePathB],
        pixelDiffCount: -1,
        pixelDiffPercentage: -1,
        match: false,
      };
    }
  }

  /**
   * Compare all views for a pair of parser results
   */
  compareAllViews(
    resultDirA: string,
    resultDirB: string,
    diffOutputDir: string,
    views: Array<string>,
  ): Array<ImageViewComparison> {
    const results: Array<ImageViewComparison> = [];

    for (const view of views) {
      const imagePathA = path.join(resultDirA, `${view}.png`);
      const imagePathB = path.join(resultDirB, `${view}.png`);
      const diffOutputPath = path.join(diffOutputDir, `${view}-diff.png`);

      results.push(this.compareImages(imagePathA, imagePathB, diffOutputPath));
    }

    return results;
  }

  /**
   * Create a combined comparison image with all three images side by side
   */
  createCombinedImage(
    imagePathA: string,
    imagePathB: string,
    diffImagePath: string,
    outputPath: string,
  ): void {
    if (
      !fs.existsSync(imagePathA) ||
      !fs.existsSync(imagePathB) ||
      !fs.existsSync(diffImagePath)
    ) {
      return;
    }

    const img1 = PNG.sync.read(fs.readFileSync(imagePathA));
    const img2 = PNG.sync.read(fs.readFileSync(imagePathB));
    const imgDiff = PNG.sync.read(fs.readFileSync(diffImagePath));

    const { width, height } = img1;
    const gap = 4;
    const combinedWidth = width * 3 + gap * 2;

    const combined = new PNG({ width: combinedWidth, height });

    // Fill with gray background
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < combinedWidth; x++) {
        const idx = (combinedWidth * y + x) << 2;
        combined.data[idx] = 40;
        combined.data[idx + 1] = 40;
        combined.data[idx + 2] = 40;
        combined.data[idx + 3] = 255;
      }
    }

    // Copy images
    this.copyImageRegion(img1, combined, 0, 0);
    this.copyImageRegion(img2, combined, width + gap, 0);
    this.copyImageRegion(imgDiff, combined, width * 2 + gap * 2, 0);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, PNG.sync.write(combined));
  }

  /**
   * Copy a region from source PNG to destination PNG
   */
  private copyImageRegion(
    src: PNG,
    dest: PNG,
    destX: number,
    destY: number,
  ): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const srcIdx = (src.width * y + x) << 2;
        const destIdx = (dest.width * (destY + y) + (destX + x)) << 2;

        dest.data[destIdx] = src.data[srcIdx];
        dest.data[destIdx + 1] = src.data[srcIdx + 1];
        dest.data[destIdx + 2] = src.data[srcIdx + 2];
        dest.data[destIdx + 3] = src.data[srcIdx + 3];
      }
    }
  }
}
