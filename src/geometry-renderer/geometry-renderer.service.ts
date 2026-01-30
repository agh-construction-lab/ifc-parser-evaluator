import { Injectable, Logger } from "@nestjs/common";
import express, { Express } from "express";
import { Server } from "http";
import * as path from "path";

const PORT = 3000;

@Injectable()
export class GeometryRendererService {
  private readonly logger = new Logger(GeometryRendererService.name);
  private app: Express | null = null;
  private server: Server | null = null;

  /**
   * Starts the geometry rendering server
   * @returns Promise with kill function to stop the server
   */
  async runServer(): Promise<{ kill: () => Promise<void> }> {
    this.app = express();

    const staticDirectory = path.join(__dirname, "public");
    this.app.use(express.static(staticDirectory));

    this.app.get("/", (_req, res) => {
      res.sendFile(path.join(staticDirectory, "index.html"));
    });

    return new Promise((resolve) => {
      this.server = this.app!.listen(PORT, () => {
        this.logger.log(`Geometry renderer server listening on port: ${PORT}`);
        this.logger.log(`Open http://localhost:${PORT} in your browser`);

        resolve({
          kill: () => this.stopServer(),
        });
      });
    });
  }

  /**
   * Stops the geometry rendering server
   */
  private stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server === null) {
        return reject(new Error("Server is not running"));
      }

      this.server.close((err) => {
        if (err) {
          this.logger.error("Error closing server:", err);
          return reject(err);
        }

        this.logger.log("Geometry renderer server closed");
        this.server = null;
        this.app = null;
        resolve();
      });
    });
  }

  /**
   * Returns the server URL
   */
  getServerUrl(): string {
    return `http://localhost:${PORT}`;
  }
}
