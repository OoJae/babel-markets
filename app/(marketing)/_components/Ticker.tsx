// Language ticker between the hero and the preamble. CSS animation does the
// scroll; we just emit two copies of the track for seamless looping.

const ITEMS: Array<{ text: string; serif?: boolean }> = [
  { text: "YORÙBÁ" },
  { text: "中文" },
  { text: "हिन्दी" },
  { text: "العربية" },
  { text: "a market in every tongue", serif: true },
  { text: "SWAHILI" },
  { text: "한국어" },
  { text: "PORTUGUÊS" },
  { text: "РУССКИЙ" },
  { text: "BAHASA" },
  { text: "ภาษาไทย" },
  { text: "aggregate the world's news", serif: true },
  { text: "FRANÇAIS" },
  { text: "ESPAÑOL" },
  { text: "DEUTSCH" },
];

function TickerCopy({ k }: { k: string }) {
  return (
    <>
      {ITEMS.map((item, i) => (
        <span key={`${k}-${i}`} className="contents">
          <span className={item.serif ? "serif" : ""}>{item.text}</span>
          <span className="sep">×</span>
        </span>
      ))}
    </>
  );
}

export function Ticker() {
  return (
    <div className="ticker">
      <div className="ticker-track">
        <TickerCopy k="a" />
        <TickerCopy k="b" />
      </div>
    </div>
  );
}
