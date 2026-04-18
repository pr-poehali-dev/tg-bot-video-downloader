import { useState } from "react";
import Icon from "@/components/ui/icon";

type Step = "input" | "quality" | "subscribe" | "downloading";

const CHANNELS = [
  { id: 1, name: "@tech_channel", url: "https://t.me/tech_channel", checked: false },
  { id: 2, name: "@music_vibes", url: "https://t.me/music_vibes", checked: false },
  { id: 3, name: "@daily_news", url: "https://t.me/daily_news", checked: false },
];

const QUALITIES = [
  { label: "4K", value: "2160p", size: "~800 МБ" },
  { label: "1080p", value: "1080p", size: "~200 МБ" },
  { label: "720p", value: "720p", size: "~100 МБ" },
  { label: "480p", value: "480p", size: "~50 МБ" },
  { label: "Только аудио", value: "audio", size: "~5 МБ" },
];

export default function Index() {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("1080p");
  const [channels, setChannels] = useState(CHANNELS);
  const [progress, setProgress] = useState(0);

  const allSubscribed = channels.every((c) => c.checked);

  const handleUrlSubmit = () => {
    if (!url.trim()) return;
    setStep("quality");
  };

  const handleQualitySubmit = () => {
    setStep("subscribe");
  };

  const handleChannelCheck = (id: number) => {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleDownload = () => {
    if (!allSubscribed) return;
    setStep("downloading");
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
      }
      setProgress(Math.min(Math.round(p), 100));
    }, 300);
  };

  const handleReset = () => {
    setStep("input");
    setUrl("");
    setSelectedQuality("1080p");
    setChannels(CHANNELS);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center p-4 font-rubik">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ff3c3c]/10 border border-[#ff3c3c]/20 mb-4">
            <Icon name="Download" size={24} className="text-[#ff3c3c]" />
          </div>
          <h1 className="text-white text-xl font-semibold tracking-tight">YouTube Downloader</h1>
          <p className="text-[#555] text-sm mt-1">Скачай любое видео бесплатно</p>
        </div>

        {/* Step: Input URL */}
        {step === "input" && (
          <div className="animate-fade-in">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-6 space-y-4">
              <label className="text-[#888] text-xs uppercase tracking-widest">Ссылка на видео</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-[#0e0e0e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#333] outline-none focus:border-[#ff3c3c]/50 transition-colors"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim()}
                className="w-full bg-[#ff3c3c] hover:bg-[#e03030] disabled:bg-[#2a1a1a] disabled:text-[#555] text-white text-sm font-medium py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Продолжить
              </button>
            </div>
          </div>
        )}

        {/* Step: Quality */}
        {step === "quality" && (
          <div className="animate-fade-in">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setStep("input")} className="text-[#555] hover:text-white transition-colors">
                  <Icon name="ArrowLeft" size={16} />
                </button>
                <label className="text-[#888] text-xs uppercase tracking-widest">Качество видео</label>
              </div>

              <div className="space-y-2">
                {QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setSelectedQuality(q.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                      selectedQuality === q.value
                        ? "border-[#ff3c3c]/60 bg-[#ff3c3c]/10 text-white"
                        : "border-[#222] bg-[#0e0e0e] text-[#888] hover:border-[#333] hover:text-white"
                    }`}
                  >
                    <span className="text-sm font-medium">{q.label}</span>
                    <span className="text-xs text-[#444]">{q.size}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleQualitySubmit}
                className="w-full bg-[#ff3c3c] hover:bg-[#e03030] text-white text-sm font-medium py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {/* Step: Subscribe */}
        {step === "subscribe" && (
          <div className="animate-fade-in">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setStep("quality")} className="text-[#555] hover:text-white transition-colors">
                  <Icon name="ArrowLeft" size={16} />
                </button>
                <label className="text-[#888] text-xs uppercase tracking-widest">Подпишись для доступа</label>
              </div>

              <p className="text-[#555] text-xs">Подпишись на каналы, чтобы скачать видео</p>

              <div className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                      channel.checked
                        ? "border-[#2a8a2a]/50 bg-[#1a2e1a]"
                        : "border-[#222] bg-[#0e0e0e]"
                    }`}
                  >
                    <a
                      href={channel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#4a9eff] hover:text-[#6bb3ff] transition-colors"
                    >
                      {channel.name}
                    </a>
                    <button
                      onClick={() => handleChannelCheck(channel.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                        channel.checked
                          ? "border-[#4caf50] bg-[#4caf50]"
                          : "border-[#333] hover:border-[#555]"
                      }`}
                    >
                      {channel.checked && <Icon name="Check" size={12} className="text-white" />}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDownload}
                disabled={!allSubscribed}
                className="w-full bg-[#ff3c3c] hover:bg-[#e03030] disabled:bg-[#1e1414] disabled:text-[#444] text-white text-sm font-medium py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                {allSubscribed
                  ? "Скачать видео"
                  : `Подпишись (${channels.filter((c) => c.checked).length}/${channels.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Downloading */}
        {step === "downloading" && (
          <div className="animate-fade-in">
            <div className="bg-[#161616] border border-[#222] rounded-2xl p-6 space-y-5 text-center">
              {progress < 100 ? (
                <>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ff3c3c]/10 border border-[#ff3c3c]/20">
                    <Icon name="Loader" size={20} className="text-[#ff3c3c] animate-spin" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Подготавливаем файл...</p>
                    <p className="text-[#444] text-xs mt-1">{selectedQuality} · {progress}%</p>
                  </div>
                  <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ff3c3c] rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a3a1a] border border-[#2a8a2a]/40">
                    <Icon name="CheckCircle" size={20} className="text-[#4caf50]" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Готово!</p>
                    <p className="text-[#444] text-xs mt-1">Файл будет отправлен в чат</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="w-full bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-[#888] hover:text-white text-sm py-3 rounded-xl transition-all duration-200"
                  >
                    Скачать ещё
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {(["input", "quality", "subscribe", "downloading"] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                s === step ? "w-6 bg-[#ff3c3c]" : "w-2 bg-[#222]"
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
