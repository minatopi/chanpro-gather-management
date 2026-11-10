"use client";
import { useEffect, useRef, useState } from "react";
import { api, Icon, Badge, useUI } from "./ui";

const SUGGEST = [
  "直近24時間のログを分析して、不審な点や改善点を教えて",
  "ログイン失敗が多いIPと、その理由を調べて",
  "未対応の報告・通報を要約して",
  "BAN中のIP・端末を一覧にして、期限が近いものを教えて",
];

export function Assistant({ params }) {
  const { toast } = useUI();
  const [msgs, setMsgs] = useState([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef(null); const started = useRef(false);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const send = async (text, base = msgs) => {
    const t = (text ?? input).trim(); if (!t || busy) return;
    const next = [...base, { role: "user", content: t }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const j = await api("/api/admin/ai", "POST", { messages: next.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content })) });
      setMsgs([...next, { role: "assistant", content: j.reply || (j.pending?.length ? "次の操作の許可をお願いします。" : ""), steps: j.steps, pending: (j.pending || []).map((p) => ({ ...p, status: "wait" })) }]);
    } catch (e) { toast(e.message, "err"); setMsgs([...next, { role: "assistant", content: "エラー: " + e.message, error: true }]); } finally { setBusy(false); }
  };
  useEffect(() => { if (params?.prompt && !started.current) { started.current = true; send(params.prompt, []); } }, []); // eslint-disable-line

  const setPending = (mi, pi, patch) => setMsgs((all) => all.map((m, i) => i !== mi ? m : { ...m, pending: m.pending.map((p, j) => j !== pi ? p : { ...p, ...patch }) }));
  const addNote = (text) => setMsgs((all) => [...all, { role: "user", content: text, note: true }]);
  const decide = async (mi, pi, p, approve) => {
    setPending(mi, pi, { status: "busy" });
    try {
      const j = await api("/api/admin/ai/execute", "POST", { token: p.token, deny: !approve });
      if (!approve) { setPending(mi, pi, { status: "denied" }); addNote(`【システム通知】管理者が操作「${p.title}」を拒否しました。実行していません。`); return; }
      setPending(mi, pi, { status: j.ok ? "done" : "failed", result: j.result });
      addNote(`【システム通知】操作「${p.title}」の結果: ${j.ok ? "成功" : "失敗"} - ${j.result}`);
      toast(j.ok ? "実行しました" : j.result, j.ok ? "ok" : "err");
    } catch (e) { setPending(mi, pi, { status: "wait" }); toast(e.message, "err"); }
  };

  return <div className="chat">
    <div className="chat-log">
      {!msgs.length && <div className="card card-pad stack">
        <div className="row" style={{ gap: 10 }}><span className="ico" style={{ width: 34, height: 34, borderRadius: 10, background: "var(--violet-soft)", color: "var(--violet)", display: "grid", placeItems: "center" }}><Icon name="sparkle" /></span><div><b>AIアシスタント</b><div className="sub">ログやユーザーを調べて分析します。BANや停止設定などの操作も提案でき、<b>許可するまで実行されません</b>。</div></div></div>
        <div className="row">{SUGGEST.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}</div>
        <div className="sub">※ 質問に必要なログ・ユーザー情報(IPやユーザー名を含む)がOpenAIに送信されます。</div>
      </div>}
      {msgs.map((m, mi) => m.note ? <div key={mi} className="chat-note">{m.content}</div> : (
        <div key={mi} className={`chat-row ${m.role}`}>
          <div className={`bubble ${m.role} ${m.error ? "err" : ""}`}>
            {m.content && <div className="bubble-text">{m.content}</div>}
            {m.steps?.length > 0 && <div className="steps">{m.steps.map((s, i) => <span key={i} className="step" title={JSON.stringify(s.args)}>🔎 {s.tool}{s.args?.kind ? `(${s.args.kind})` : ""}{s.error ? " ⚠" : ""}</span>)}</div>}
            {m.pending?.map((p, pi) => (
              <div key={pi} className={`approve ${p.danger ? "danger" : ""}`}>
                <div className="approve-head"><Icon name="alert" size={16} />AIが次の操作をしようとしています</div>
                <div className="approve-title">{p.title}</div>
                {p.lines?.map((l, i) => <div key={i} className="approve-line">{l}</div>)}
                {p.status === "wait" && <div className="row" style={{ marginTop: 10 }}>
                  <button className={`btn sm ${p.danger ? "danger" : "primary"}`} onClick={() => decide(mi, pi, p, true)}>許可して実行</button>
                  <button className="btn sm" onClick={() => decide(mi, pi, p, false)}>拒否</button>
                  <span className="sub">許可しますか?(10分以内)</span></div>}
                {p.status === "busy" && <div className="sub" style={{ marginTop: 8 }}>実行中…</div>}
                {p.status === "done" && <div style={{ marginTop: 8 }}><Badge tone="green" dot>実行しました</Badge> <span className="sub">{p.result}</span></div>}
                {p.status === "failed" && <div style={{ marginTop: 8 }}><Badge tone="red" dot>失敗</Badge> <span className="sub">{p.result}</span></div>}
                {p.status === "denied" && <div style={{ marginTop: 8 }}><Badge tone="gray">拒否しました</Badge></div>}
              </div>))}
          </div>
        </div>))}
      {busy && <div className="chat-row assistant"><div className="bubble assistant"><span className="sub">調べています…(数十秒かかることがあります)</span></div></div>}
      <div ref={end} />
    </div>
    <div className="chat-input">
      <textarea className="input" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="例: ログイン失敗が多いIPを調べて、悪質ならBANして" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="sub">Ctrl/⌘ + Enter で送信</span>
        <div className="row">{msgs.length > 0 && <button className="btn sm" onClick={() => setMsgs([])}>会話をクリア</button>}<button className="btn primary" disabled={busy || !input.trim()} onClick={() => send()}><Icon name="sparkle" size={16} />送信</button></div>
      </div>
    </div>
  </div>;
}
