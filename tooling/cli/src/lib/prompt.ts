import { createInterface } from "node:readline";

/**
 * Asks for a value without echoing it. Needs an interactive terminal — a value must be typed
 * by a person, never passed as an argument or piped from a file.
 */
export async function askHidden(question: string): Promise<string | null> {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const output = rl as unknown as { _writeToOutput: (text: string) => void };
  let muted = false;
  output._writeToOutput = (text) => {
    if (!muted) process.stdout.write(text);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = true;
  });
}
