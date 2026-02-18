// uploads a file to ipfs via the pinata api
// think of pinata as a post office for ipfs -- we hand them the file,
// they store it on ipfs and give us back the cid (content id)

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

export type UploadResult =
  | { ok: true; cid: string; uri: string }
  | { ok: false; error: string };

// upload a file to pinata and return the ipfs:// uri
export async function uploadToIPFS(file: File): Promise<UploadResult> {
  if (!PINATA_JWT) {
    return {
      ok: false,
      error:
        "missing NEXT_PUBLIC_PINATA_JWT in .env.local -- get a free key at app.pinata.cloud",
    };
  }

  try {
    // pinata's pinFileToIPFS endpoint accepts multipart/form-data
    const form = new FormData();
    form.append("file", file);
    form.append(
      "pinataMetadata",
      JSON.stringify({ name: `pizzapoap-${Date.now()}-${file.name}` })
    );
    // pinataOptions: wrapWithDirectory:false keeps the uri pointing directly to the file
    form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: false }));

    const res = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: form,
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `pinata error ${res.status}: ${text}` };
    }

    const data = await res.json();
    const cid = data.IpfsHash as string;

    return { ok: true, cid, uri: `ipfs://${cid}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "upload failed";
    return { ok: false, error: msg };
  }
}

// resolve an ipfs:// uri to a https:// url for displaying in the browser
// (browsers can't fetch ipfs:// directly, so we use a public gateway)
export function ipfsToHttp(uri: string | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  return uri;
}
