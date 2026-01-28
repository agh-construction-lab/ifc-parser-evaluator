import fs from "fs";
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { Jimp, loadFont, measureText, measureTextHeight } from "jimp";
import { SANS_32_BLACK } from "jimp/fonts";

class ImageComparer {
  getBase64(imagePath: string) {
    const image = fs.readFileSync(imagePath, { encoding: "base64" });
    return image;
  }

  areEqual = (imagePathA: string, imagePathB: string) => {
    const imageA = this.getBase64(imagePathA);
    const imageB = this.getBase64(imagePathB);

    return imageA === imageB;
  };

  public async createDifferenceMap(imagePathA: string, imagePathB: string, imagesDifferencePath: string) {
    const img1 = PNG.sync.read(fs.readFileSync(imagePathA));
    const img2 = PNG.sync.read(fs.readFileSync(imagePathB));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.0 });

    const buf1 = PNG.sync.write(img1);
    const buf2 = PNG.sync.write(img2);
    const bufD = PNG.sync.write(diff);
    const [j1, j2, jd] = await Promise.all([
      Jimp.read(buf1),
      Jimp.read(buf2),
      Jimp.read(bufD),
    ]);

    const gap = 64;

    const labelH = 64;
    // const finalW = width * 3;
    const finalW = width * 3 + gap * 2;

    const finalH = height + labelH;
    const totalBytes = finalW * finalH * 4;
    const final = new Jimp({
      height: finalH,
      width: finalW,
      data: Buffer.alloc(totalBytes, 0xeeeeee)
    });

    final.composite(j1, 0, labelH);
    final.composite(j2, width + gap, labelH);
    final.composite(jd, width * 2 + gap * 2, labelH);

    const font = await loadFont(SANS_32_BLACK);

    function printLabel(imageId: number, text: string) {
      const xOffset = imageId * (width + gap);
      const x = xOffset + width / 2 - measureText(font, text) / 2;
      const y = labelH / 2 - measureTextHeight(font, text, width) / 2;
      final.print({ font, x, y, text });
    }

    printLabel(0, "web-ifc");
    printLabel(1, "IfcOpenShell");
    printLabel(2, "Difference between rendered wireframes");

    // await final.write(imagesDifferencePath as `${string}.${string}`);

    const differenceImage = new Jimp({ width, height });
    differenceImage.composite(jd, 0, 0);
    await differenceImage.write(imagesDifferencePath as `${string}.${string}`);
  }

}

export { ImageComparer };
