import { useState, useEffect } from "react";

// ── Supabase設定 ──────────────────────────────────────────────
const SUPABASE_URL = "https://cjfnbgsvfpdlichzrlfv.supabase.co";
const SUPABASE_KEY = "sb_publishable_ApqyBZ1aA2_emH4qHfZlBQ_FGjavhUg";

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers
    },
    ...options
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── 定数 ─────────────────────────────────────────────────────
const JOBS = ["学生","会社員（事務）","会社員（技術）","会社員（営業）","公務員","医療・福祉","教育・研究","自営業・フリーランス","パート・アルバイト","専業主婦・主夫","無職","その他"];
const GENDER_MAIN = ["男性","女性","その他（LGBT+）"];
const GENDER_LGBT = ["ゲイ","レズビアン","バイセクシャル","トランスジェンダー","ノンバイナリー","パンセクシャル","アセクシャル","答えたくない"];
const PREFS = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];
const HOBBY_PRESETS = [
  "サッカー","フットサル","野球","バスケットボール","バレーボール","テニス","バドミントン","卓球","ゴルフ","水泳","ランニング","マラソン","筋トレ","ヨガ","ピラティス","登山","ハイキング","サイクリング","スキー","スノーボード","サーフィン","格闘技","ダンス","体操","弓道","剣道","柔道","スポーツ観戦","eスポーツ",
  "料理","お菓子作り","パン作り","コーヒー","お茶","ワイン","グルメ巡り","カフェ巡り","居酒屋巡り",
  "読書","漫画","アニメ","映画","ドラマ","ゲーム","ボードゲーム","音楽鑑賞","ギター","ピアノ","歌","DTM","絵を描く","イラスト","写真","動画編集","ハンドメイド","DIY","プラモデル","フィギュア収集","鉄道","車","バイク","釣り","キャンプ","アウトドア",
  "旅行","国内旅行","海外旅行","ファッション","コスメ","スキンケア","プログラミング","デザイン","語学学習","資格取得","投資","株","仮想通貨","ボランティア","地域活動","ペット","ガーデニング","観葉植物","占い","瞑想","神社仏閣","歴史","科学","その他"
];
const EDU = ["中学卒","高校卒","専門学校卒","短大卒","大学卒","大学院卒","その他"];
const NG_WORDS = ["死ね","殺","バカ","アホ","うざい","きもい","クソ","fuck","shit","sex","エロ","ヌード","援交","差別","ヘイト","レイプ","暴力","自殺","爆弾","テロ"];

function hasNG(text) {
  const lower = text.toLowerCase();
  return NG_WORDS.some(w => lower.includes(w.toLowerCase()));
}
function matchFreeword(user, query) {
  if (!query?.trim()) return true;
  const fields = [user.job, user.pref, user.edu, ...(user.hobbies||[]), user.bio||""].join(" ").toLowerCase();
  return query.toLowerCase().split(/[\s　,、]+/).filter(Boolean).every(k => fields.includes(k));
}

// ── カラー ───────────────────────────────────────────────────
const C = {
  bg:"#07090f", surface:"#0e1420", card:"#131c2e",
  border:"#1e2d45", accent:"#38bdf8", accentDim:"#0c4a6e",
  green:"#34d399", purple:"#a78bfa", pink:"#f472b6",
  yellow:"#fbbf24", text:"#e2e8f0", muted:"#64748b", subtle:"#94a3b8"
};
const CHART_COLORS = [C.accent, C.green, C.purple, C.pink, C.yellow];

