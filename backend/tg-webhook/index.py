import json
import os
import subprocess
import sys
import tempfile
import hashlib
import urllib.request
import boto3


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

CHANNELS = [
    {"name": "@optomkross", "url": "https://t.me/optomkross", "id": "@optomkross"},
    {"name": "@kukuzhd2", "url": "https://t.me/kukuzhd2", "id": "@kukuzhd2"},
    {"name": "@xozilka", "url": "https://t.me/+fss9hWn6dwI1MDcy", "id": "xozilka"},
]

VIDEO_DOMAINS = ["youtube.com", "youtu.be", "instagram.com", "tiktok.com", "vk.com", "t.me"]

QUALITY_KEYBOARD = {
    "inline_keyboard": [
        [
            {"text": "🎵 Аудио (~5 МБ)", "callback_data": "dl:audio"},
        ],
        [
            {"text": "📱 480p (~50 МБ)", "callback_data": "dl:480p"},
            {"text": "🎬 720p (~100 МБ)", "callback_data": "dl:720p"},
        ],
        [
            {"text": "🖥 1080p (~200 МБ)", "callback_data": "dl:1080p"},
            {"text": "4K (~800 МБ)", "callback_data": "dl:2160p"},
        ],
    ]
}


def tg_api(method: str, payload: dict):
    token = os.environ['TELEGRAM_BOT_TOKEN']
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def send_message(chat_id, text: str, reply_markup=None, parse_mode="HTML"):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return tg_api("sendMessage", payload)


def edit_message(chat_id, message_id, text: str):
    return tg_api("editMessageText", {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
    })


