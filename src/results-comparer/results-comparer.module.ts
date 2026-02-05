import { Module } from "@nestjs/common";
import { ResultsComparerService } from "./results-comparer.service";
import { ImageComparerService } from "./services/image-comparer.service";
import { ComparisonService } from "./services/comparison.service";
import { ReportGeneratorService } from "./services/report-generator.service";
import { GeometryRendererModule } from "../geometry-renderer/geometry-renderer.module";

@Module({
  imports: [GeometryRendererModule],
  providers: [
    ResultsComparerService,
    ImageComparerService,
    ComparisonService,
    ReportGeneratorService,
  ],
  exports: [
    ResultsComparerService,
    ComparisonService,
    ImageComparerService,
    ReportGeneratorService,
  ],
})
export class ResultsComparerModule {}
