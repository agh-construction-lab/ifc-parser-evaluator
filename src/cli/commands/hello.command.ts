import { Command, CommandRunner } from "nest-commander";
import { HelloService } from "../../hello/hello.service";

@Command({
  name: "hello",
  description: "Prints hello world",
})
export class HelloCommand extends CommandRunner {
  constructor(private readonly hello: HelloService) {
    super();
  }

  async run(_: Array<string>, options?: { name?: string }): Promise<void> {
    console.log(this.hello.say(options?.name));
    return Promise.resolve();
  }
}
