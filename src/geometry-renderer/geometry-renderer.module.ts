import { Module } from "@nestjs/common";
import { GeometryRendererService } from "./geometry-renderer.service";
import { WebBrowserService } from "./web-browser.service";

@Module({
  providers: [GeometryRendererService, WebBrowserService],
  exports: [GeometryRendererService, WebBrowserService],
})
export class GeometryRendererModule {}
