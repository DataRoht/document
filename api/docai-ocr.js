import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import fetch from "node-fetch";

function cleanPrivateKey(key) {
  return (key || "").replace(/\\n/g, "\n");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { pdfUrl, mimeType = "application/pdf" } = req.body || {};
    if (!pdfUrl) {
      return res.status(400).json({ ok: false, error: "pdfUrl is required" });
    }

    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.DOCAI_LOCATION || "us";
    const processorId = process.env.DOCAI_PROCESSOR_ID;

    if (!projectId || !processorId) {
      return res.status(500).json({
        ok: false,
        error: "Missing GCP_PROJECT_ID or DOCAI_PROCESSOR_ID"
      });
    }

    const client = new DocumentProcessorServiceClient({
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: cleanPrivateKey(process.env.GCP_PRIVATE_KEY)
      },
      projectId
    });

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const content = buffer.toString("base64");

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content,
        mimeType
      }
    });

    const document = result.document;

    return res.status(200).json({
      ok: true,
      text: document?.text || "",
      pageCount: document?.pages?.length || 0
    });

  } catch (err) {
    console.error("docai-ocr error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
}
