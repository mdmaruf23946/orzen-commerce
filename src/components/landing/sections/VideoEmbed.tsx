// Video showcase / product demo. YouTube and Vimeo URLs only.
import { useState } from "react";
import { Play } from "lucide-react";
import { lpImage } from "@/lib/landing-builder";

/** Returns a privacy-friendly embed URL, or null when the URL is unsupported. */
export function videoEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/) ?? null;
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{5,})/) ?? null;
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export function VideoEmbed({
  title, text, videoUrl, poster,
}: {
  title: string;
  text: string;
  videoUrl: string;
  poster: string;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = videoEmbedUrl(videoUrl);
  if (!embed) return null;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-4xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        {text && (
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-neutral-600">{text}</p>
        )}
        <div
          className="relative mt-6 aspect-video w-full overflow-hidden bg-neutral-900 lp-round"
        >
          {poster && !playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 h-full w-full"
              aria-label={title || "Play video"}
            >
              <img src={lpImage(poster)} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/30">
                <span
                  className="grid h-16 w-16 place-items-center rounded-full text-white transition-transform group-hover:scale-110 lp-primary-bg"
                >
                  <Play className="h-7 w-7" />
                </span>
              </span>
            </button>
          ) : (
            <iframe
              src={playing ? `${embed}?autoplay=1` : embed}
              title={title || "Video"}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </section>
  );
}
