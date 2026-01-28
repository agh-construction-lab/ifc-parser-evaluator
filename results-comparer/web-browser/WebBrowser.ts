import fs from "fs";
import puppeteer, { Browser, Page } from "puppeteer";

const renderViews = ["front", "left", "right", "top", "perspective"] as const;
type ViewType = (typeof renderViews)[number];

class WebBrowser {
  private browser: Browser | undefined;
  private page: Page | undefined;

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      // headless: false,
      // devtools: true,
      defaultViewport: {
        height: 1000,
        width: 1000,
        deviceScaleFactor: 1,
      },
    });

    this.page = await this.browser.newPage();

    await this.page.goto("http://localhost:3000", { waitUntil: "load" });
  }

  async kill() {
    if (this.browser !== undefined) {
      await this.browser.close();
    }
  }

  async addMesh(ifcData: any) {
    // @ts-expect-error
    await this.page.evaluate(({ ifcData }) => window.addMesh(ifcData), {
      ifcData,
    });
  }

  async setView(view: ViewType) {
    // @ts-expect-error
    await this.page.evaluate(({ view }) => window.setView(view), { view });
  }

  async prepareResultImages(resultFilePath: string) {
    if (this.page === undefined) {
      throw new Error("Page is not initialized");
    }

    const resultFile = JSON.parse(
      fs.readFileSync(resultFilePath, { encoding: "utf-8" }),
    );

    await this.addMesh(resultFile.geometryData);

    const resultImagePathBase = resultFilePath.replace(".json", "");

    for (const view of renderViews) {
      await this.setView(view);
      await this.page.screenshot({
        path: `${resultImagePathBase}-${view}.png`,
      });
    }
  }

  getImagesPaths(resultFilePath: string) {
    const resultImagePathBase = resultFilePath.replace(".json", "");

    return renderViews.map((view) => `${resultImagePathBase}-${view}.png`);
  }

  getViewName(viewIndex: number) {
    return renderViews[viewIndex];
  }
}

export { renderViews, WebBrowser };
