import * as path from "node:path";
import * as fs from "node:fs";

class ResultsFile<T extends readonly string[]> {
  private filePath: string;
  private lines: Array<string> = [];

  constructor({ filePath }: { filePath: string }) {
    this.filePath = filePath;
  }

  addRow(cells: T): void {
    this.lines.push(cells.join("\t"));
  }

  save(): void {
    const directoryPath = path.dirname(this.filePath);

    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(this.filePath, this.lines.join("\n"), {
      encoding: "utf-8",
    });
  }
}

export { ResultsFile };
