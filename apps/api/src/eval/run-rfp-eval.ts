import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fieldAccuracy } from "@se-grants/shared";

/**
 * Manual check. Not part of CI. Set ANTHROPIC_API_KEY and place PDF/expected JSON
 * pairs in apps/api/test/fixtures/rfps before changing the parse prompt or model.
 */
async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "eval:rfp skipped. Set ANTHROPIC_API_KEY to score fixture PDFs. This is not run in CI.",
    );
    return;
  }
  const dir = join(process.cwd(), "test/fixtures/rfps");
  const pdfs = readdirSync(dir).filter((name) => name.endsWith(".pdf"));
  if (pdfs.length === 0) {
    console.log("eval:rfp found no PDFs in apps/api/test/fixtures/rfps.");
    return;
  }
  const model = process.env.AI_MODEL_DEFAULT;
  if (!model) {
    console.log("Set AI_MODEL_DEFAULT before running eval:rfp.");
    return;
  }
  const { AnthropicAiProvider } = await import("../common/ai/ai.provider");
  const provider = new AnthropicAiProvider(process.env.ANTHROPIC_API_KEY);
  for (const pdfName of pdfs) {
    const expectedPath = join(dir, pdfName.replace(/\.pdf$/, ".expected.json"));
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as unknown;
    const pdf = readFileSync(join(dir, pdfName));
    const parsed = await provider.parseRfp({ model, pdf });
    const report = fieldAccuracy(expected, parsed.output);
    const percent = report.total === 0 ? 0 : Math.round((report.matched / report.total) * 100);
    console.log(`${pdfName}: ${percent}% (${report.matched}/${report.total})`);
    for (const miss of report.misses.slice(0, 20)) console.log(`  ${miss}`);
  }
}

void main();
