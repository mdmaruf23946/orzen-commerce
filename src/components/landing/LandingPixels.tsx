// Loads the tracking pixels configured for one landing page target.
// Presentation-only: no product, order or payment logic is touched here.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLandingTracking } from "@/lib/marketing.functions";

export function LandingPixels({ pageId }: { pageId: string }) {
  const fetchTracking = useServerFn(getLandingTracking);
  const { data } = useQuery({
    queryKey: ["lp-tracking", pageId],
    queryFn: () => fetchTracking({ data: { landing_page_id: pageId } }),
    staleTime: 5 * 60 * 1000,
  });

  const fbPixel = data?.fb_pixel_id ?? "";
  const googleTag = data?.google_tag_id ?? "";
  const ttPixel = data?.tiktok_pixel_id ?? "";
  const slug = data?.store_slug ?? "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!fbPixel && !googleTag && !ttPixel) return;
    const added: HTMLScriptElement[] = [];
    const add = (src: string, inline?: string) => {
      const s = document.createElement("script");
      s.async = true;
      if (src) s.src = src;
      if (inline) s.text = inline;
      document.head.appendChild(s);
      added.push(s);
    };

    if (googleTag) {
      add(`https://www.googletagmanager.com/gtag/js?id=${googleTag}`);
      add(
        "",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${googleTag}');`,
      );
    }
    if (fbPixel) {
      (window as any).__fbInit = { slug, pixelId: fbPixel };
      add(
        "",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixel}');fbq('track','PageView');`,
      );
    }
    if (ttPixel) {
      add(
        "",
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ttPixel}');ttq.page();}(window,document,'ttq');`,
      );
    }
    if (googleTag) {
      (window as any).gtag?.("event", "page_view");
    }
    return () => {
      for (const s of added) s.remove();
    };
  }, [fbPixel, googleTag, ttPixel, slug]);

  return null;
}
