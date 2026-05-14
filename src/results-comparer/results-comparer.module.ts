import { Module } from "@nestjs/common";
import { ImageComparerService } from "./services/image-comparer.service";
import { ComparisonService } from "./services/comparison.service";
import { ReportGeneratorService } from "./services/report-generator.service";
import { ChartExportService } from "./services/chart-export.service";
import { GeometryRendererModule } from "../geometry-renderer/geometry-renderer.module";

@Module({
  imports: [GeometryRendererModule],
  providers: [
    ImageComparerService,
    ComparisonService,
    ReportGeneratorService,
    ChartExportService,
  ],
  exports: [
    ComparisonService,
    ImageComparerService,
    ReportGeneratorService,
    ChartExportService,
  ],
})
export class ResultsComparerModule {}
