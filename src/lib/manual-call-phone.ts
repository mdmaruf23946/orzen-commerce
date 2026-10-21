// Browser SIP phone (JsSIP over WebSocket) with local call recording.
// Browser-only: jssip is imported lazily so SSR never loads it.
export type PhoneCreds = { wss_url: string; sip_domain: string; username: string; password: string; caller_number?: string | null; record: boolean };
export type PhoneEvents = {
  onState: (s: "connecting" | "ringing" | "answered" | "ended" | "failed", info?: string) => void;
  onRecording?: (blob: Blob) => void;
};

export async function placeCall(creds: PhoneCreds, number: string, ev: PhoneEvents) {
  const JsSIP: any = (await import("jssip")).default ?? (await import("jssip"));
  const socket = new JsSIP.WebSocketInterface(creds.wss_url);
  const ua = new JsSIP.UA({
    sockets: [socket],
    uri: `sip:${creds.username}@${creds.sip_domain}`,
    password: creds.password,
    display_name: creds.caller_number || undefined,
    register: false,
  });
  const audio = new Audio();
  audio.autoplay = true;
  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  let session: any = null;
  let done = false;

  const finish = (state: "ended" | "failed", info?: string) => {
    if (done) return;
    done = true;
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch { /* ignore */ }
    setTimeout(() => { try { ua.stop(); } catch { /* ignore */ } }, 300);
    ev.onState(state, info);
  };

  ua.on("connected", () => {
    ev.onState("connecting");
    session = ua.call(`sip:${number.replace(/[^\d+*#]/g, "")}@${creds.sip_domain}`, {
      mediaConstraints: { audio: true, video: false },
      pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
    });
    session.on("progress", () => ev.onState("ringing"));
    session.on("confirmed", () => {
      ev.onState("answered");
      const pc: RTCPeerConnection = session.connection;
      const remote = new MediaStream(pc.getReceivers().map((r) => r.track).filter(Boolean) as MediaStreamTrack[]);
      audio.srcObject = remote;
      if (creds.record) {
        try {
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          ctx.createMediaStreamSource(remote).connect(dest);
          const local = pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[];
          if (local.length) ctx.createMediaStreamSource(new MediaStream(local)).connect(dest);
          recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          recorder.onstop = () => { ctx.close(); if (chunks.length) ev.onRecording?.(new Blob(chunks, { type: "audio/webm" })); };
          recorder.start(1000);
        } catch { /* recording unsupported */ }
      }
    });
    session.on("ended", () => finish("ended"));
    session.on("failed", (e: any) => finish("failed", e?.cause));
  });
  ua.on("disconnected", () => { if (!session) finish("failed", "Could not reach the gateway"); });
  ua.start();

  return {
    hangup: () => { try { session ? session.terminate() : finish("ended"); } catch { finish("ended"); } },
    mute: (m: boolean) => { try { m ? session?.mute() : session?.unmute(); } catch { /* ignore */ } },
    dtmf: (d: string) => { try { session?.sendDTMF(d); } catch { /* ignore */ } },
  };
}
