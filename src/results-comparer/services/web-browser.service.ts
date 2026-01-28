import { Injectable, Logger } from "@nestjs/common";

const RENDER_VIEWS = ["front", "left", "right", "top", "perspective"] as const;
type ViewType = (typeof RENDER_VIEWS)[number];

@Injectable()
export class WebBrowserService {
  private readonly logger = new Logger(WebBrowserService.name);

  /**
   * Initialize headless browser instance
   */
  async init(): Promise<void> {
    // TODO: Implement puppeteer initialization
    // See _original/results-comparer/web-browser/WebBrowser.ts
    // throw new Error("Not implemented");
    return Promise.resolve();
  }

  /**
   * Close browser instance
   */
  async kill(): Promise<void> {
    // TODO: Implement browser cleanup
    return Promise.resolve();
  }

  /**
   * Add mesh to the 3D scene
   */
  async addMesh(ifcData: unknown): Promise<void> {
    // TODO: Implement mesh addition via page.evaluate
    console.log(ifcData);
    return Promise.resolve();
  }

  /**
   * Set camera view
   */
  async setView(view: ViewType): Promise<void> {
    // TODO: Implement view change via page.evaluate
    console.log(view);
    return Promise.resolve();
  }

  /**
   * Prepare result images for a given result file
   */
  async prepareResultImages(resultFilePath: string): Promise<void> {
    // TODO: Implement screenshot generation for all views
    console.log(resultFilePath);
    return Promise.resolve();
  }

  /**
   * Get paths to generated images for a result file
   */
  getImagesPaths(resultFilePath: string): Array<string> {
    const resultImagePathBase = resultFilePath.replace(".json", "");
    return RENDER_VIEWS.map((view) => `${resultImagePathBase}-${view}.png`);
  }

  getViewName(viewIndex: number): ViewType {
    return RENDER_VIEWS[viewIndex];
  }
}

export { RENDER_VIEWS, type ViewType };
