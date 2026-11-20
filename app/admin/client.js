"use client";
import { useEffect, useState } from "react";
import { Assistant } from "@/components/ai";
import { Logs } from "@/components/logs";
import { Images } from "@/components/images";
import { UIProvider, Icon, api } from "@/components/ui";
import { Dashboard, Users, Bans, Reports, Settings, Geo, Status, PostAs, Analytics, Audit } from "@/components/views";

const NAV = [
  ["dashboard", "ダッシュボード", "home", "全体の状況をひと目で確認", Dashboard],
  ["analytics", "分析", "chart", "アクセス・エラー・不審なIPの分析(Axiom)", Analytics],
  ["users", "ユーザー", "users", "権限・公式バッジ・アカウントBAN", Users],
  ["post", "投稿", "edit", "管理アカウントとして投稿", PostAs],
  ["bans", "BAN管理", "shield", "ユーザー名・IP・端末のBANと芋づる式解除", Bans],
  ["reports", "報告・通報", "flag", "ユーザーから届いた報告と通報", Reports],
  ["geo", "アクセスマップ", "globe", "どこからアクセスが多いか(日本・世界)", Geo],
  ["logs", "アクセスログ", "list", "ログイン・アクセス・IP制限・機能ステータス(Axiom)", Logs],
  ["ai", "AIアシスタント", "sparkle", "OpenAIでログを分析・操作を提案(許可制)", Assistant],
  ["images", "アップロード画像", "image", "投稿・チャット・プロフィール・AIの画像を確認", Images],
  ["audit", "管理ログ", "lock", "管理サイトのログイン履歴と操作履歴", Audit],
  ["status", "機能ステータス", "activity", "いいね等の停止・復旧をAxiomに記録", Status],
  ["settings", "停止設定", "power", "ログイン・新規作成の停止", Settings],
];

const TABS = ["dashboard", "users", "logs", "settings"]; // スマホの下タブ(それ以外は「メニュー」から)
const logout = () => api("/api/admin/logout", "POST").then(() => (location.href = "/login"));

export default function AdminClient() {
  const [view, setView] = useState("dashboard"); const [params, setParams] = useState({}); const [menu, setMenu] = useState(false);
  const go = (v, p = {}) => { setParams(p); setView(v); setMenu(false); window.scrollTo({ top: 0 }); };
  const cur = NAV.find((n) => n[0] === view); const View = cur[4];

  // スマホ: 表の各セルに見出しラベルを付ける(カード表示にするため)
  useEffect(() => {
    const root = document.querySelector("main.page"); if (!root) return;
    const label = () => root.querySelectorAll("table").forEach((t) => {
      const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
      t.querySelectorAll("tbody tr").forEach((tr) => { let i = 0; tr.querySelectorAll("td").forEach((td) => { if (!td.dataset.label && heads[i]) td.dataset.label = heads[i]; i += td.colSpan || 1; }); });
    });
    label(); const mo = new MutationObserver(label); mo.observe(root, { childList: true, subtree: true }); return () => mo.disconnect();
  }, [view]);

  return (
    <UIProvider>
      <div className="app">
        <aside className="side">
          <div className="logo"><div className="logo-mark">C</div><div><b>Chanpro</b><small>Admin Console</small></div></div>
          <nav className="nav">
            {NAV.map(([k, label, icon]) => <button key={k} className={view === k ? "active" : ""} onClick={() => go(k)}><Icon name={icon} />{label}</button>)}
          </nav>
          <div className="side-foot"><div className="nav"><button onClick={logout}><Icon name="logout" />ログアウト</button></div></div>
        </aside>
        <div className="content">
          <header className="topbar"><div><h1>{cur[1]}</h1><p>{cur[3]}</p></div></header>
          <main className="page"><View key={view + JSON.stringify(params)} go={go} params={params} /></main>
        </div>
      </div>

      {/* スマホ: 下タブ + メニューシート */}
      <nav className="tabbar">
        {TABS.map((k) => { const n = NAV.find((x) => x[0] === k); return <button key={k} className={view === k ? "active" : ""} onClick={() => go(k)}><Icon name={n[2]} size={21} /><span>{n[1].replace("アクセスログ", "ログ")}</span></button>; })}
        <button className={!TABS.includes(view) || menu ? "active" : ""} onClick={() => setMenu(true)}><Icon name="list" size={21} /><span>メニュー</span></button>
      </nav>
      {menu && (
        <div className="overlay sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="sheet">
            <div className="sheet-head"><b>メニュー</b><button className="btn ghost sm" onClick={() => setMenu(false)}><Icon name="x" /></button></div>
            <div className="sheet-grid">{NAV.map(([k, label, icon]) => <button key={k} className={`sheet-item ${view === k ? "active" : ""}`} onClick={() => go(k)}><Icon name={icon} size={22} /><span>{label}</span></button>)}</div>
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={logout}><Icon name="logout" size={16} />ログアウト</button>
          </div>
        </div>
      )}
    </UIProvider>
  );
}
