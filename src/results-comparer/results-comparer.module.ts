import { Module } from "@nestjs/common";
import { ResultsComparerService } from "./results-comparer.service";
import { ImageComparerService } from "./services/image-comparer.service";
import { WebBrowserService } from "./services/web-browser.service";
import { GeometryRendererModule } from "../geometry-renderer/geometry-renderer.module";

@Module({
  imports: [GeometryRendererModule],
  providers: [ResultsComparerService, ImageComparerService, WebBrowserService],
  exports: [ResultsComparerService],
})
export class ResultsComparerModule {}
