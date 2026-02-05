import { Injectable, Logger } from "@nestjs/common";
import { ImageComparerService } from "./services/image-comparer.service";
import { WebBrowserService } from "../geometry-renderer/web-browser.service";
import { GeometryRendererService } from "../geometry-renderer/geometry-renderer.service";

@Injectable()
export class ResultsComparerService {
  private readonly logger = new Logger(ResultsComparerService.name);

  constructor(
    private readonly imageComparer: ImageComparerService,
    private readonly webBrowser: WebBrowserService,
    private readonly geometryRenderer: GeometryRendererService,
  ) {}

  /**
   * Compare results from different parsers
   * @param webIfcResultsDir Directory with web-ifc results
   * @param ifcOpenShellResultsDir Directory with IfcOpenShell results
   */
  async compareResults(
    webIfcResultsDir: string,
    ifcOpenShellResultsDir: string,
  ): Promise<void> {
    // TODO: Implement results comparison logic
    // See _original/results-comparer/index.ts
    // throw new Error("Not implemented");
    return Promise.resolve();
  }
}
