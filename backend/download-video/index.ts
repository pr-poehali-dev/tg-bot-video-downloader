import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface Event {
  httpMethod: string;
  body?: string;
}

interface HandlerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function getFormatAndExt(quality: string): { format: string; ext: string } {
  switch (quality) {
    case 'audio': return { format: 'bestaudio[ext=m4a]/bestaudio', ext: 'm4a' };
    case '2160p': return { format: 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]', ext: 'mp4' };
    case '720p':  return { format: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]', ext: 'mp4' };
    case '480p':  return { format: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]', ext: 'mp4' };
    default:      return { format: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]', ext: 'mp4' };
  }
}

function ensureYtDlp(): string {
  const binPath = '/tmp/yt-dlp';
  if (!fs.existsSync(binPath)) {
    execSync(
      `curl -fL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${binPath} && chmod +x ${binPath}`,
      { timeout: 60000 }
    );
  }
  return binPath;
}

function hmacSha256(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function uploadToS3(fileBuffer: Buffer, s3Key: string, contentType: string, filename: string): Promise<string> {
  const accessKey = process.env.AWS_ACCESS_KEY_ID ?? '';
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
  const host = 'bucket.poehali.dev';
  const region = 'us-east-1';
  const service = 's3';
  const bucket = 'files';

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateShort = dateStr.slice(0, 8);

  const payloadHash = sha256Hex(fileBuffer);
  const canonicalUri = `/${bucket}/${s3Key}`;
  const disposition = `attachment; filename="${filename}"`;
  const canonicalHeaders = [
    `content-disposition:${disposition}`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${dateStr}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-disposition;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateStr, credentialScope, sha256Hex(Buffer.from(canonicalRequest))].join('\n');

  const kDate = hmacSha256(Buffer.from(`AWS4${secretKey}`), dateShort);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: canonicalUri,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': fileBuffer.length,
        'x-amz-date': dateStr,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authHeader,
      },
    }, (res) => {
      if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
        resolve(`https://cdn.poehali.dev/projects/${accessKey}/bucket/${s3Key}`);
      } else {
        let errBody = '';
        res.on('data', (chunk: Buffer) => { errBody += chunk.toString(); });
        res.on('end', () => reject(new Error(`S3 ${res.statusCode}: ${errBody}`)));
      }
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

export async function handler(event: Event): Promise<HandlerResponse> {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const body = JSON.parse(event.body || '{}') as { url?: string; quality?: string };
  const videoUrl = (body.url || '').trim();
  const quality = body.quality || '1080p';

  if (!videoUrl) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'URL обязателен' }) };
  }

  const ytdlp = ensureYtDlp();
  const { format, ext } = getFormatAndExt(quality);
  const fileId = Math.random().toString(36).slice(2);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
  const outputPath = path.join(tmpDir, `${fileId}.${ext}`);

  const titleResult = spawnSync(ytdlp, ['--get-title', '--no-playlist', videoUrl], { timeout: 30000 });
  const title = titleResult.stdout?.toString().trim() || 'video';

  const dlResult = spawnSync(
    ytdlp,
    ['--format', format, '--merge-output-format', ext, '--output', outputPath, '--no-playlist', '--max-filesize', '500m', videoUrl],
    { timeout: 300000 }
  );

  if (dlResult.status !== 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return { statusCode: 422, headers: CORS, body: JSON.stringify({ error: 'Не удалось скачать видео. Проверьте ссылку.' }) };
  }

  const fileBuffer = fs.readFileSync(outputPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const s3Key = `videos/${fileId}.${ext}`;
  const contentType = ext === 'm4a' ? 'audio/mp4' : 'video/mp4';
  const cdnUrl = await uploadToS3(fileBuffer, s3Key, contentType, `${title}.${ext}`);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ url: cdnUrl, title, filename: `${title}.${ext}` }),
  };
}