// ── メインアプリ ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("register");
  const [user, setUser] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [responses, setResponses] = useState([]);
  const [answeredIds, setAnsweredIds] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const FREE_CREATE_LIMIT = 3;
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [viewResult, setViewResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [loading, setLoading] = useState(false);

  const createAvailable = createdCount < FREE_CREATE_LIMIT || canCreate;

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),2800); }

  // アンケート一覧を取得
  async function fetchSurveys() {
    try {
      const data = await sb("surveys?select=*&order=created_at.desc");
      setSurveys(data || []);
    } catch(e) { showToast("データ取得に失敗しました", "err"); }
  }

  // 回答一覧を取得
  async function fetchResponses(surveyId) {
    try {
      const data = await sb(`responses?survey_id=eq.${surveyId}&select=*`);
      return data || [];
    } catch(e) { return []; }
  }

  useEffect(() => {
    if (screen === "home") fetchSurveys();
  }, [screen]);

  // 登録
  async function handleRegister(u) {
    setLoading(true);
    try {
      const data = await sb("users", {
        method: "POST",
        body: JSON.stringify({
          name: u.name, age: u.age, job: u.job,
          gender: u.gender, gender_detail: u.genderDetail || null,
          pref: u.pref, edu: u.edu,
          hobbies: u.hobbies, bio: u.bio || null
        })
      });
      setUser({ ...u, id: data[0].id });
      setScreen("home");
    } catch(e) {
      showToast("登録に失敗しました。もう一度お試しください", "err");
    }
    setLoading(false);
  }

  // 回答
  async function handleAnswer(survey, option) {
    setLoading(true);
    try {
      await sb("responses", {
        method: "POST",
        body: JSON.stringify({
          survey_id: survey.id,
          age: user.age, job: user.job,
          gender: user.genderDetail || user.gender,
          hobbies: user.hobbies, pref: user.pref,
          option
        })
      });
      setAnsweredIds(prev => [...prev, survey.id]);
      setCanCreate(true);
      showToast("回答しました！アンケートを1つ作れます ✅");
      setScreen("home");
    } catch(e) {
      showToast("送信に失敗しました", "err");
    }
    setLoading(false);
  }

  // 作成
  async function handleCreate(s) {
    setLoading(true);
    try {
      await sb("surveys", {
        method: "POST",
        body: JSON.stringify({
          title: s.title,
          options: s.options,
          target_age_min: s.targetAge[0],
          target_age_max: s.targetAge[1],
          target_jobs: s.targetJobs,
          target_genders: s.targetGenders,
          target_freeword: s.targetFreeword || null,
          created_by: user.name
        })
      });
      const newCount = createdCount + 1;
      setCreatedCount(newCount);
      if (newCount >= FREE_CREATE_LIMIT) setCanCreate(false);
      showToast("アンケートを公開しました 🎉");
      setScreen("home");
    } catch(e) {
      showToast("公開に失敗しました", "err");
    }
    setLoading(false);
  }

  // 結果表示
  async function handleViewResult(survey) {
    setLoading(true);
    const data = await fetchResponses(survey.id);
    setViewResult({ ...survey, responses: data });
    setScreen("result");
    setLoading(false);
  }

  // ターゲットマッチ（DBから取得したデータ形式に合わせる）
  const availableSurveys = surveys.filter(s => {
    if (answeredIds.includes(s.id) || !user) return false;
    const ageOk = user.age >= s.target_age_min && user.age <= s.target_age_max;
    const jobOk = !s.target_jobs?.length || s.target_jobs.includes(user.job);
    const gOk = !s.target_genders?.length || s.target_genders.includes(user.gender) || s.target_genders.includes(user.genderDetail);
    const fwOk = !s.target_freeword || matchFreeword(user, s.target_freeword);
    return ageOk && jobOk && gOk && fwOk;
  });

  const mySurveys = surveys.filter(s => s.created_by === user?.name);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif" }}>
      {screen !== "register" && (
        <header style={{ position:"sticky", top:0, zIndex:50, background:`${C.bg}dd`, backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.border}`, padding:"0 16px" }}>
          <div style={{ maxWidth:700, margin:"0 auto", height:56, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span onClick={() => setScreen("home")} style={{ fontSize:20, fontWeight:900, letterSpacing:3, color:C.accent, cursor:"pointer" }}>VOICELY</span>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {!isPremium && <button onClick={() => setShowPremium(true)} style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)", color:"#fff", border:"none", borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>✦ プレミアム</button>}
              {isPremium && <span style={{ fontSize:12, color:C.purple, fontWeight:700 }}>✦ プレミアム</span>}
              {createAvailable && <button onClick={() => setScreen("create")} style={{ background:C.accent, color:C.bg, border:"none", borderRadius:20, padding:"5px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>＋ 作成</button>}
              <span style={{ fontSize:12, color:C.muted }}>{user?.name}</span>
            </div>
          </div>
        </header>
      )}

      {loading && (
        <div style={{ position:"fixed", inset:0, background:"#0008", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000 }}>
          <div style={{ background:C.card, borderRadius:16, padding:"24px 32px", color:C.accent, fontWeight:700, fontSize:15 }}>処理中...</div>
        </div>
      )}

      <main style={{ maxWidth:700, margin:"0 auto", padding:"20px 14px 80px" }}>
        {screen === "register" && <RegisterScreen onRegister={handleRegister} />}
        {screen === "home" && (
          <HomeScreen
            available={availableSurveys} mySurveys={mySurveys}
            canCreate={canCreate} createAvailable={createAvailable}
            createdCount={createdCount} freeLimit={FREE_CREATE_LIMIT}
            isPremium={isPremium}
            onAnswer={s => { setActiveSurvey(s); setScreen("answer"); }}
            onResult={handleViewResult}
            onCreate={() => setScreen("create")}
            onRefresh={fetchSurveys}
            onPremium={() => setShowPremium(true)}
          />
        )}
        {screen === "answer" && activeSurvey && (
          <AnswerScreen survey={activeSurvey} onSubmit={opt => handleAnswer(activeSurvey, opt)} onBack={() => setScreen("home")} />
        )}
        {screen === "create" && (
          <CreateScreen user={user} isPremium={isPremium} onSubmit={handleCreate} onBack={() => setScreen("home")} onPremium={() => setShowPremium(true)} showToast={showToast} />
        )}
        {screen === "result" && viewResult && (
          <ResultScreen survey={viewResult} isPremium={isPremium} onBack={() => setScreen("home")} onPremium={() => setShowPremium(true)} />
        )}
      </main>

      {showPremium && (
        <PremiumModal isPremium={isPremium} onClose={() => setShowPremium(false)}
          onSubscribe={() => { setIsPremium(true); setShowPremium(false); showToast("プレミアム登録完了！✨", "premium"); }} />
      )}

      {toast && (
        <div style={{
          position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="premium" ? "linear-gradient(135deg,#7c3aed,#db2777)" : toast.type==="err" ? "#7f1d1d" : C.accentDim,
          color: toast.type==="premium" ? "#fff" : toast.type==="err" ? "#fca5a5" : C.accent,
          padding:"12px 22px", borderRadius:12, fontSize:14, fontWeight:600,
          boxShadow:"0 4px 24px #0006", zIndex:999, whiteSpace:"nowrap"
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ── 登録画面 ─────────────────────────────────────────────────
function RegisterScreen({ onRegister }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [job, setJob] = useState("");
  const [gender, setGender] = useState("");
  const [genderDetail, setGenderDetail] = useState("");
  const [pref, setPref] = useState("");
  const [edu, setEdu] = useState("");
  const [hobbies, setHobbies] = useState([]);
  const [hobbyInput, setHobbyInput] = useState("");
  const [bio, setBio] = useState("");
  const [err, setErr] = useState("");

  function toggleHobby(h) {
    setHobbies(prev => prev.includes(h) ? prev.filter(x=>x!==h) : prev.length>=10 ? prev : [...prev,h]);
  }
  function addHobbyFree() {
    if (!hobbyInput.trim()) return;
    if (hasNG(hobbyInput)) { setErr("使用できない言葉が含まれています"); return; }
    if (hobbies.length >= 10) { setErr("趣味は最大10個まで"); return; }
    setHobbies(prev => [...prev, hobbyInput.trim()]);
    setHobbyInput(""); setErr("");
  }
  function next() {
    if (step === 1) {
      if (!name||!age||!job||!gender) { setErr("全て入力してください"); return; }
      if (gender==="その他（LGBT+）"&&!genderDetail) { setErr("詳細な性別を選んでください"); return; }
      setErr(""); setStep(2);
    } else {
      if (!pref||!edu) { setErr("都道府県と学歴を選んでください"); return; }
      onRegister({ name, age:Number(age), job, gender, genderDetail, pref, edu, hobbies, bio });
    }
  }

  return (
    <div style={{ paddingTop:40 }}>
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontSize:40, fontWeight:900, color:C.accent, letterSpacing:4, margin:0 }}>VOICELY</h1>
        <p style={{ color:C.muted, marginTop:6, fontSize:13 }}>声を届ける、声を集める</p>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {[1,2].map(i => <div key={i} style={{ flex:1, height:4, borderRadius:4, background:step>=i?C.accent:C.border, transition:"background 0.3s" }} />)}
      </div>
      <Card>
        {step===1 ? (
          <>
            <SectionTitle>基本情報</SectionTitle>
            <Label>ニックネーム</Label>
            <Input value={name} onChange={e=>setName(e.target.value)} placeholder="例：たろう" />
            <Label>年齢</Label>
            <Input type="number" value={age} onChange={e=>setAge(e.target.value)} placeholder="例：21" min={10} max={100} />
            <Label>職業</Label>
            <SelectEl value={job} onChange={e=>setJob(e.target.value)}>
              <option value="">選択してください</option>
              {JOBS.map(j=><option key={j}>{j}</option>)}
            </SelectEl>
            <Label>性別</Label>
            <ChipGroup items={GENDER_MAIN} selected={[gender]} onToggle={g=>{setGender(g);setGenderDetail("");}} single />
            {gender==="その他（LGBT+）" && <>
              <Label>詳細</Label>
              <ChipGroup items={GENDER_LGBT} selected={[genderDetail]} onToggle={setGenderDetail} single />
            </>}
          </>
        ) : (
          <>
            <SectionTitle>プロフィール詳細</SectionTitle>
            <Label>居住地域</Label>
            <SelectEl value={pref} onChange={e=>setPref(e.target.value)}>
              <option value="">都道府県を選択</option>
              {PREFS.map(p=><option key={p}>{p}</option>)}
            </SelectEl>
            <Label>最終学歴</Label>
            <ChipGroup items={EDU} selected={[edu]} onToggle={setEdu} single />
            <Label>趣味・興味（最大10個）</Label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
              {HOBBY_PRESETS.map(h=><button key={h} onClick={()=>toggleHobby(h)} style={chipSt(hobbies.includes(h))}>{h}</button>)}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <Input value={hobbyInput} onChange={e=>setHobbyInput(e.target.value)} placeholder="自由入力（例：サッカー）" onKeyDown={e=>e.key==="Enter"&&addHobbyFree()} style={{ marginBottom:0 }} />
              <button onClick={addHobbyFree} style={{ background:C.accent, color:C.bg, border:"none", borderRadius:8, padding:"0 16px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>追加</button>
            </div>
            {hobbies.filter(h=>!HOBBY_PRESETS.includes(h)).map(h=>(
              <Tag key={h} label={h} onRemove={()=>setHobbies(prev=>prev.filter(x=>x!==h))} />
            ))}
            <Label>ひとこと自己紹介（任意）</Label>
            <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="例：元サッカー部、今は週末フットサル" rows={2}
              style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:14, resize:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
          </>
        )}
        {err && <p style={{ color:"#f87171", fontSize:13, marginTop:8 }}>{err}</p>}
        <button onClick={next} style={{ ...btnSt(C.accent,C.bg), width:"100%", marginTop:14, padding:"14px 0", fontSize:16 }}>
          {step===1?"次へ →":"登録してはじめる"}
        </button>
        {step===2 && <button onClick={()=>setStep(1)} style={{ ...btnSt(C.border,C.subtle), width:"100%", marginTop:8, padding:"10px 0" }}>← 戻る</button>}
        <p style={{ fontSize:11, color:C.muted, marginTop:12, lineHeight:1.7 }}>入力情報はアンケート回答時の属性データとして使用されます。個人を特定する情報は公開されません。</p>
      </Card>
    </div>
  );
}

// ── ホーム ────────────────────────────────────────────────────
function HomeScreen({ available, mySurveys, canCreate, createAvailable, createdCount, freeLimit, isPremium, onAnswer, onResult, onCreate, onRefresh, onPremium }) {
  const remaining = Math.max(0, freeLimit - createdCount);
  return (
    <div>
      {remaining > 0 && (
        <div style={{ background:"linear-gradient(135deg,#0c4a6e,#164e63)", borderRadius:14, padding:"14px 20px", marginBottom:18, border:`1px solid ${C.accent}40`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:700, color:C.accent, fontSize:14 }}>🎁 最初の{freeLimit}つは無料で作成できます</div>
            <div style={{ fontSize:13, color:C.subtle, marginTop:3 }}>あと{remaining}つ無料枠が残っています</div>
          </div>
          <button onClick={onCreate} style={btnSt(C.accent,C.bg)}>作成する</button>
        </div>
      )}
      {remaining===0 && canCreate && (
        <div style={{ background:"linear-gradient(135deg,#134e4a,#0f766e)", borderRadius:14, padding:"14px 20px", marginBottom:18, border:`1px solid ${C.green}40`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:700, color:C.green }}>🎉 回答ありがとう！</div>
            <div style={{ fontSize:13, color:C.subtle, marginTop:3 }}>アンケートを1つ作成できます</div>
          </div>
          <button onClick={onCreate} style={btnSt(C.green,C.bg)}>作成する</button>
        </div>
      )}
      {remaining===0 && !canCreate && (
        <div style={{ background:C.surface, borderRadius:14, padding:"14px 20px", marginBottom:18, border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:13, color:C.muted }}>誰かのアンケートに答えると、1つ作成できます</div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h2 style={{ fontSize:15, color:C.subtle, margin:0 }}>📋 あなたへのアンケート（{available.length}件）</h2>
        <button onClick={onRefresh} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, fontSize:12, padding:"4px 10px", cursor:"pointer" }}>更新</button>
      </div>
      {available.length===0 && <p style={{ color:C.muted, fontSize:14 }}>現在あなたに合うアンケートはありません</p>}
      {available.map(s=><SurveyCard key={s.id} survey={s} action="answer" onAction={()=>onAnswer(s)} />)}

      {mySurveys.length>0 && (
        <>
          <h2 style={{ fontSize:15, color:C.subtle, margin:"24px 0 12px" }}>📊 自分のアンケート</h2>
          {mySurveys.map(s=><SurveyCard key={s.id} survey={s} action="result" onAction={()=>onResult(s)} />)}
        </>
      )}
    </div>
  );
}

function SurveyCard({ survey, action, onAction }) {
  const jobs = survey.target_jobs || [];
  const genders = survey.target_genders || [];
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:5 }}>{survey.title}</div>
          <div style={{ fontSize:12, color:C.muted }}>
            {survey.target_age_min}〜{survey.target_age_max}歳対象
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", marginTop:6, gap:4 }}>
            {jobs.map(j=><Tag key={j} label={j} />)}
            {genders.map(g=><Tag key={g} label={g} color={C.purple} />)}
            {survey.target_freeword && <Tag label={`"${survey.target_freeword}"`} color={C.yellow} />}
          </div>
        </div>
        <button onClick={onAction} style={btnSt(action==="answer"?C.accent:C.purple,C.bg)}>
          {action==="answer"?"回答する":"結果を見る"}
        </button>
      </div>
    </Card>
  );
}

// ── 回答画面 ─────────────────────────────────────────────────
function AnswerScreen({ survey, onSubmit, onBack }) {
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <BackBtn onClick={onBack} />
      <Card>
        <h2 style={{ marginTop:0, fontSize:18 }}>{survey.title}</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(survey.options||[]).map(opt=>(
            <button key={opt} onClick={()=>setSelected(opt)} style={{
              background:selected===opt?C.accentDim:C.surface,
              border:`2px solid ${selected===opt?C.accent:C.border}`,
              borderRadius:10, padding:"13px 16px", color:selected===opt?C.accent:C.subtle,
              textAlign:"left", cursor:"pointer", fontSize:15, fontWeight:selected===opt?700:400, transition:"all 0.15s"
            }}>
              {selected===opt?"✓ ":""}{opt}
            </button>
          ))}
        </div>
        <button onClick={()=>selected&&onSubmit(selected)}
          style={{ ...btnSt(C.accent,C.bg), width:"100%", marginTop:18, padding:"14px 0", fontSize:16, opacity:selected?1:0.4 }}>
          回答を送信
        </button>
      </Card>
    </div>
  );
}

// ── 作成画面 ─────────────────────────────────────────────────
function CreateScreen({ user, isPremium, onSubmit, onBack, onPremium, showToast }) {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["","","",""]);
  const [minAge, setMinAge] = useState(15);
  const [maxAge, setMaxAge] = useState(65);
  const [targetJobs, setTargetJobs] = useState([]);
  const [targetGenders, setTargetGenders] = useState([]);
  const [freeword, setFreeword] = useState("");
  const [err, setErr] = useState("");

  const MAX_CONDITIONS = isPremium ? 99 : 3;
  const condCount = targetJobs.length + targetGenders.length + (freeword?1:0);

  function toggleJob(j) {
    if (!targetJobs.includes(j)&&condCount>=MAX_CONDITIONS){onPremium();return;}
    setTargetJobs(prev=>prev.includes(j)?prev.filter(x=>x!==j):[...prev,j]);
  }
  function toggleGender(g) {
    if (!targetGenders.includes(g)&&condCount>=MAX_CONDITIONS){onPremium();return;}
    setTargetGenders(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g]);
  }
  function handleFreeword(v) {
    if (v&&!freeword&&condCount>=MAX_CONDITIONS){onPremium();return;}
    if (hasNG(v)){setErr("使用できない言葉が含まれています");return;}
    setErr(""); setFreeword(v);
  }
  function submit() {
    if (!title.trim()){setErr("質問を入力してください");return;}
    if (hasNG(title)){setErr("質問に使用できない言葉が含まれています");return;}
    const filled = options.filter(o=>o.trim());
    if (filled.length<2){setErr("選択肢を2つ以上入力してください");return;}
    onSubmit({ title, options:filled, targetAge:[minAge,maxAge], targetJobs, targetGenders, targetFreeword:freeword });
  }

  return (
    <div>
      <BackBtn onClick={onBack} />
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <SectionTitle style={{ margin:0 }}>アンケート作成</SectionTitle>
          {!isPremium && <span style={{ fontSize:12, color:C.muted }}>条件 {condCount}/{MAX_CONDITIONS}</span>}
        </div>
        <Label>質問</Label>
        <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="例：テレワークは好きですか？" />
        <Label>選択肢（2〜5個）</Label>
        {options.map((o,i)=>(
          <Input key={i} value={o} onChange={e=>setOptions(prev=>prev.map((x,j)=>j===i?e.target.value:x))} placeholder={`選択肢 ${i+1}`} style={{ marginBottom:8 }} />
        ))}
        {options.length<5 && <button onClick={()=>setOptions(p=>[...p,""])} style={{ ...btnSt(C.border,C.subtle), fontSize:13, marginBottom:12 }}>＋ 追加</button>}

        <Label>対象年齢：{minAge}歳〜{maxAge}歳</Label>
        <div style={{ display:"flex", gap:16, marginBottom:14 }}>
          {[["下限",minAge,v=>setMinAge(Math.min(v,maxAge-1))],["上限",maxAge,v=>setMaxAge(Math.max(v,minAge+1))]].map(([label,val,set])=>(
            <div key={label} style={{ flex:1 }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>{label}: {val}歳</div>
              <input type="range" min={10} max={100} value={val} onChange={e=>set(Number(e.target.value))} style={{ width:"100%", accentColor:C.accent }} />
            </div>
          ))}
        </div>

        <Label>対象職業（未選択=全員）</Label>
        <ChipGroup items={JOBS} selected={targetJobs} onToggle={toggleJob} />
        <Label>対象性別（未選択=全員）</Label>
        <ChipGroup items={GENDER_MAIN} selected={targetGenders} onToggle={toggleGender} />

        <Label>フリーワード検索 {!isPremium&&<PremiumBadge onClick={onPremium} />}</Label>
        <div style={{ position:"relative" }}>
          <Input value={freeword} onChange={e=>handleFreeword(e.target.value)} placeholder={isPremium?"例：サッカー、料理好き":"プレミアムで利用可能"} disabled={!isPremium&&condCount>=MAX_CONDITIONS&&!freeword} />
          {!isPremium && (
            <div onClick={onPremium} style={{ position:"absolute", inset:0, cursor:"pointer", borderRadius:8, background:"#0008", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>🔒 プレミアムで解放</span>
            </div>
          )}
        </div>

        {err && <p style={{ color:"#f87171", fontSize:13 }}>{err}</p>}
        <button onClick={submit} style={{ ...btnSt(C.accent,C.bg), width:"100%", marginTop:16, padding:"14px 0", fontSize:16 }}>公開する</button>
      </Card>
    </div>
  );
}

// ── 結果画面 ─────────────────────────────────────────────────
function ResultScreen({ survey, isPremium, onBack, onPremium }) {
  const [filterGender, setFilterGender] = useState("全て");
  const [filterJob, setFilterJob] = useState("全て");
  const [filterFreeword, setFilterFreeword] = useState("");
  const [chartType, setChartType] = useState("bar");

  const allResponses = survey.responses || [];
  const filtered = allResponses.filter(r => {
    const gOk = filterGender==="全て"||r.gender===filterGender;
    const jOk = filterJob==="全て"||r.job===filterJob;
    const fwOk = !filterFreeword||matchFreeword(r, filterFreeword);
    return gOk&&jOk&&fwOk;
  });
  const total = filtered.length;
  const counts = (survey.options||[]).map((opt,i)=>({
    label:opt, count:filtered.filter(r=>r.option===opt).length, color:CHART_COLORS[i%CHART_COLORS.length]
  }));
  const ageBands = [["10代",10,20],["20代",20,30],["30代",30,40],["40代",40,50],["50代以上",50,200]];
  const ageCounts = ageBands.map(([label,lo,hi])=>({ label, count:filtered.filter(r=>r.age>=lo&&r.age<hi).length }));
  const crossData = GENDER_MAIN.map(g=>({
    gender:g, counts:(survey.options||[]).map(opt=>filtered.filter(r=>r.gender===g&&r.option===opt).length)
  }));

  return (
    <div>
      <BackBtn onClick={onBack} />
      <Card>
        <h2 style={{ marginTop:0, fontSize:17 }}>{survey.title}</h2>
        <p style={{ color:C.muted, fontSize:13, marginTop:-8, marginBottom:18 }}>総回答数: {total}件</p>

        <div style={{ background:C.surface, borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:13, color:C.subtle, marginBottom:10 }}>🔍 絞り込み</div>
          <Label>性別</Label>
          <ChipGroup items={["全て",...GENDER_MAIN]} selected={[filterGender]} onToggle={setFilterGender} single />
          <Label>職業</Label>
          <SelectEl value={filterJob} onChange={e=>setFilterJob(e.target.value)}>
            <option>全て</option>
            {JOBS.map(j=><option key={j}>{j}</option>)}
          </SelectEl>
          <Label>フリーワード {!isPremium&&<PremiumBadge onClick={onPremium} />}</Label>
          <div style={{ position:"relative" }}>
            <Input value={filterFreeword} onChange={e=>setFilterFreeword(e.target.value)} placeholder={isPremium?"例：サッカー":"プレミアムで利用可能"} disabled={!isPremium} />
            {!isPremium && <div onClick={onPremium} style={{ position:"absolute", inset:0, cursor:"pointer", borderRadius:8, background:"#0008", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>🔒 プレミアムで解放</span></div>}
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>📊 回答分布</div>
          <div style={{ display:"flex", gap:6 }}>
            {["bar","pie"].map(t=>(
              <button key={t} onClick={()=>{if(t==="pie"&&!isPremium){onPremium();return;}setChartType(t);}} style={{ ...chipSt(chartType===t), fontSize:12, padding:"4px 12px" }}>
                {t==="bar"?"棒グラフ":"円グラフ"}{t==="pie"&&!isPremium?" 🔒":""}
              </button>
            ))}
          </div>
        </div>
        {chartType==="bar" ? <BarChart data={counts} total={total} /> : <PieChart data={counts} total={total} />}

        <div style={{ marginTop:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>👥 年代分布</div>
          {ageCounts.map(a=>(
            <div key={a.label} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                <span>{a.label}</span><span style={{ color:C.purple }}>{a.count}件</span>
              </div>
              <ProgressBar value={a.count} max={total} color={C.purple} />
            </div>
          ))}
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>📈 性別×回答 クロス集計</div>
            {!isPremium&&<PremiumBadge onClick={onPremium} />}
          </div>
          {isPremium ? (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left", color:C.muted, padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>性別</th>
                    {(survey.options||[]).map(o=><th key={o} style={{ color:C.muted, padding:"6px 8px", borderBottom:`1px solid ${C.border}` }}>{o}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {crossData.map(row=>(
                    <tr key={row.gender}>
                      <td style={{ padding:"8px", color:C.subtle, borderBottom:`1px solid ${C.border}20` }}>{row.gender}</td>
                      {row.counts.map((c,i)=><td key={i} style={{ textAlign:"center", padding:"8px", color:CHART_COLORS[i], fontWeight:700, borderBottom:`1px solid ${C.border}20` }}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div onClick={onPremium} style={{ background:C.surface, borderRadius:10, padding:"20px", textAlign:"center", cursor:"pointer", border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:24, marginBottom:8 }}>🔒</div>
              <div style={{ color:C.subtle, fontSize:14 }}>プレミアムでクロス集計を解放</div>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>🗒 個別回答</div>
          {filtered.length===0&&<p style={{ color:C.muted, fontSize:13 }}>該当なし</p>}
          {filtered.slice(0, isPremium?filtered.length:10).map((r,i)=>(
            <div key={i} style={{ background:C.surface, borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <div style={{ color:C.accent, fontWeight:700, fontSize:14 }}>{r.option}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                {r.age}歳 / {r.job} / {r.gender} / {r.pref||"-"}
                {r.hobbies?.length>0&&<span> | 趣味: {r.hobbies.slice(0,3).join("・")}</span>}
              </div>
            </div>
          ))}
          {!isPremium&&filtered.length>10&&(
            <div onClick={onPremium} style={{ textAlign:"center", padding:"12px", color:C.muted, fontSize:13, cursor:"pointer", border:`1px dashed ${C.border}`, borderRadius:10 }}>
              🔒 残り{filtered.length-10}件はプレミアムで表示
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── グラフ ────────────────────────────────────────────────────
function BarChart({ data, total }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {data.map(d=>(
        <div key={d.label}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
            <span>{d.label}</span>
            <span style={{ color:d.color, fontWeight:700 }}>{d.count}件 ({total?Math.round(d.count/total*100):0}%)</span>
          </div>
          <ProgressBar value={d.count} max={total} color={d.color} />
        </div>
      ))}
    </div>
  );
}
function PieChart({ data, total }) {
  const size=200, cx=100, cy=100, r=80;
  let startAngle = -Math.PI/2;
  const slices = data.map(d=>{
    const angle = total===0?0:(d.count/total)*2*Math.PI;
    const x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
    startAngle+=angle;
    const x2=cx+r*Math.cos(startAngle), y2=cy+r*Math.sin(startAngle);
    return { ...d, path:`M${cx},${cy} L${x1},${y1} A${r},${r},0,${angle>Math.PI?1:0},1,${x2},${y2}Z` };
  });
  return (
    <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
      <svg width={size} height={size}>
        {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity={0.9} />)}
        {total===0&&<circle cx={cx} cy={cy} r={r} fill={C.border} />}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {data.map(d=>(
          <div key={d.label} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:d.color, flexShrink:0 }} />
            <span>{d.label}: {total?Math.round(d.count/total*100):0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ProgressBar({ value, max, color }) {
  const pct = max===0?0:Math.round((value/max)*100);
  return (
    <div style={{ background:C.surface, borderRadius:8, height:12, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:8, transition:"width 0.5s" }} />
    </div>
  );
}

// ── プレミアムモーダル ────────────────────────────────────────
function PremiumModal({ isPremium, onClose, onSubscribe }) {
  const features = [["条件無制限でターゲット設定","🎯"],["フリーワード検索","🔍"],["円グラフ・クロス集計","📈"],["個別回答全件表示","📋"],["アンケート作成無制限","∞"]];
  return (
    <div style={{ position:"fixed", inset:0, background:"#000a", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}>
      <div style={{ background:C.card, borderRadius:20, border:`1px solid #7c3aed40`, padding:"28px 24px", maxWidth:400, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:36 }}>✦</div>
          <h2 style={{ margin:"8px 0 4px", background:"linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontSize:24 }}>VOICELY プレミアム</h2>
          <div style={{ fontSize:28, fontWeight:900, color:C.text, marginTop:12 }}>月額 <span style={{ color:C.purple }}>180円</span></div>
          <div style={{ fontSize:12, color:C.muted }}>（税込）</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
          {features.map(([f,icon])=>(
            <div key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:14 }}>
              <span style={{ fontSize:18 }}>{icon}</span><span>{f}</span>
            </div>
          ))}
        </div>
        {!isPremium && <button onClick={onSubscribe} style={{ width:"100%", padding:"14px 0", background:"linear-gradient(135deg,#7c3aed,#db2777)", color:"#fff", border:"none", borderRadius:12, fontSize:16, fontWeight:700, cursor:"pointer", marginBottom:10 }}>月額180円で始める</button>}
        <button onClick={onClose} style={{ ...btnSt(C.border,C.subtle), width:"100%", padding:"12px 0" }}>{isPremium?"閉じる":"今は無料版を使う"}</button>
      </div>
    </div>
  );
}

// ── 共通UI ───────────────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:"22px 18px", marginBottom:16, ...style }}>{children}</div>;
}
function SectionTitle({ children, style }) {
  return <div style={{ fontWeight:800, fontSize:16, color:C.accent, marginBottom:16, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize:13, color:C.subtle, marginBottom:6, marginTop:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>{children}</div>;
}
function Input({ style, ...props }) {
  return <input {...props} style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:4, fontFamily:"inherit", ...style }} />;
}
function SelectEl({ children, ...props }) {
  return <select {...props} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:14, outline:"none", marginBottom:4, cursor:"pointer", maxWidth:"100%" }}>{children}</select>;
}
function BackBtn({ onClick }) {
  return <button onClick={onClick} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:14, marginBottom:14, padding:0 }}>← 戻る</button>;
}
function Tag({ label, onRemove, color }) {
  return (
    <span style={{ background:`${color||C.accent}20`, color:color||C.accent, borderRadius:20, padding:"3px 10px", fontSize:12, display:"inline-flex", alignItems:"center", gap:5 }}>
      {label}{onRemove&&<span onClick={onRemove} style={{ cursor:"pointer", opacity:0.7 }}>×</span>}
    </span>
  );
}
function ChipGroup({ items, selected, onToggle }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
      {items.map(i=><button key={i} onClick={()=>onToggle(i)} style={chipSt(Array.isArray(selected)?selected.includes(i):selected===i)}>{i}</button>)}
    </div>
  );
}
function PremiumBadge({ onClick }) {
  return <span onClick={onClick} style={{ fontSize:11, background:"linear-gradient(135deg,#7c3aed,#db2777)", color:"#fff", padding:"2px 8px", borderRadius:20, cursor:"pointer", fontWeight:700 }}>✦ PRO</span>;
}
function btnSt(bg, color) {
  return { background:bg, color, border:"none", borderRadius:8, padding:"9px 18px", fontWeight:700, cursor:"pointer", fontSize:14, whiteSpace:"nowrap" };
}
function chipSt(active) {
  return { background:active?`${C.accent}20`:C.surface, color:active?C.accent:C.subtle, border:`1.5px solid ${active?C.accent:C.border}`, borderRadius:20, padding:"5px 13px", fontSize:12, cursor:"pointer", transition:"all 0.15s", fontWeight:active?700:400 };
}
