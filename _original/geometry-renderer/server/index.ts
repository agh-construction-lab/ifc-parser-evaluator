import express from "express";
import { getAbsolutePath } from "../../core/pathUtils.ts";

const runServer = async () => {
  const app = express();
  const PORT = 3000;

  const staticDirectory = getAbsolutePath("./geometry-renderer/server/public");

  app.use(express.static(staticDirectory));

  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  const server = app.listen(PORT, () =>
    console.log(`Server listening on port: ${PORT}`),
  );

  const kill = () =>
    new Promise((resolve, reject) => {
      if (server === null) {
        return reject(0);
      }

      server.close(() => {
        console.log("Server closed");
        resolve(0);
      });
    });

  return { kill };
}


export { runServer };
