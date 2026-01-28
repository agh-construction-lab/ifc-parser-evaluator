import { Injectable } from "@nestjs/common";

@Injectable()
export class HelloService {
  say(name?: string) {
    const who = (name ?? "").trim() || "world";
    return `Hello, ${who}!`;
  }
}
