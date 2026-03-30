import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import puppeteer, { Browser, Page } from "puppeteer";

const RENDER_VIEWS = ["front", "left", "right", "top", "perspective"] as const;
type ViewType = (typeof RENDER_VIEWS)[number];

// Extend Window interface for TypeScript
declare global {
  interface Window {
    addMesh: (data: unknown) => void;
    setView: (view: string) => void;
  }
}

@Injectable()
export class WebBrowserService {
  private readonly logger = new Logger(WebBrowserService.name);
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Initialize headless browser instance
   */
  async init(serverUrl: string): Promise<void> {
    this.logger.log("Initializing headless browser...");

    const isRunningAsRoot =
      typeof process.getuid === "function" && process.getuid() === 0;
    const shouldDisableSandbox =
      process.env["PUPPETEER_NO_SANDBOX"] === "true" || isRunningAsRoot;

    this.browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      executablePath: process.env["PUPPETEER_EXECUTABLE_PATH"],
      args: shouldDisableSandbox
        ? ["--no-sandbox", "--disable-setuid-sandbox"]
        : [],
      defaultViewport: {
        height: 1000,
        width: 1000,
        deviceScaleFactor: 1,
      },
    });

    this.page = await this.browser.newPage();

    // Enable console logging from the page
    this.page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.logger.error(`Browser: ${msg.text()}`);
      }
    });

    await this.page.goto(serverUrl, { waitUntil: "networkidle0" });
    this.logger.log("Browser initialized and page loaded");
  }

  /**
   * Close browser instance
   */
  async kill(): Promise<void> {
    if (this.browser !== null) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.logger.log("Browser closed");
    }
  }

  /**
   * Add mesh to the 3D scene
   */
  async addMesh(geometriesData: unknown): Promise<void> {
    if (this.page === null) {
      throw new Error("Page is not initialized");
    }

    await this.page.evaluate(
      (data) => {
        window.addMesh(data);
      },
      geometriesData as Parameters<typeof this.page.evaluate>[1],
    );
  }

  /**
   * Set camera view
   */
  async setView(view: ViewType): Promise<void> {
    if (this.page === null) {
      throw new Error("Page is not initialized");
    }

    await this.page.evaluate((v) => {
      window.setView(v);
    }, view);

    // Wait for render to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Take screenshot of current view
   */
  async takeScreenshot(outputPath: string): Promise<void> {
    if (this.page === null) {
      throw new Error("Page is not initialized");
    }

    await this.page.screenshot({ path: outputPath });
  }

  /**
   * Prepare result images for a given result file
   */
  async prepareResultImages(resultFilePath: string): Promise<void> {
    if (this.page === null) {
      throw new Error("Page is not initialized");
    }

    this.logger.log(`Generating screenshots for: ${resultFilePath}`);

    const resultFile = JSON.parse(
      fs.readFileSync(resultFilePath, { encoding: "utf-8" }),
    ) as { geometries?: unknown; geometryData?: unknown };

    // Support both new format (geometries) and old format (geometryData)
    const geometriesData = resultFile.geometries ?? resultFile.geometryData;

    if (!geometriesData) {
      this.logger.warn(`No geometry data found in ${resultFilePath}`);
      return;
    }

    await this.addMesh(geometriesData);

    // Get directory path (JSON is in subdirectory named after IFC file)
    const resultDir = resultFilePath.substring(0, resultFilePath.lastIndexOf("/"));

    for (const view of RENDER_VIEWS) {
      await this.setView(view);
      const imagePath = `${resultDir}/${view}.png`;
      await this.takeScreenshot(imagePath);
      this.logger.debug(`Screenshot saved: ${imagePath}`);
    }

    this.logger.log(
      `Generated ${RENDER_VIEWS.length} screenshots for ${resultFilePath}`,
    );
  }

  /**
   * Get paths to generated images for a result file
   */
  getImagesPaths(resultFilePath: string): Array<string> {
    const resultDir = resultFilePath.substring(0, resultFilePath.lastIndexOf("/"));
    return RENDER_VIEWS.map((view) => `${resultDir}/${view}.png`);
  }

  getViewName(viewIndex: number): ViewType {
    return RENDER_VIEWS[viewIndex];
  }
}

export { RENDER_VIEWS, type ViewType };
