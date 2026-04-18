import json
import os
import subprocess
import tempfile
import hashlib
import boto3
import urllib.request

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_format_and_ext(quality: str) -> tuple[str, str]:
    """Возвращает формат yt-dlp и расширение файла по качеству."""
    formats = {
        'audio': ('bestaudio[ext=m4a]/bestaudio', 'm4a'),
        '2160p': ('bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]', 'mp4'),
        '720p': ('bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]', 'mp4'),
        '480p': ('bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]', 'mp4'),
        '1080p': ('bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]', 'mp4'),
    }
    return formats.get(quality, formats['1080p'])


def ensure_ytdlp() -> str:
    """Скачивает yt-dlp в /tmp если ещё нет."""
    bin_path = '/tmp/yt-dlp'
    if not os.path.exists(bin_path):
        subprocess.run(
            ['curl', '-fL', 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', '-o', bin_path],
            check=True, timeout=60
        )
        os.chmod(bin_path, 0o755)
    return bin_path


def upload_to_s3(file_path: str, s3_key: str, content_type: str, filename: str) -> str:
    """Загружает файл на S3 и возвращает CDN URL."""
    access_key = os.environ['AWS_ACCESS_KEY_ID']
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=access_key,
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    with open(file_path, 'rb') as f:
        s3.put_object(
            Bucket='files',
            Key=s3_key,
            Body=f,
            ContentType=content_type,
            ContentDisposition=f'attachment; filename="{filename}"',
        )
    return f"https://cdn.poehali.dev/projects/{access_key}/bucket/{s3_key}"


def send_to_telegram(chat_id: str, cdn_url: str, filename: str, title: str, is_audio: bool):
    """Отправляет файл пользователю через Telegram Bot API. v3"""
    token = os.environ['TELEGRAM_BOT_TOKEN']
    base = f"https://api.telegram.org/bot{token}"

    if is_audio:
        method = "sendAudio"
        payload = {
            "chat_id": chat_id,
            "audio": cdn_url,
            "title": title,
            "caption": f"🎵 {title}",
        }
    else:
        method = "sendVideo"
        payload = {
            "chat_id": chat_id,
            "video": cdn_url,
            "caption": f"🎬 {title}",
            "supports_streaming": True,
        }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{base}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def notify_telegram(chat_id: str, text: str):
    """Отправляет текстовое сообщение пользователю."""
    token = os.environ['TELEGRAM_BOT_TOKEN']
    payload = {"chat_id": chat_id, "text": text}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    """Скачивает YouTube видео и отправляет файл пользователю в Telegram."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    video_url = (body.get('url') or '').strip()
    quality = body.get('quality') or '1080p'
    chat_id = str(body.get('chat_id') or '').strip()

    if not video_url:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'URL обязателен'})}

    if not chat_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'chat_id обязателен'})}

    if chat_id != 'test':
        notify_telegram(chat_id, "⏳ Скачиваю видео, подожди немного...")

    ytdlp = ensure_ytdlp()
    fmt, ext = get_format_and_ext(quality)
    is_audio = quality == 'audio'

    with tempfile.TemporaryDirectory() as tmp_dir:
        output_path = os.path.join(tmp_dir, 'video.%(ext)s')

        title_result = subprocess.run(
            [ytdlp, '--get-title', '--no-playlist', video_url],
            capture_output=True, text=True, timeout=30
        )
        title = title_result.stdout.strip() or 'video'
        safe_title = ''.join(c for c in title if c.isalnum() or c in ' _-').strip()[:80] or 'video'

        dl_result = subprocess.run(
            [ytdlp, '--format', fmt, '--merge-output-format', ext,
             '--output', output_path, '--no-playlist', '--max-filesize', '500m', video_url],
            capture_output=True, timeout=300
        )

        if dl_result.returncode != 0:
            if chat_id != 'test':
                notify_telegram(chat_id, "❌ Не удалось скачать видео. Проверь ссылку и попробуй снова.")
            return {
                'statusCode': 422,
                'headers': CORS,
                'body': json.dumps({'error': 'Не удалось скачать видео. Проверьте ссылку.'})
            }

        actual_file = None
        for fname in os.listdir(tmp_dir):
            actual_file = os.path.join(tmp_dir, fname)
            break

        if not actual_file:
            return {'statusCode': 422, 'headers': CORS, 'body': json.dumps({'error': 'Файл не найден'})}

        file_ext = os.path.splitext(actual_file)[1].lstrip('.') or ext
        file_id = hashlib.md5(video_url.encode()).hexdigest()[:12]
        s3_key = f'videos/{file_id}.{file_ext}'
        content_type = 'audio/mp4' if file_ext == 'm4a' else 'video/mp4'
        filename = f'{safe_title}.{file_ext}'

        cdn_url = upload_to_s3(actual_file, s3_key, content_type, filename)

    if chat_id != 'test':
        send_to_telegram(chat_id, cdn_url, filename, title, is_audio)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'url': cdn_url, 'title': title, 'filename': filename}),
    }