def answer_callback(callback_query_id: str, text: str = ""):
    tg_api("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


def check_subscriptions(user_id: int) -> list[dict]:
    token = os.environ['TELEGRAM_BOT_TOKEN']
    not_subscribed = []
    for ch in CHANNELS:
        try:
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{token}/getChatMember?chat_id={ch['id']}&user_id={user_id}"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            status = data.get("result", {}).get("status", "")
            if status not in ("member", "administrator", "creator"):
                not_subscribed.append(ch)
        except Exception:
            not_subscribed.append(ch)
    return not_subscribed


def get_format_and_ext(quality: str) -> tuple[str, str]:
    formats = {
        'audio': ('bestaudio[ext=m4a]/bestaudio', 'm4a'),
        '2160p': ('bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]', 'mp4'),
        '1080p': ('bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]', 'mp4'),
        '720p': ('bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]', 'mp4'),
        '480p': ('bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]', 'mp4'),
    }
    return formats.get(quality, formats['1080p'])


def get_ytdlp_cmd() -> list[str]:
    return [sys.executable, '-m', 'yt_dlp']


def upload_to_s3(file_path: str, s3_key: str, content_type: str, filename: str) -> str:
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


def download_and_send(chat_id, video_url: str, quality: str, status_message_id=None):
    if status_message_id:
        edit_message(chat_id, status_message_id, "⏳ Скачиваю видео, подожди немного...")
    else:
        msg = send_message(chat_id, "⏳ Скачиваю видео, подожди немного...")
        status_message_id = msg.get("result", {}).get("message_id")

    ytdlp_cmd = get_ytdlp_cmd()
    fmt, ext = get_format_and_ext(quality)
    is_audio = quality == 'audio'

    with tempfile.TemporaryDirectory() as tmp_dir:
        output_path = os.path.join(tmp_dir, 'video.%(ext)s')

        title_result = subprocess.run(
            [*ytdlp_cmd, '--get-title', '--no-playlist', video_url],
            capture_output=True, text=True, timeout=30
        )
        title = title_result.stdout.strip() or 'video'
        safe_title = ''.join(c for c in title if c.isalnum() or c in ' _-').strip()[:80] or 'video'

        dl_result = subprocess.run(
            [*ytdlp_cmd, '--format', fmt, '--merge-output-format', ext,
             '--output', output_path, '--no-playlist', '--max-filesize', '500m', video_url],
            capture_output=True, timeout=300
        )

        if dl_result.returncode != 0:
            if status_message_id:
                edit_message(chat_id, status_message_id,
                             "❌ Не удалось скачать видео. Проверь ссылку и попробуй снова.")
            else:
                send_message(chat_id, "❌ Не удалось скачать видео. Проверь ссылку и попробуй снова.")
            return

        actual_file = None
        for fname in os.listdir(tmp_dir):
            actual_file = os.path.join(tmp_dir, fname)
            break

        if not actual_file:
            send_message(chat_id, "❌ Файл не найден после скачивания.")
            return

        file_ext = os.path.splitext(actual_file)[1].lstrip('.') or ext
        file_id = hashlib.md5(video_url.encode()).hexdigest()[:12]
        s3_key = f'videos/{file_id}_{quality}.{file_ext}'
        content_type = 'audio/mp4' if file_ext == 'm4a' else 'video/mp4'
        filename = f'{safe_title}.{file_ext}'

        cdn_url = upload_to_s3(actual_file, s3_key, content_type, filename)

    token = os.environ['TELEGRAM_BOT_TOKEN']
    base = f"https://api.telegram.org/bot{token}"

    if is_audio:
        payload = {
            "chat_id": chat_id,
            "audio": cdn_url,
            "title": title,
            "caption": f"🎵 {title}",
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(f"{base}/sendAudio", data=data, headers={"Content-Type": "application/json"})
    else:
        payload = {
            "chat_id": chat_id,
            "video": cdn_url,
            "caption": f"🎬 {title}",
            "supports_streaming": True,
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(f"{base}/sendVideo", data=data, headers={"Content-Type": "application/json"})

    with urllib.request.urlopen(req, timeout=60):
        pass

    if status_message_id:
        tg_api("deleteMessage", {"chat_id": chat_id, "message_id": status_message_id})


def is_video_url(text: str) -> bool:
    return any(domain in text for domain in VIDEO_DOMAINS)


def build_subscribe_keyboard() -> dict:
    buttons = [[{"text": f"📢 {ch['name']}", "url": ch['url']}] for ch in CHANNELS]
    buttons.append([{"text": "✅ Я подписался — проверить", "callback_data": "check_sub"}])
    return {"inline_keyboard": buttons}


def handler(event: dict, context) -> dict:
    """Telegram webhook: обрабатывает входящие сообщения и callback-кнопки бота."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')

    if 'callback_query' in body:
        cq = body['callback_query']
        cq_id = cq['id']
        chat_id = cq['message']['chat']['id']
        user_id = cq['from']['id']
        data = cq.get('data', '')
        message_id = cq['message']['message_id']

        answer_callback(cq_id)

        if data == 'check_sub':
            not_sub = check_subscriptions(user_id)
            if not_sub:
                names = ", ".join(ch['name'] for ch in not_sub)
                edit_message(chat_id, message_id,
                             f"❌ Ты ещё не подписан на: {names}\n\nПодпишись и нажми кнопку снова.")
            else:
                tg_api("deleteMessage", {"chat_id": chat_id, "message_id": message_id})
                send_message(chat_id,
                             "✅ Отлично! Теперь пришли ссылку на видео (YouTube, Instagram, TikTok и др.), "
                             "и я его скачаю.")

        elif data.startswith('dl:'):
            quality = data[3:]
            original_msg = cq['message'].get('reply_to_message') or cq['message']
            video_url = original_msg.get('text', '')

            if not is_video_url(video_url):
                send_message(chat_id, "❌ Не могу найти ссылку. Пришли видео ещё раз.")
                return {'statusCode': 200, 'headers': CORS, 'body': ''}

            tg_api("deleteMessage", {"chat_id": chat_id, "message_id": message_id})
            download_and_send(chat_id, video_url, quality)

        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    message = body.get('message', {})
    if not message:
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    chat_id = message['chat']['id']
    user_id = message['from']['id']
    text = (message.get('text') or '').strip()
    first_name = message['from'].get('first_name', 'друг')

    if text == '/start':
        not_sub = check_subscriptions(user_id)
        if not_sub:
            send_message(
                chat_id,
                f"👋 Привет, {first_name}!\n\n"
                f"Я скачиваю видео с YouTube, Instagram, TikTok и других сайтов.\n\n"
                f"Для использования подпишись на каналы:",
                reply_markup=build_subscribe_keyboard()
            )
        else:
            send_message(
                chat_id,
                f"👋 Привет, {first_name}!\n\n"
                f"Пришли ссылку на видео (YouTube, Instagram, TikTok и др.), и я его скачаю."
            )
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if is_video_url(text):
        not_sub = check_subscriptions(user_id)
        if not_sub:
            send_message(
                chat_id,
                "Для скачивания подпишись на каналы:",
                reply_markup=build_subscribe_keyboard()
            )
            return {'statusCode': 200, 'headers': CORS, 'body': ''}

        send_message(
            chat_id,
            "Выбери качество видео:",
            reply_markup=QUALITY_KEYBOARD
        )
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    send_message(
        chat_id,
        "Пришли ссылку на видео (YouTube, Instagram, TikTok и др.), и я его скачаю."
    )

    return {'statusCode': 200, 'headers': CORS, 'body': ''}