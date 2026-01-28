import path from "path";
import fs from "fs";

class ResultsFile<T extends readonly string[]> {
  private filePath: string;
  private lines: Array<string> = [];

  constructor({ filePath }: { filePath: string }) {
    this.filePath = filePath;
  }

  public addRow(cells: T): void {
    this.lines.push(cells.join("\t"));
  }

  public save(): void {
    const directoryPath = path.dirname(this.filePath);

    if (fs.existsSync(directoryPath) === false) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(this.filePath, this.lines.join("\n"), { encoding: "utf-8" });
  }
}

export { ResultsFile }
