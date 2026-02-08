/**
 * Minimal @aws-sdk/client-bedrock-runtime replacement for browser.
 * Uses SigV4 signing + fetch + event stream codec directly,
 * skipping the full Smithy middleware stack (~600KB savings).
 *
 * Supports both IAM credentials (SigV4) and API key (bearer token) auth.
 */
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { EventStreamCodec } from '@smithy/eventstream-codec';
import { fromUtf8, toUtf8 } from '@smithy/util-utf8';

const SERVICE = 'bedrock';
const codec = new EventStreamCodec(toUtf8, fromUtf8);

export const DocumentFormat = { HTML:'html', TEXT:'txt', MD:'md', PDF:'pdf', CSV:'csv', DOC:'doc', DOCX:'docx', XLS:'xls', XLSX:'xlsx' };
export const ImageFormat = { PNG:'png', JPEG:'jpeg', GIF:'gif', WEBP:'webp' };

export class ConverseStreamCommand {
  constructor(input) { this.input = input; this.path = `/model/${encodeURIComponent(input.modelId)}/converse-stream`; this.method = 'POST'; }
}

export class ConverseCommand {
  constructor(input) { this.input = input; this.path = `/model/${encodeURIComponent(input.modelId)}/converse`; this.method = 'POST'; }
}

export class BedrockRuntimeClient {
  constructor(opts = {}) {
    const region = opts.region || 'us-east-1';
    this.config = {
      region: typeof region === 'function' ? region : async () => region,
      useFipsEndpoint: async () => false,
      credentials: opts.credentials || null,
      token: opts.token || null,
      customUserAgent: opts.customUserAgent || '',
    };
    this._region = region;
    this._credentials = opts.credentials || null;
    this._token = opts.token || null;
    this._middleware = [];
    this.middlewareStack = { add: (fn, opts) => this._middleware.push(fn) };
  }

  async send(command) {
    const region = typeof this._region === 'function' ? await this._region() : this._region;
    const url = `https://bedrock-runtime.${region}.amazonaws.com${command.path}`;
    const { modelId, ...body } = command.input;
    const bodyStr = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };

    // Resolve credentials (could be static object or provider function)
    const creds = typeof this._credentials === 'function' ? await this._credentials() : this._credentials;
    const token = typeof this._token === 'function' ? await this._token() : this._token;

    if (token?.token) {
      // Bearer token auth (Bedrock API keys)
      headers['Authorization'] = `Bearer ${token.token}`;
    } else if (creds?.accessKeyId) {
      // SigV4 signing
      const signer = new SignatureV4({ service: SERVICE, region, credentials: creds, sha256: Sha256 });
      const signed = await signer.sign({
        method: command.method,
        protocol: 'https:',
        hostname: `bedrock-runtime.${region}.amazonaws.com`,
        path: command.path,
        headers: { ...headers, host: `bedrock-runtime.${region}.amazonaws.com` },
        body: bodyStr,
      });
      Object.assign(headers, signed.headers);
    }

    // Apply middleware (e.g. apiKey bearer token)
    const request = { headers, method: command.method, hostname: `bedrock-runtime.${region}.amazonaws.com`, path: command.path, body: bodyStr };
    for (const mw of this._middleware) {
      await mw((args) => args)({ request });
    }

    const response = await fetch(url, { method: command.method, headers, body: bodyStr });
    if (!response.ok) throw new Error(`Bedrock ${response.status}: ${await response.text()}`);

    if (command instanceof ConverseStreamCommand) {
      return { stream: parseEventStream(response.body) };
    }
    return await response.json();
  }

  destroy() {}
}

async function* parseEventStream(body) {
  const reader = body.getReader();
  let buf = new Uint8Array(0);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const next = new Uint8Array(buf.length + value.length);
    next.set(buf); next.set(value, buf.length);
    buf = next;
    // Event stream messages: 4-byte total length header
    while (buf.length >= 4) {
      const totalLen = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
      if (totalLen < 16 || buf.length < totalLen) break;
      try {
        const msg = codec.decode(buf.slice(0, totalLen));
        const payload = JSON.parse(new TextDecoder().decode(msg.body));
        // Wrap in event-type key like the SDK does
        const eventType = msg.headers[':event-type']?.value;
        if (eventType && payload) yield { [eventType]: payload };
      } catch {}
      buf = buf.slice(totalLen);
    }
  }
}
