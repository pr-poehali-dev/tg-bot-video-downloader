import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme: "light" | "dark";
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
        };
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
      };
    };
  }
}

type Step = "input" | "quality" | "subscribe" | "downloading" | "done";

const CHANNELS = [
  { id: 1, name: "@optomkross", url: "https://t.me/optomkross", checked: false },
  { id: 2, name: "@kukuzhd2", url: "https://t.me/kukuzhd2", checked: false },
  { id: 3, name: "@xozilka", url: "https://t.me/+fss9hWn6dwI1MDcy", checked: false },
];

const QUALITIES = [
  { label: "4K", value: "2160p", size: "~800 МБ" },
  { label: "1080p", value: "1080p", size: "~200 МБ" },
  { label: "720p", value: "720p", size: "~100 МБ" },
  { label: "480p", value: "480p", size: "~50 МБ" },
  { label: "Только аудио", value: "audio", size: "~5 МБ" },
];

const tg = () => window.Telegram?.WebApp;

export default function Index() {
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("1080p");
  const [channels, setChannels] = useState(CHANNELS);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");

  const allSubscribed = channels.every((c) => c.checked);
  const isTg = !!tg();

  useEffect(() => {
    tg()?.ready();
    tg()?.expand();
  }, []);

  useEffect(() => {
    const app = tg();
    if (!app) return;
    const handleBack = () => {
      if (step === "quality") setStep("input");
      else if (step === "subscribe") setStep("quality");
    };
    if (step === "quality" || step === "subscribe") {
      app.BackButton.show();
      app.BackButton.onClick(handleBack);
    } else {
      app.BackButton.hide();
    }
    return () => {
      app.BackButton.offClick(handleBack);
    };
  }, [step]);

  useEffect(() => {
    const app = tg();
    if (!app) return;
    const mb = app.MainButton;

    if (step === "input") {
      mb.setText("Продолжить");
      if (url.trim()) { mb.show(); mb.enable(); } else { mb.hide(); }
      const cb = () => handleUrlSubmit();
      mb.onClick(cb);
      return () => mb.offClick(cb);
    }
    if (step === "quality") {
      mb.setText("Выбрать качество");
      mb.show(); mb.enable();
      const cb = () => handleQualitySubmit();
      mb.onClick(cb);
      return () => mb.offClick(cb);
    }
    if (step === "subscribe") {
      if (allSubscribed) {
        mb.setText("Скачать видео");
        mb.show(); mb.enable();
      } else {
        mb.setText(`Подпишись (${channels.filter(c => c.checked).length}/${channels.length})`);
        mb.show(); mb.disable();
      }
      const cb = () => { if (allSubscribed) handleDownload(); };
      mb.onClick(cb);
      return () => mb.offClick(cb);
    }
    mb.hide();
  }, [step, url, allSubscribed, channels]);

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

  const handleOpenChannel = (url: string) => {
    if (isTg) {
      tg()?.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
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
        setStep("done");
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
    setDownloadUrl("");
  };

  const theme = tg()?.themeParams;
  const bgColor = theme?.bg_color || "#17212b";
  const secondaryBg = theme?.secondary_bg_color || "#232e3c";
  const textColor = theme?.text_color || "#ffffff";
  const hintColor = theme?.hint_color || "#708499";
  const btnColor = theme?.button_color || "#2b9fe8";
  const btnTextColor = theme?.button_text_color || "#ffffff";

  return (
    <div
      className="min-h-screen flex flex-col font-rubik"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="text-center py-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: `${btnColor}20` }}
          >
            <Icon name="Youtube" size={30} style={{ color: btnColor }} />
          </div>
          <h1 className="text-xl font-semibold">YouTube Downloader</h1>
          <p className="text-sm mt-1" style={{ color: hintColor }}>
            Скачай любое видео бесплатно
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["input", "quality", "subscribe"] as Step[]).map((s, i) => {
            const steps: Step[] = ["input", "quality", "subscribe", "downloading", "done"];
            const currentIdx = steps.indexOf(step);
            const thisIdx = steps.indexOf(s);
            const active = currentIdx >= thisIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
                  style={{
                    backgroundColor: active ? btnColor : secondaryBg,
                    color: active ? btnTextColor : hintColor,
                  }}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className="w-8 h-0.5 rounded-full transition-all duration-300"
                    style={{ backgroundColor: currentIdx > thisIdx ? btnColor : secondaryBg }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step: Input URL */}
        {step === "input" && (
          <div className="animate-fade-in space-y-3">
            <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: secondaryBg }}>
              <label className="text-xs font-medium" style={{ color: hintColor }}>
                Ссылка на видео
              </label>
              <input
                type="url"
                value={url}
                autoFocus
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  border: `1px solid ${hintColor}30`,
                }}
              />
            </div>
            {!isTg && (
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={{
                  backgroundColor: url.trim() ? btnColor : secondaryBg,
                  color: url.trim() ? btnTextColor : hintColor,
                }}
              >
                Продолжить
              </button>
            )}
          </div>
        )}

        {/* Step: Quality */}
        {step === "quality" && (
          <div className="animate-fade-in space-y-3">
            <p className="text-xs font-medium px-1" style={{ color: hintColor }}>Выберите качество</p>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: secondaryBg }}>
              {QUALITIES.map((q, idx) => (
                <button
                  key={q.value}
                  onClick={() => setSelectedQuality(q.value)}
                  className="w-full flex items-center justify-between px-4 py-3.5 transition-all duration-150"
                  style={{
                    borderBottom: idx < QUALITIES.length - 1 ? `1px solid ${hintColor}15` : "none",
                    backgroundColor: selectedQuality === q.value ? `${btnColor}20` : "transparent",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: textColor }}>{q.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: hintColor }}>{q.size}</span>
                    {selectedQuality === q.value && (
                      <Icon name="Check" size={16} style={{ color: btnColor }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
            {!isTg && (
              <button
                onClick={handleQualitySubmit}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ backgroundColor: btnColor, color: btnTextColor }}
              >
                Далее
              </button>
            )}
          </div>
        )}

        {/* Step: Subscribe */}
        {step === "subscribe" && (
          <div className="animate-fade-in space-y-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: secondaryBg }}>
              <p className="text-sm font-medium mb-1">Подпишись на каналы</p>
              <p className="text-xs mb-4" style={{ color: hintColor }}>
                Подпишись на все каналы, чтобы получить доступ к скачиванию
              </p>
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between rounded-xl px-3 py-3 transition-all duration-150"
                    style={{
                      backgroundColor: channel.checked ? `${btnColor}15` : bgColor,
                      border: `1px solid ${channel.checked ? btnColor + "40" : hintColor + "20"}`,
                    }}
                  >
                    <button
                      onClick={() => handleOpenChannel(channel.url)}
                      className="text-sm font-medium text-left"
                      style={{ color: btnColor }}
                    >
                      {channel.name}
                    </button>
                    <button
                      onClick={() => handleChannelCheck(channel.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0"
                      style={{
                        backgroundColor: channel.checked ? btnColor : "transparent",
                        border: `2px solid ${channel.checked ? btnColor : hintColor + "50"}`,
                      }}
                    >
                      {channel.checked && <Icon name="Check" size={13} style={{ color: btnTextColor }} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {!isTg && (
              <button
                onClick={handleDownload}
                disabled={!allSubscribed}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: allSubscribed ? btnColor : secondaryBg,
                  color: allSubscribed ? btnTextColor : hintColor,
                }}
              >
                {allSubscribed
                  ? "Скачать видео"
                  : `Подпишись (${channels.filter((c) => c.checked).length}/${channels.length})`}
              </button>
            )}
          </div>
        )}

        {/* Step: Downloading */}
        {step === "downloading" && (
          <div className="animate-fade-in">
            <div className="rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: secondaryBg }}>
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
                style={{ backgroundColor: `${btnColor}20` }}
              >
                <Icon name="Loader" size={24} className="animate-spin" style={{ color: btnColor }} />
              </div>
              <div>
                <p className="font-medium">Подготавливаем файл...</p>
                <p className="text-sm mt-1" style={{ color: hintColor }}>{selectedQuality} · {progress}%</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: btnColor }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="animate-fade-in">
            <div className="rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: secondaryBg }}>
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
                style={{ backgroundColor: `${btnColor}20` }}
              >
                <Icon name="CheckCircle" size={24} style={{ color: btnColor }} />
              </div>
              <div>
                <p className="font-semibold text-lg">Готово!</p>
                <p className="text-sm mt-1" style={{ color: hintColor }}>
                  Файл будет отправлен в чат с ботом
                </p>
              </div>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  className="block w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: btnColor, color: btnTextColor }}
                >
                  Скачать файл
                </a>
              )}
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{ backgroundColor: bgColor, color: hintColor }}
              >
                Скачать ещё
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
