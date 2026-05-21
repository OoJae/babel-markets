// Irys client for pinning reasoning traces to IPFS / Arweave.
// Content-addressed permanence is the Protocol Labs judge hook from the playbook.
//
// The synced Circle docs don't cover Irys; we follow the public @irys/upload docs.
// Wire up the actual Uploader inside an async factory because @irys/upload pulls
// in node-only deps that the Next.js bundler would otherwise yell about.

let cached: Awaited<ReturnType<typeof buildUploader>> | null = null;

async function buildUploader() {
  // Dynamic import keeps the Irys SDK out of the client bundle.
  // The cast through `any` works around a known version-mismatch between
  // @irys/upload and @irys/upload-ethereum where the inner @irys/upload-core dep
  // is duplicated and the structural type check fails despite runtime compat.
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");

  if (!process.env.IRYS_PRIVATE_KEY) {
    throw new Error("IRYS_PRIVATE_KEY is required to pin reasoning traces");
  }

  return await (Uploader as any)(Ethereum).withWallet(process.env.IRYS_PRIVATE_KEY);
}

export async function getIrysUploader() {
  if (cached) return cached;
  cached = await buildUploader();
  return cached;
}

export async function pinReasoningTrace(trace: object): Promise<string> {
  const uploader = await getIrysUploader();
  const tags = [
    { name: "Content-Type", value: "application/json" },
    { name: "App-Name", value: "Babel-Markets" },
    { name: "Trace-Kind", value: "agent-reasoning" },
  ];
  const receipt = await uploader.upload(JSON.stringify(trace), { tags });
  return receipt.id;
}
