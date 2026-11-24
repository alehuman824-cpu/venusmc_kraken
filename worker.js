// 금성상회 청해진 · 이착륙 신고 → 디스코드 + 패드 사용 상태 저장 (2단계)
// Cloudflare Worker. 아래 값은 코드에 쓰지 말고 대시보드에 넣어요.
//   DISCORD_WEBHOOK_URL : 디스코드 웹후크 URL (비밀로 저장)
//   ALLOWED_ORIGIN      : 사이트 주소. 예) https://venusmc-kraken.alehuman824.workers.dev (끝에 / 없이)
//   DB                  : D1 데이터베이스 바인딩 (설정 > 바인딩 > D1 데이터베이스, 변수 이름은 DB)
// POST : 이착륙 신고 (패드 상태 갱신 + 디스코드 게시)
// GET  : 현재 사용중인 패드 목록 {now, pads:{번호:{handle,ship,since,expires_at}}}

const MAX = { nick: 32, ship: 60, memo: 120 };
const KINDS = ["착륙", "이륙"];
const PADS = {
  1: "소형 패드 1", 2: "소형 패드 2", 3: "소형 패드 3", 4: "소형 패드 4",
  5: "중형 패드 5", 6: "중형 패드 6",
};

const EXPIRE_MS = 30 * 60 * 1000; // 착륙 후 자동 해제까지 30분

let ready; // 테이블 생성은 인스턴스당 한 번만
const initDb = (db) => (ready ??= db.prepare(
  "CREATE TABLE IF NOT EXISTS pads (pad_id INTEGER PRIMARY KEY, handle TEXT NOT NULL, ship TEXT NOT NULL, since INTEGER NOT NULL, expires_at INTEGER NOT NULL)"
).run().catch((e) => { ready = undefined; throw e; }));

const clean = (v, n) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, n);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (status, text) => new Response(text, { status, headers: cors });

    if (request.method === "OPTIONS") return reply(204, null);

    if (request.method === "GET") {
      if (!env.DB) return reply(503, "저장소가 아직 연결되지 않았어요.");
      try {
        await initDb(env.DB);
        const now = Date.now();
        const { results } = await env.DB.prepare(
          "SELECT pad_id, handle, ship, since, expires_at FROM pads WHERE expires_at > ?"
        ).bind(now).all();
        const pads = {};
        for (const r of results) pads[r.pad_id] = { handle: r.handle, ship: r.ship, since: r.since, expires_at: r.expires_at };
        return new Response(JSON.stringify({ now, pads }), {
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      } catch { return reply(500, "상태를 불러오지 못했어요."); }
    }
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

    // 패드 상태 갱신 (DB가 연결돼 있을 때만). 이미 사용중이면 디스코드에 올리지 않고 거절해요.
    let occupied = false;
    if (env.DB) {
      try {
        await initDb(env.DB);
        const now = Date.now();
        if (landing) {
          // 비어 있거나 만료됐거나 같은 핸들일 때만 점유돼요 (한 문장으로 처리해서 동시 신청에도 안전해요).
          const res = await env.DB.prepare(
            "INSERT INTO pads (pad_id, handle, ship, since, expires_at) VALUES (?1, ?2, ?3, ?4, ?5) " +
            "ON CONFLICT(pad_id) DO UPDATE SET handle = excluded.handle, ship = excluded.ship, since = excluded.since, expires_at = excluded.expires_at " +
            "WHERE pads.expires_at <= ?4 OR lower(pads.handle) = lower(excluded.handle)"
          ).bind(padId, nick, ship, now, now + EXPIRE_MS).run();
          if (!res.meta.changes) {
            const cur = await env.DB.prepare("SELECT handle, ship FROM pads WHERE pad_id = ?").bind(padId).first();
            return reply(409, `${PADS[padId]}은(는) 이미 ${cur ? cur.handle + " (" + cur.ship + ")" : "다른 분"}이 사용 중이에요.`);
          }
          occupied = true;
        } else {
          const res = await env.DB.prepare(
            "DELETE FROM pads WHERE pad_id = ?1 AND (lower(handle) = lower(?2) OR expires_at <= ?3)"
          ).bind(padId, nick, now).run();
          if (!res.meta.changes) {
            const cur = await env.DB.prepare("SELECT handle, ship FROM pads WHERE pad_id = ? AND expires_at > ?").bind(padId, now).first();
            if (cur) return reply(409, `${PADS[padId]}은(는) ${cur.handle} (${cur.ship})이 사용 중이라 다른 핸들로는 이륙 신고를 할 수 없어요.`);
          }
        }
      } catch { return reply(500, "패드 상태를 저장하지 못했어요."); }
    }
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
        footer: { text: landing && env.DB ? "금성상회 청해진 사이트 · 착륙 30분 뒤 자동 해제" : "금성상회 청해진 사이트" },
        timestamp: new Date().toISOString(),
      }],
    };

    const r = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      // 디스코드 전송이 실패하면 방금 잡은 패드를 되돌려요.
      if (occupied) await env.DB.prepare("DELETE FROM pads WHERE pad_id = ? AND lower(handle) = lower(?)").bind(padId, nick).run().catch(() => {});
      return reply(502, "디스코드 전송에 실패했어요.");
    }
    return reply(200, "ok");
  },
};
