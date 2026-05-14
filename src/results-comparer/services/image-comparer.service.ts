import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import {
  ImageComparison,
  ImageParserPairComparison,
  ImageParserOption,
  ImageViewComparison,
} from "../types/comparison.types";
import {
  getCanonicalParserPairKey,
  getParserPairDirectoryName,
} from "../utils/parser-ids";

type ParserImageInput = ImageParserOption & {
  resultDir: string;
};

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
      const match = pixelDiffPercentage < 1; // 1% tolerance threshold

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

  buildPairwiseComparisons(
    parsers: Array<ParserImageInput>,
    diffOutputDir: string,
    views: Array<string>,
  ): ImageComparison {
    const parserOptions: Array<ImageParserOption> = parsers.map(
      ({ parserId, parserName, parserVersion }) => ({
        parserId,
        parserName,
        parserVersion,
      }),
    );

    if (parsers.length < 2) {
      return {
        views: [],
        parserOptions,
      };
    }

    const pairComparisons: Array<ImageParserPairComparison> = [];

    for (let i = 0; i < parsers.length - 1; i++) {
      for (let j = i + 1; j < parsers.length; j++) {
        const parserA = parsers[i];
        const parserB = parsers[j];
        const pairDiffOutputDir = path.join(
          diffOutputDir,
          getParserPairDirectoryName(parserA.parserId, parserB.parserId),
        );

        pairComparisons.push({
          pairKey: getCanonicalParserPairKey(parserA.parserId, parserB.parserId),
          parserIds: [parserA.parserId, parserB.parserId] as [string, string],
          views: this.compareAllViews(
            parserA.resultDir,
            parserB.resultDir,
            pairDiffOutputDir,
            views,
          ),
        });
      }
    }

    return {
      views: pairComparisons[0]?.views ?? [],
      parserOptions,
      defaultLeftParserId: parsers[0].parserId,
      defaultRightParserId: parsers[1].parserId,
      pairComparisons,
    };
  }

}
