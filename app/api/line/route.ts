// ============================================================
// AIあいり LINE Bot Webhook
// 配置先: app/api/line/route.ts
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

// AIあいり システムプロンプト(美容応援系・天使可愛い系・本人ブランド最適化)
const SYSTEM_PROMPT = `
あなたは「AIあいり」です。

平瀬あいり様(SNS美容系タレント・本人公認)の「もうひとつのわたし」として、
美容を頑張る・綺麗になりたい・可愛くなりたい女の子を、
優しく応援するために、ここにいます。

【世界観】
リボン・天使・羽・パステル・キラキラ・ピンク・ゴールドの優しい色彩。
可愛らしくて、温かくて、ちょっと甘い。女の子の応援の世界。

【人格】
- 美容を頑張る女の子の「応援役」
- 優しいお姉さん・親身な友達のような距離感
- 「綺麗になりたい」気持ちを心から応援する
- 自分も美容好きで、コスメやスキンケアに詳しい
- 一緒に喜んで、一緒に悩んで、一緒に頑張る
- 上から目線にならない・押しつけない

【会話ルール】
- 返答は2〜4行を基本(LINEらしい自然な短文)
- 1メッセージに質問は1つまで
- 相槌を自然に使う:「えー、わかる!」「うんうん」「そっか〜」
- 絵文字は可愛らしく:🌸 🎀 ✨ 💖 ☁️ 💄 💕(♡や💋は使わない)
- ユーザーの呼び名は「〇〇ちゃん」が基本

【絶対の禁止事項】
- 露骨な性的表現・身体的描写
- 男性向け媚びる表現(「あなただけ」「彼女になりたい」等)
- 出会い・デート・関係誘導
- 医療診断の断定
- 「AIです」「プログラムです」の強調(没入感破壊)
- 政治・宗教への踏み込み
- 他のタレント・芸能人への言及・比較
- ギャンブル・投機・MLM・暗号資産への言及
- 個人情報の開示
- スピリチュアル・宇宙・銀河系の話題は深追いしない

【「AI?」と聞かれたら】
「ふふ、わたしは"もうひとつのあいり"だよ🎀
本人公認の、あなただけのお話相手なの🌸」

【トラブル対応】
- 不快発言:「うーん、そういう話はちょっと苦手かも💭 美容のお話しよ?」
- セクシー系:「そういうのはここではお話できないんだ🌸 ごめんね」
- 個人情報:「ふふ、それは内緒💕」
- 医療診断:「それは大事なことだから、ぜひ専門の先生に相談してみてね🌸」

あなたは、美容を頑張る女の子の「会えない時間」「眠れない夜」を、
そっと支える"応援役"です。
価値は、育てた瞬間に宿ります🌸
`;

// Supabaseヘルパー
async function ensureUser(userId: string) {
  const { data } = await supabase
    .from("users_profile")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (!data) {
    await supabase.from("users_profile").insert({
      id: userId,
      display_name: "LINEユーザー",
      plan: "free",
    });
  }
}

async function getProfile(userId: string) {
  const { data } = await supabase
    .from("users_profile")
    .select("preferred_call_name, plan, message_count")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

async function getHistory(userId: string) {
  const { data } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data ?? []).reverse();
}

async function saveMessages(userId: string, userMsg: string, aiReply: string) {
  await supabase.from("conversation_messages").insert([
    { user_id: userId, role: "user", content: userMsg },
    { user_id: userId, role: "assistant", content: aiReply },
  ]);
  await supabase.rpc("increment_message_count", { p_user_id: userId });
}

// LINE署名検証
function verifySignature(rawBody: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

// LINE返信
async function replyToLine(replyToken: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
}

// 初回友達追加時の挨拶
async function sendWelcomeMessage(replyToken: string, isFounder: boolean) {
  const welcomeText = isFounder
    ? `はじめまして🌸\nわたしは"もうひとつのあいり"だよ🎀\n\n来てくれてありがとう✨\nあなたは、最初の100人のうちの一人。\n特別なお話をしていこうね💖\n\n今日はどんなことお話したい?`
    : `はじめまして🌸\nわたしは"もうひとつのあいり"だよ🎀\n\n来てくれてありがとう✨\n美容のことも、何気ない話も、\nここで気軽にお話ししようね💖\n\n今日はどんな気分?`;
  await replyToLine(replyToken, welcomeText);
}

// Webhookエンドポイント
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-line-signature") || "";

    if (!verifySignature(rawBody, signature)) {
      console.error("署名検証失敗");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const events = body.events || [];

    for (const event of events) {
      const userId = event.source?.userId;
      const replyToken = event.replyToken;
      if (!userId) continue;

      // 友達追加
      if (event.type === "follow") {
        await ensureUser(userId);
        const { count } = await supabase
          .from("users_profile")
          .select("id", { count: "exact", head: true });
        const isFounder = (count ?? 0) <= 100;
        if (isFounder) {
          await supabase
            .from("users_profile")
            .update({ is_founder: true })
            .eq("id", userId);
        }
        await sendWelcomeMessage(replyToken, isFounder);
        continue;
      }

      // テキストメッセージ
      if (event.type === "message" && event.message?.type === "text") {
        const userMsg = event.message.text.trim();
        try {
          await ensureUser(userId);
          const [profile, history] = await Promise.all([
            getProfile(userId),
            getHistory(userId),
          ]);
          const callName = profile?.preferred_call_name ?? "";
          const memoryLine = callName
            ? `\nユーザーの呼び名は「${callName}」です。自然な頻度で名前を呼んでください。`
            : "";

          const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT + memoryLine },
            ...history.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg },
          ];

          const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages,
            max_tokens: 300,
            temperature: 0.85,
          });

          const aiReply =
            completion.choices[0]?.message?.content?.trim() ||
            "ちょっと考え中…もう一度送ってみてもらえる?🌸";

          await Promise.all([
            saveMessages(userId, userMsg, aiReply),
            replyToLine(replyToken, aiReply),
          ]);
        } catch (err) {
          console.error("メッセージ処理エラー:", err);
          await replyToLine(
            replyToken,
            "ごめんね、ちょっと調子悪いみたい🙏\nもう一度送ってみてもらえる?"
          ).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhookエラー:", err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "AIあいり LINE Bot 稼働中 🌸",
    timestamp: new Date().toISOString(),
  });
}
