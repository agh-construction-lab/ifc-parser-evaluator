import fs from "fs";
import path from "path";

function getAbsolutePath(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);

  const isDirectory = relativePath.endsWith(path.sep) || relativePath.endsWith("/");

  console.log(absolutePath, isDirectory)
  const directoryPath = (() => {
    if (isDirectory) {
      return absolutePath;
    } else {
      return path.dirname(absolutePath);
    }
  })();

  if (fs.existsSync(directoryPath) === false) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  return absolutePath;
}

function getInputFilesPaths() {
  const inputDataDirectory = getAbsolutePath("./_input-data/");
  const files = fs.readdirSync(inputDataDirectory).filter((file) => file.endsWith(".ifc"));

  return files.map((file) => path.join(inputDataDirectory, file));
}

export { getAbsolutePath, getInputFilesPaths }
