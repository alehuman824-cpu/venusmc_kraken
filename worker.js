// 금성상회 청해진 · 이착륙 신고 → 디스코드 (1단계: 웹훅 전달)
// Cloudflare Worker. 아래 두 값은 코드에 쓰지 말고 대시보드 "변수 및 보안 비밀"에 넣어요.
//   DISCORD_WEBHOOK_URL : 디스코드 웹후크 URL (비밀로 저장)
//   ALLOWED_ORIGIN      : 사이트 주소. 예) https://venusmc-test.pages.dev  (끝에 / 없이)

const MAX = { nick: 32, ship: 60, memo: 120 };
const KINDS = ["착륙", "이륙"];
const PADS = {
  1: "소형 패드 1", 2: "소형 패드 2", 3: "소형 패드 3", 4: "소형 패드 4",
  5: "중형 패드 5", 6: "중형 패드 6",
};

const clean = (v, n) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (status, text) => new Response(text, { status, headers: cors });

    if (request.method === "OPTIONS") return reply(204, null);
    if (request.method !== "POST") return reply(405, "POST만 가능해요.");
    if (!allowed || origin !== allowed) return reply(403, "허용되지 않은 주소예요.");

    let b;
    try { b = await request.json(); } catch { return reply(400, "형식이 올바르지 않아요."); }

    // 숨김 칸(website)이 채워져 있으면 봇이에요. 성공한 척하고 버려요.
    if (b.website) return reply(200, "ok");

    const padId = Number(b.pad);
    const kind = clean(b.kind, 4);
    const nick = clean(b.nick, MAX.nick);
    const ship = clean(b.ship, MAX.ship);
    const memo = clean(b.memo, MAX.memo);

    if (!PADS[padId]) return reply(400, "패드 번호가 올바르지 않아요.");
    if (!KINDS.includes(kind)) return reply(400, "착륙/이륙 구분이 올바르지 않아요.");
    if (!nick || !ship) return reply(400, "닉네임과 함선을 입력해주세요.");

    const landing = kind === "착륙";
    const payload = {
      // 닉네임·메모에 @everyone 같은 멘션이 들어 있어도 알림이 가지 않게 막아요.
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `${landing ? "🛬 착륙" : "🛫 이륙"} 신고 · ${PADS[padId]}`,
        color: landing ? 0x4cc38a : 0xd4af5a,
        fields: [
          { name: "인게임 핸들", value: nick, inline: true },
          { name: "함선", value: ship, inline: true },
          ...(memo ? [{ name: "메모", value: memo }] : []),
        ],
        footer: { text: "금성상회 청해진 사이트" },
        timestamp: new Date().toISOString(),
      }],
    };

    const r = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return reply(502, "디스코드 전송에 실패했어요.");
    return reply(200, "ok");
  },
};
