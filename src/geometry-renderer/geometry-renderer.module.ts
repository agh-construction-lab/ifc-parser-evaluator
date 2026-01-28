import { Module } from "@nestjs/common";
import { GeometryRendererService } from "./geometry-renderer.service";

@Module({
  providers: [GeometryRendererService],
  exports: [GeometryRendererService],
})
export class GeometryRendererModule {}
