import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase";

const FLOORS = [
  { id:"f1", name:"קומה א'", floor_number:1 },
  { id:"f2", name:"קומה ב'", floor_number:2 },
  { id:"f3", name:"קומה ג'", floor_number:3 },
];
const COUNSELORS_INIT = [
  { id:"c1", name:"רבי אברהם כהן", phone:"050-1234567", floor_id:"f1" },
  { id:"c2", name:"רבי יצחק לוי",  phone:"050-2345678", floor_id:"f2" },
  { id:"c3", name:"רבי משה ברגר",  phone:"050-3456789", floor_id:"f3" },
];
const APARTMENTS_INIT = [
  { id:"a1", name:"דירה 101", floor_id:"f1", counselor_id:"c1" },
  { id:"a2", name:"דירה 102", floor_id:"f1", counselor_id:"c1" },
  { id:"a3", name:"דירה 201", floor_id:"f2", counselor_id:"c2" },
  { id:"a4", name:"דירה 301", floor_id:"f3", counselor_id:"c3" },
];
const STUDENTS_INIT = [
  { id:"s1", first_name:"יוסף",  last_name:"אברהם",  apartment_id:"a1", seniority:"שנה א'", medical_treatment:false, is_active:true,  phone:"050-1111111", father_name:"אהרון", father_phone:"050-2222222", notes:"" },
  { id:"s2", first_name:"דוד",   last_name:"לוי",     apartment_id:"a1", seniority:"שנה ב'", medical_treatment:true,  is_active:true,  phone:"050-3333333", father_name:"ראובן", father_phone:"050-4444444", notes:"נוטל ריטלין" },
  { id:"s3", first_name:"משה",   last_name:"כהן",     apartment_id:"a2", seniority:"שנה א'", medical_treatment:false, is_active:true,  phone:"050-5555555", father_name:"שמעון", father_phone:"050-6666666", notes:"" },
  { id:"s4", first_name:"אהרון", last_name:"ברגר",    apartment_id:"a3", seniority:"שנה ג'", medical_treatment:false, is_active:true,  phone:"050-7777777", father_name:"לוי",   father_phone:"050-8888888", notes:"" },
  { id:"s5", first_name:"ישראל", last_name:"פרידמן",  apartment_id:"a3", seniority:"שנה ב'", medical_treatment:true,  is_active:true,  phone:"050-9999999", father_name:"יעקב",  father_phone:"050-0000000", notes:"אלרגיה" },
  { id:"s6", first_name:"שלמה", last_name:"רוזנברג", apartment_id:"a4", seniority:"שנה א'", medical_treatment:false, is_active:true,  phone:"052-1111111", father_name:"נחום",  father_phone:"052-2222222", notes:"" },
  { id:"s7", first_name:"נחמן", last_name:"שטרן",    apartment_id:"a4", seniority:"שנה ד'", medical_treatment:false, is_active:false, phone:"052-3333333", father_name:"פנחס",  father_phone:"052-4444444", notes:"" },
];
const STATUS_CONFIG = {
  on_time:   { label:"קם בזמן",  color:"#16a34a", bg:"#dcfce7", border:"#86efac", emoji:"✅" },
  late:      { label:"איחר",     color:"#ca8a04", bg:"#fef9c3", border:"#fde047", emoji:"⚠️" },
  very_late: { label:"איחר רב",  color:"#ea580c", bg:"#ffedd5", border:"#fdba74", emoji:"🔶" },
  absent:    { label:"לא קם",    color:"#dc2626", bg:"#fee2e2", border:"#fca5a5", emoji:"❌" },
  not_here:  { label:"לא נמצא", color:"#6b7280", bg:"#f3f4f6", border:"#d1d5db", emoji:"⬜" },
};

function genRecords(students) {
  const r = {};
  const s = ["on_time","on_time","on_time","late","very_late","absent","not_here"];
  students.forEach(st => {
    r[st.id] = {};
    for (let d = 0; d < 14; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      const k = dt.toISOString().split("T")[0];
      if (Math.random() > 0.1) r[st.id][k] = s[Math.floor(Math.random() * s.length)];
    }
  });
  return r;
}

const TODAY = new Date().toISOString().split("T")[0];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(id) { return id && UUID_RE.test(id) ? id : null; }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function asUuidOrNull(id) { return id && UUID_RE.test(id) ? id : null; }

function getStats(sid, records) {
  const r = Object.values(records[sid] || {});
  if (!r.length) return { pct: 0, total: 0 };
  return { pct: Math.round(r.filter(x => x === "on_time").length / r.length * 100), total: r.length };
}
function avgColor(p) { return p >= 85 ? "#16a34a" : p >= 65 ? "#ca8a04" : p >= 40 ? "#ea580c" : "#dc2626"; }
function getRec(p) {
  if (p >= 90) return { text:"מצוין 🌟", color:"#16a34a" };
  if (p >= 75) return { text:"טוב 👍", color:"#2563eb" };
  if (p >= 60) return { text:"בינוני 📊", color:"#ca8a04" };
  if (p >= 40) return { text:"דורש שיפור ⚠️", color:"#ea580c" };
  return { text:"דחוף לטיפול 🚨", color:"#dc2626" };
}
function buildDailySummary(students, records, apartments) {
  const active = students.filter(s => s.is_active);
  const greg = new Date().toLocaleDateString("he-IL", { year:"numeric", month:"long", day:"numeric", weekday:"long" });
  const heb  = hebrewDateStr();
  const lines = [`סיכום השכמה יומי`, greg];
  if (heb) lines.push(heb);
  lines.push("─────────────────────────────");
  const lateS   = active.filter(s => records[s.id]?.[TODAY] === "late");
  const vLate   = active.filter(s => records[s.id]?.[TODAY] === "very_late");
  const absentS = active.filter(s => records[s.id]?.[TODAY] === "absent");
  const onTimeCount = active.filter(s => records[s.id]?.[TODAY] === "on_time").length;
  lines.push(`✅ קמו בזמן: ${onTimeCount} / ${active.length}`);
  function addGroup(emoji, label, list) {
    if (!list.length) return;
    lines.push(`${emoji} ${label}: ${list.length}`);
    list.forEach(s => {
      const apt = apartments.find(a => a.id === s.apartment_id);
      lines.push(`  • ${s.first_name} ${s.last_name} (${apt?.name || "—"})`);
    });
  }
  addGroup("⚠️", "איחרו", lateS);
  addGroup("🔶", "איחור רב", vLate);
  addGroup("❌", "לא קמו", absentS);
  return lines.join("\n");
}
function aptLabel(apt, counselors) {
  const c = counselors.find(x => x.id === apt?.counselor_id);
  return apt ? `${apt.name}${c ? ` – ר' ${c.name.split(" ").slice(-1)[0]}` : ""}` : "";
}
// המרת מספר לגימטריה (אותיות עבריות) - לשנים ולימים בחודש
function numberToGematria(num) {
  if (!num || num <= 0) return "";
  const thousands = Math.floor(num / 1000);
  let n = num % 1000;
  const hundredsMap = { 100:"ק",200:"ר",300:"ש",400:"ת",500:"תק",600:"תר",700:"תש",800:"תת",900:"תתק" };
  const tensMap = { 10:"י",20:"כ",30:"ל",40:"מ",50:"נ",60:"ס",70:"ע",80:"פ",90:"צ" };
  const onesMap = { 1:"א",2:"ב",3:"ג",4:"ד",5:"ה",6:"ו",7:"ז",8:"ח",9:"ט" };
  let out = "";
  const h = Math.floor(n / 100) * 100;
  if (h) out += hundredsMap[h] || "";
  n = n % 100;
  // special cases ט"ו / ט"ז to avoid spelling out God's name
  if (n === 15) { out += "טו"; n = 0; }
  else if (n === 16) { out += "טז"; n = 0; }
  else {
    const t = Math.floor(n / 10) * 10;
    if (t) out += tensMap[t] || "";
    n = n % 10;
    if (n) out += onesMap[n] || "";
  }
  let prefix = "";
  if (thousands > 0) prefix = (onesMap[thousands] || "") + "'";
  // הוספת גרשיים לפני האות האחרונה (אם יש יותר מאות אחת)
  if (out.length > 1) out = out.slice(0, -1) + '"' + out.slice(-1);
  else if (out.length === 1) out = out + "'";
  return prefix + out;
}

const HEBREW_MONTH_NAMES = {
  "Tishrei":"תשרי","Tishri":"תשרי","Cheshvan":"חשוון","Heshvan":"חשוון","Kislev":"כסלו","Tevet":"טבת",
  "Shevat":"שבט","Adar":"אדר","Adar I":"אדר א'","Adar II":"אדר ב'","Nisan":"ניסן","Iyar":"אייר",
  "Sivan":"סיוון","Tamuz":"תמוז","Tammuz":"תמוז","Av":"אב","Elul":"אלול",
};

function hebrewDateStr() {
  try {
    const dtf = new Intl.DateTimeFormat("en-US-u-ca-hebrew", { year:"numeric", month:"long", day:"numeric" });
    const parts = dtf.formatToParts(new Date());
    const day   = parts.find(p => p.type === "day")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const year  = parts.find(p => p.type === "year")?.value;
    if (!day || !year) return "";
    const dayG  = numberToGematria(parseInt(day, 10));
    const yearG = numberToGematria(parseInt(year, 10) % 1000); // ה'תשפ"ו -> מציגים רק תשפ"ו
    const monthHeb = HEBREW_MONTH_NAMES[month] || month;
    return `${dayG} ${monthHeb} ${yearG}`;
  } catch (e) { return ""; }
}

// ── UI primitives ──────────────────────────────────────────────────────────────
function Btn({ onClick, children, variant = "primary", size = "md", disabled }) {
  const v = {
    primary: { background:"#1e3a5f", color:"#fff", border:"none" },
    accent:  { background:"#f59e0b", color:"#fff", border:"none" },
    ghost:   { background:"transparent", color:"#64748b", border:"1px solid #e2e8f0" },
    danger:  { background:"#fee2e2", color:"#dc2626", border:"1px solid #fca5a5" },
  };
  const p = size === "sm" ? "5px 10px" : size === "lg" ? "11px 24px" : "8px 16px";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:6, padding:p, borderRadius:8,
        cursor:disabled?"not-allowed":"pointer", fontSize:size==="sm"?12:13, fontWeight:500,
        fontFamily:"inherit", opacity:disabled?0.5:1, transition:"opacity .15s", ...v[variant] }}>
      {children}
    </button>
  );
}

function UInput({ initValue, onBlur, placeholder, type="text", dir="rtl" }) {
  return (
    <input defaultValue={initValue} type={type} placeholder={placeholder} dir={dir}
      onBlur={e => onBlur(e.target.value)}
      style={{ width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8,
        fontSize:14, fontFamily:"inherit", color:"#1e293b", background:"#fff",
        direction:dir, boxSizing:"border-box", outline:"none" }}
      onFocus={e => e.target.style.borderColor = "#3b82f6"} />
  );
}

function CInput({ value, onChange, placeholder, style: s }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{ width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8,
        fontSize:14, fontFamily:"inherit", color:"#1e293b", background:"#fff",
        boxSizing:"border-box", outline:"none", ...s }}
      onFocus={e => e.target.style.borderColor = "#3b82f6"}
      onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
  );
}

function Sel({ value, onChange, children, style: s }) {
  return (
    <select value={value} onChange={onChange}
      style={{ width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8,
        fontSize:14, fontFamily:"inherit", color:"#1e293b", background:"#fff",
        boxSizing:"border-box", outline:"none", ...s }}>
      {children}
    </select>
  );
}

function Logo({ size = 30 }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span style={{ fontSize:size }}>🌅</span>;
  }
  return (
    <img src={LOGO_URL} alt="לוגו" onError={() => setFailed(true)}
      style={{ height:size, width:"auto", maxWidth:size*2.6, objectFit:"contain" }} />
  );
}

function Avatar({ name, pct, size = 34 }) {
  const c = pct !== undefined ? avgColor(pct) : "#1e3a5f";
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${c}20`,
      border:`2px solid ${c}`, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size * 0.38, fontWeight:700, color:c, flexShrink:0 }}>
      {name?.[0]}
    </div>
  );
}

function StatusBadge({ status, small }) {
  if (!status) return <span style={{ color:"#94a3b8", fontSize:12 }}>—</span>;
  const c = STATUS_CONFIG[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4,
      padding:small?"2px 7px":"3px 10px", borderRadius:999,
      fontSize:small?11:12, fontWeight:600,
      background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
      {c.emoji} {c.label}
    </span>
  );
}

function StatusPicker({ current, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const cfg = current ? STATUS_CONFIG[current] : null;
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
          borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
          background:cfg ? cfg.bg : "#f1f5f9", color:cfg ? cfg.color : "#94a3b8",
          border:`1.5px solid ${cfg ? cfg.border : "#e2e8f0"}`,
          minWidth:108, justifyContent:"space-between", whiteSpace:"nowrap" }}>
        <span>{cfg ? `${cfg.emoji} ${cfg.label}` : "— סטטוס"}</span>
        <span style={{ fontSize:9, opacity:.6 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, background:"#fff",
          border:"1px solid #e2e8f0", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.15)",
          zIndex:200, minWidth:138, overflow:"hidden" }}>
          {Object.entries(STATUS_CONFIG).map(([k, c]) => (
            <button key={k} onClick={() => { onSelect(k); setOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                padding:"9px 12px", background:current===k?c.bg:"transparent",
                color:c.color, border:"none", cursor:"pointer", fontFamily:"inherit",
                fontSize:12, fontWeight:600, textAlign:"right", borderBottom:"1px solid #f1f5f9" }}
              onMouseEnter={e => { if (current!==k) e.currentTarget.style.background = c.bg; }}
              onMouseLeave={e => { if (current!==k) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ fontSize:15 }}>{c.emoji}</span>
              <span>{c.label}</span>
              {current === k && <span style={{ marginRight:"auto" }}>✓</span>}
            </button>
          ))}
          {current && (
            <button onClick={() => { onSelect(null); setOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:6, width:"100%",
                padding:"7px 12px", background:"transparent", color:"#94a3b8",
                border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11 }}>
              ✕ נקה
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
        backdropFilter:"blur(2px)", zIndex:1000, display:"flex",
        alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:"#fff", borderRadius:16, width:"100%",
          maxWidth:wide?720:540, maxHeight:"90vh", overflowY:"auto",
          boxShadow:"0 20px 50px rgba(0,0,0,0.2)", animation:"fadeUp .2s ease" }}>
        <div style={{ padding:"16px 22px", borderBottom:"1px solid #e2e8f0",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <h3 style={{ fontWeight:700, fontSize:16 }}>{title}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#64748b" }}>×</button>
        </div>
        <div style={{ padding:22 }}>{children}</div>
        {footer && (
          <div style={{ padding:"12px 22px", borderTop:"1px solid #e2e8f0",
            display:"flex", gap:8, justifyContent:"flex-end",
            position:"sticky", bottom:0, background:"#fff" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student Form ───────────────────────────────────────────────────────────────
function StudentForm({ student, apartments, counselors, onSave, onClose }) {
  const fRef = useRef(student ? { ...student } : {
    first_name:"", last_name:"", phone:"", father_name:"", father_phone:"",
    mother_name:"", mother_phone:"", apartment_id:"", seniority:"שנה א'",
    medical_treatment:false, notes:"", is_active:true,
  });
  const [aptId, setAptId]     = useState(fRef.current.apartment_id || "");
  const [sen,   setSen]       = useState(fRef.current.seniority || "שנה א'");
  const [med,   setMed]       = useState(fRef.current.medical_treatment || false);
  const [act,   setAct]       = useState(fRef.current.is_active !== false);

  function sr(k, v) { fRef.current[k] = v; }
  function save() {
    fRef.current.apartment_id      = aptId;
    fRef.current.seniority         = sen;
    fRef.current.medical_treatment = med;
    fRef.current.is_active         = act;
    const apt = apartments.find(a => a.id === aptId);
    fRef.current.counselor_id = apt?.counselor_id || "";
    if (!fRef.current.first_name || !fRef.current.last_name) { alert("שם פרטי ומשפחה חובה"); return; }
    onSave({ ...fRef.current });
  }
  const F = ({ label, children }) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#64748b", marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
  return (
    <Modal title={student ? "עריכת בחור" : "הוספת בחור"} onClose={onClose}
      footer={<><Btn onClick={onClose} variant="ghost">ביטול</Btn><Btn onClick={save} variant="primary">💾 שמור</Btn></>}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <F label="שם פרטי *"><UInput initValue={fRef.current.first_name} onBlur={v => sr("first_name", v)} placeholder="יוסף" /></F>
        <F label="שם משפחה *"><UInput initValue={fRef.current.last_name}  onBlur={v => sr("last_name",  v)} placeholder="כהן"  /></F>
        <F label="טלפון"><UInput initValue={fRef.current.phone} onBlur={v => sr("phone", v)} placeholder="050-..." type="tel" dir="ltr" /></F>
        <F label="ותק">
          <Sel value={sen} onChange={e => { setSen(e.target.value); sr("seniority", e.target.value); }}>
            {["שנה א'","שנה ב'","שנה ג'","שנה ד'"].map(y => <option key={y}>{y}</option>)}
          </Sel>
        </F>
        <F label="שם אב"><UInput initValue={fRef.current.father_name}  onBlur={v => sr("father_name",  v)} placeholder="אהרון" /></F>
        <F label="טלפון אב"><UInput initValue={fRef.current.father_phone} onBlur={v => sr("father_phone", v)} placeholder="050-..." type="tel" dir="ltr" /></F>
        <F label="שם אם"><UInput initValue={fRef.current.mother_name}  onBlur={v => sr("mother_name",  v)} placeholder="שרה" /></F>
        <F label="טלפון אם"><UInput initValue={fRef.current.mother_phone} onBlur={v => sr("mother_phone", v)} placeholder="050-..." type="tel" dir="ltr" /></F>
      </div>
      <F label="דירה (המדריך נקבע אוטומטית)">
        <Sel value={aptId} onChange={e => { setAptId(e.target.value); sr("apartment_id", e.target.value); }}>
          <option value="">בחר דירה...</option>
          {apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a, counselors)}</option>)}
        </Sel>
      </F>
      <F label="הערות">
        <textarea defaultValue={fRef.current.notes} onBlur={e => sr("notes", e.target.value)} rows={2}
          style={{ width:"100%", padding:"8px 11px", border:"1.5px solid #e2e8f0", borderRadius:8,
            fontSize:14, fontFamily:"inherit", resize:"vertical", direction:"rtl",
            boxSizing:"border-box", outline:"none" }} />
      </F>
      <div style={{ display:"flex", gap:20 }}>
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, cursor:"pointer" }}>
          <input type="checkbox" checked={med} onChange={e => { setMed(e.target.checked); sr("medical_treatment", e.target.checked); }} />
          💊 טיפול תרופתי
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, cursor:"pointer" }}>
          <input type="checkbox" checked={act} onChange={e => { setAct(e.target.checked); sr("is_active", e.target.checked); }} />
          ✅ פעיל
        </label>
      </div>
    </Modal>
  );
}

// ── Student Profile ────────────────────────────────────────────────────────────
function StudentProfile({ student, records, apartments, counselors, floors, onClose, onEdit }) {
  const apt  = apartments.find(a => a.id === student.apartment_id);
  const cnsl = counselors.find(c => c.id === apt?.counselor_id);
  const flr  = floors.find(f => f.id === apt?.floor_id);
  const { pct, total } = getStats(student.id, records);
  const rec = getRec(pct);
  const H_MAP = { on_time:100, late:72, very_late:45, absent:18, not_here:8 };
  const days = Array.from({ length:30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split("T")[0];
    return { key, status: records[student.id]?.[key] || null, label: d.toLocaleDateString("he-IL", { day:"numeric", month:"numeric" }) };
  });
  const statCounts = Object.keys(STATUS_CONFIG).map(k => ({
    key:k, count: Object.values(records[student.id] || {}).filter(v => v === k).length, ...STATUS_CONFIG[k],
  }));
  return (
    <Modal title={`${student.first_name} ${student.last_name}`} onClose={onClose} wide
      footer={<><Btn onClick={onClose} variant="ghost">סגור</Btn><Btn onClick={() => onEdit(student)} variant="primary">✏️ עריכה</Btn></>}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:18 }}>
        {[[`${pct}%`,"קימה בזמן",avgColor(pct)],[`${total}`,"ימים מתועדים","#1e3a5f"],[rec.text,"המלצה",rec.color]].map(([v,l,c]) => (
          <div key={l} style={{ textAlign:"center", padding:12, background:"#f8fafc", borderRadius:10 }}>
            <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
        {[["דירה", apt ? `${apt.name}${cnsl?` – ${cnsl.name}`:""}` : "—"],["קומה",flr?.name],["ותק",student.seniority],["טלפון",student.phone],["שם אב",student.father_name],["טלפון אב",student.father_phone],["תרופתי",student.medical_treatment?"💊 כן":"לא"]].map(([l,v]) => v ? (
          <div key={l}><div style={{ fontSize:10, color:"#94a3b8", marginBottom:1 }}>{l}</div><div style={{ fontSize:13, fontWeight:500 }}>{v}</div></div>
        ) : null)}
      </div>
      {student.notes && <div style={{ background:"#fef9c3", border:"1px solid #fde047", borderRadius:8, padding:"9px 13px", marginBottom:14, fontSize:13 }}>📝 {student.notes}</div>}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:"#64748b" }}>30 ימים אחרונים – גרף נוכחות</div>
        <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:80, background:"#f8fafc", borderRadius:10, padding:"8px 6px 5px" }}>
          {days.map(d => {
            const cfg = d.status ? STATUS_CONFIG[d.status] : null;
            return (
              <div key={d.key} title={`${d.label}: ${d.status ? STATUS_CONFIG[d.status].label : "לא הוזן"}`}
                style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ width:"100%", height:58, display:"flex", alignItems:"flex-end" }}>
                  <div style={{ width:"100%", height:`${d.status ? H_MAP[d.status] : 0}%`, background:cfg?cfg.color:"#e2e8f0", borderRadius:"3px 3px 0 0", minHeight:d.status?2:0 }} />
                </div>
                <div style={{ fontSize:7, color:"#94a3b8", lineHeight:1 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
          {Object.entries(STATUS_CONFIG).map(([k,c]) => (
            <span key={k} style={{ display:"flex", alignItems:"center", gap:3, fontSize:11 }}>
              <span style={{ width:9, height:9, borderRadius:2, background:c.color, display:"inline-block" }} />
              <span style={{ color:"#64748b" }}>{c.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:"#64748b" }}>פירוט סטטוסים</div>
        {statCounts.map(s => (
          <div key={s.key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
            <span style={{ fontSize:12, width:76, color:s.color, fontWeight:500 }}>{s.emoji} {s.label}</span>
            <div style={{ flex:1, height:5, background:"#f1f5f9", borderRadius:99 }}>
              <div style={{ height:"100%", width:`${total ? (s.count/total*100) : 0}%`, background:s.color, borderRadius:99 }} />
            </div>
            <span style={{ fontSize:12, fontWeight:600, color:"#64748b", width:20, textAlign:"right" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Dashboard (main table + inline entry) ─────────────────────────────────────
function Dashboard({ students, records, setRecords, apartments, counselors, floors, onViewStudent, onEdit }) {
  const [filterApt,    setFilterApt]    = useState("");
  const [filterFloor,  setFilterFloor]  = useState("");
  const [search,       setSearch]       = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [hiddenCols,   setHiddenCols]   = useState(["floor","seniority","medical"]);
  const [compactView,  setCompactView]  = useState(true);
  const [savingId,     setSavingId]     = useState(null);
  const [showSummary,  setShowSummary]  = useState(false);

 function setStatus(sid, status) {
    setSavingId(sid);
    setRecords(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [TODAY]: status || undefined } }));
    (async () => {
      try {
        if (status) {
          const { error } = await supabase.from("daily_records").upsert(
            { student_id: sid, record_date: TODAY, status },
            { onConflict: "student_id,record_date" }
          );
          if (error) console.error("שגיאה בשמירת סטטוס:", error.message);
        } else {
          const { error } = await supabase.from("daily_records").delete()
            .eq("student_id", sid).eq("record_date", TODAY);
          if (error) console.error("שגיאה במחיקת סטטוס:", error.message);
        }
      } catch (e) {
        console.error("שגיאה בשמירה לסופהבייס:", e.message);
      } finally {
        setSavingId(null);
      }
    })();
  }
  const active   = students.filter(s => showInactive ? true : s.is_active);
  const filtered = useMemo(() => active.filter(s => {
    const apt = apartments.find(a => a.id === s.apartment_id);
    if (search && !`${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterApt   && s.apartment_id     !== filterApt)   return false;
    if (filterFloor && apt?.floor_id      !== filterFloor)  return false;
    return true;
  }), [active, search, filterApt, filterFloor, apartments]);

  const onTimeToday = active.filter(s => records[s.id]?.[TODAY] === "on_time").length;
  const absentToday = active.filter(s => records[s.id]?.[TODAY] === "absent").length;
  const notEntered  = active.filter(s => !records[s.id]?.[TODAY]).length;
  const enteredPct  = active.length ? Math.round((active.length - notEntered) / active.length * 100) : 0;

  const ALL_COLS = [
    { id:"name",      label:"שם" },
    { id:"apartment", label:"דירה" },
    { id:"floor",     label:"קומה" },
    { id:"counselor", label:"מדריך" },
    { id:"seniority", label:"ותק" },
    { id:"medical",   label:"תרופתי" },
    { id:"today",     label:"הזנה" },
    { id:"avg",       label:"ממוצע" },
    { id:"rec",       label:"המלצה" },
    { id:"actions",   label:"" },
  ];
  const COMPACT_HIDE = ["floor","seniority","medical"];
  const visCols = ALL_COLS.filter(c => compactView ? !COMPACT_HIDE.includes(c.id) : true);

  return (
    <div>
      <div style={{ marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:"#1e3a5f" }}>לוח בקרה 🏠</h1>
          <div style={{ color:"#64748b", fontSize:13, marginTop:3 }}>
            {new Date().toLocaleDateString("he-IL", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            {hebrewDateStr() && <span style={{ color:"#94a3b8" }}> | {hebrewDateStr()}</span>}
          </div>
        </div>
        <Btn onClick={() => setShowSummary(true)} variant="ghost" size="sm">📋 סיכום קצר</Btn>
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
        {[["בחורים פעילים",active.length,"#1e3a5f"],["קמו בזמן",onTimeToday,"#16a34a"],["לא קמו",absentToday,"#dc2626"],["טרם הוזן",notEntered,"#ca8a04"]].map(([l,v,c]) => (
          <div key={l} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"12px 16px", flex:1, minWidth:110 }}>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:700, color:c, lineHeight:1 }}>{v}</div>
          </div>
        ))}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"12px 16px", flex:1, minWidth:110 }}>
          <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>הושלם היום</div>
          <div style={{ height:7, background:"#f1f5f9", borderRadius:99, marginBottom:4 }}>
            <div style={{ height:"100%", width:`${enteredPct}%`, background:"#16a34a", borderRadius:99, transition:"width .5s" }} />
          </div>
          <div style={{ fontSize:12, fontWeight:600, color:"#16a34a" }}>{enteredPct}%</div>
        </div>
      </div>

      {absentToday > 0 && (
        <div style={{ background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 16px", display:"flex", gap:10, alignItems:"flex-start", marginBottom:14 }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div>
            <div style={{ fontWeight:600, color:"#dc2626", fontSize:13 }}>{absentToday} בחורים לא קמו היום</div>
            <div style={{ fontSize:12, color:"#b91c1c", marginTop:2 }}>
              {active.filter(s => records[s.id]?.[TODAY] === "absent").map(s => `${s.first_name} ${s.last_name}`).join(" • ")}
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8, marginBottom:8 }}>
        <CInput value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 חיפוש שם..." />
        <Sel value={filterApt} onChange={e => setFilterApt(e.target.value)}>
          <option value="">כל הדירות</option>
          {apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a, counselors)}</option>)}
        </Sel>
        <Sel value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">כל הקומות</option>
          {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </Sel>
        <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#64748b", cursor:"pointer", whiteSpace:"nowrap" }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> לא פעילים
        </label>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
        <button onClick={() => setCompactView(v => !v)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0" }}>
          {compactView ? "📋 הצג עמודות מלאות" : "📄 תצוגה מצומצמת"}
        </button>
      </div>

      <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr>{visCols.map(c => <th key={c.id} style={{ padding:"9px 12px", textAlign:"right", background:"#f8fafc", color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".03em", borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const apt  = apartments.find(a => a.id === s.apartment_id);
              const cnsl = counselors.find(c => c.id === apt?.counselor_id);
              const flr  = floors.find(f => f.id === apt?.floor_id);
              const { pct } = getStats(s.id, records);
              const todaySt = records[s.id]?.[TODAY];
              const rec = getRec(pct);
              const col = {
                name: (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Avatar name={s.first_name} pct={pct} />
                    <div>
                      <div style={{ fontWeight:600, color:s.is_active?"#1e293b":"#94a3b8" }}>{s.first_name} {s.last_name}</div>
                      {!s.is_active && <span style={{ fontSize:10, color:"#94a3b8" }}>לא פעיל</span>}
                    </div>
                  </div>
                ),
                apartment: <span style={{ color:"#1e3a5f", fontWeight:500 }}>{aptLabel(apt, counselors) || "—"}</span>,
                floor:     <span style={{ color:"#64748b" }}>{flr?.name || "—"}</span>,
                counselor: <span style={{ color:"#64748b" }}>{cnsl?.name || "—"}</span>,
                seniority: <span style={{ color:"#64748b" }}>{s.seniority || "—"}</span>,
                medical:   s.medical_treatment ? <span style={{ background:"#fef9c3", color:"#ca8a04", fontSize:11, padding:"2px 7px", borderRadius:999, border:"1px solid #fde047" }}>💊</span> : <span style={{ color:"#94a3b8", fontSize:11 }}>—</span>,
                today: savingId === s.id
                  ? <div style={{ width:16, height:16, border:"2px solid #e2e8f0", borderTopColor:"#1e3a5f", borderRadius:"50%", animation:"spin .7s linear infinite" }} />
                  : <StatusPicker current={todaySt} onSelect={v => setStatus(s.id, v)} />,
                avg: (
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:34, height:5, background:"#f1f5f9", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:avgColor(pct), borderRadius:99 }} />
                    </div>
                    <span style={{ fontWeight:600, color:avgColor(pct), fontSize:12 }}>{pct}%</span>
                  </div>
                ),
                rec:     <span style={{ fontSize:12, fontWeight:600, color:rec.color }}>{rec.text}</span>,
                actions: (
                  <Btn onClick={(e) => { e.stopPropagation(); onViewStudent(s); }} size="sm" variant="ghost">👁 פרופיל</Btn>
                ),
              };
              return (
                <tr key={s.id} onClick={() => onViewStudent(s)}
                  style={{ borderBottom:"1px solid #f1f5f9", transition:"background .1s", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  {visCols.map(c => <td key={c.id} style={{ padding:"9px 12px", verticalAlign:"middle" }} onClick={c.id==="today" ? (e => e.stopPropagation()) : undefined}>{col[c.id]}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign:"center", padding:"32px", color:"#94a3b8" }}><div style={{ fontSize:26, marginBottom:6 }}>🔍</div>לא נמצאו בחורים</div>}
      </div>
      <div style={{ marginTop:7, fontSize:12, color:"#94a3b8" }}>{filtered.length} בחורים מוצגים</div>

      {showSummary && (
        <Modal title="📋 סיכום קצר" onClose={() => setShowSummary(false)}
          footer={<Btn onClick={() => setShowSummary(false)} variant="ghost">סגור</Btn>}>
          <div style={{ background:"#f8fafc", borderRadius:10, padding:16, fontFamily:"monospace", fontSize:13, whiteSpace:"pre-wrap", color:"#1e293b", lineHeight:1.7, maxHeight:380, overflowY:"auto", direction:"rtl" }}>
            {buildDailySummary(students, records, apartments)}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Analytics ──────────────────────────────────────────────────────────────────
function Analytics({ students, records, apartments, counselors }) {
  const [sel, setSel] = useState(null);
  const active = students.filter(s => s.is_active);
  const H_MAP  = { on_time:100, late:72, very_late:45, absent:18, not_here:8 };

  const last14 = Array.from({ length:14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key   = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("he-IL", { day:"numeric", month:"numeric" });
    const counts = { on_time:0, late:0, very_late:0, absent:0, not_here:0 };
    active.forEach(s => { const st = records[s.id]?.[key]; if (st) counts[st]++; });
    return { label, key, ...counts };
  });

  const studentStats = active.map(s => {
    const { pct, total } = getStats(s.id, records);
    const apt = apartments.find(a => a.id === s.apartment_id);
    return { ...s, pct, total, aptName: apt?.name };
  }).sort((a, b) => b.pct - a.pct);

  const avg = Math.round(studentStats.reduce((s, x) => s + x.pct, 0) / (studentStats.length || 1));

  if (sel) {
    const last30 = Array.from({ length:30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      return { key, status: records[sel.id]?.[key] || null, label: d.toLocaleDateString("he-IL", { day:"numeric", month:"numeric" }) };
    });
    const { pct, total } = getStats(sel.id, records);
    const statCounts = Object.keys(STATUS_CONFIG).map(k => ({ key:k, count: Object.values(records[sel.id]||{}).filter(v=>v===k).length, ...STATUS_CONFIG[k] }));
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <Btn onClick={() => setSel(null)} variant="ghost" size="sm">← חזרה</Btn>
          <Avatar name={sel.first_name} pct={pct} size={36} />
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, color:"#1e3a5f" }}>{sel.first_name} {sel.last_name}</h1>
            <div style={{ fontSize:12, color:"#64748b" }}>{sel.aptName}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
          {[["ממוצע",`${pct}%`,avgColor(pct)],["ימים",total,"#1e3a5f"],...Object.entries(STATUS_CONFIG).map(([k,c])=>[c.label, Object.values(records[sel.id]||{}).filter(v=>v===k).length, c.color])].map(([l,v,c])=>(
            <div key={l} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px", flex:1, minWidth:80, textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:"#64748b" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:18, marginBottom:18 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:"#64748b" }}>30 ימים אחרונים</div>
          <div style={{ display:"flex", gap:3, alignItems:"flex-end", height:88, background:"#f8fafc", borderRadius:8, padding:"8px 6px 5px" }}>
            {last30.map(d => {
              const cfg = d.status ? STATUS_CONFIG[d.status] : null;
              return (
                <div key={d.key} title={`${d.label}: ${d.status ? STATUS_CONFIG[d.status].label : "לא הוזן"}`}
                  style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <div style={{ width:"100%", height:66, display:"flex", alignItems:"flex-end" }}>
                    <div style={{ width:"100%", height:`${d.status ? H_MAP[d.status] : 0}%`, background:cfg?cfg.color:"#e2e8f0", borderRadius:"3px 3px 0 0", minHeight:d.status?2:0 }} />
                  </div>
                  <div style={{ fontSize:7, color:"#94a3b8", lineHeight:1 }}>{d.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:6, flexWrap:"wrap" }}>
            {Object.entries(STATUS_CONFIG).map(([k,c]) => (
              <span key={k} style={{ display:"flex", alignItems:"center", gap:3, fontSize:11 }}>
                <span style={{ width:9, height:9, borderRadius:2, background:c.color, display:"inline-block" }} />
                <span style={{ color:"#64748b" }}>{c.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:18 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:"#64748b" }}>טבלת ימים</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr>{["תאריך","יום","סטטוס"].map(h=><th key={h} style={{ padding:"7px 12px", textAlign:"right", background:"#f8fafc", color:"#64748b", fontSize:11, fontWeight:600, borderBottom:"1px solid #e2e8f0" }}>{h}</th>)}</tr></thead>
              <tbody>{[...last30].reverse().map(d=>{
                const cfg=d.status?STATUS_CONFIG[d.status]:null;
                return <tr key={d.key} style={{ borderBottom:"1px solid #f1f5f9", background:cfg?`${cfg.bg}40`:undefined }}>
                  <td style={{ padding:"6px 12px", fontWeight:500 }}>{d.key}</td>
                  <td style={{ padding:"6px 12px", color:"#64748b", fontSize:12 }}>{new Date(d.key+"T12:00:00").toLocaleDateString("he-IL",{weekday:"short"})}</td>
                  <td style={{ padding:"6px 12px" }}><StatusBadge status={d.status} small /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:"#64748b" }}>פירוט סטטוסים</div>
          {statCounts.map(s => (
            <div key={s.key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
              <span style={{ fontSize:12, width:76, color:s.color, fontWeight:500 }}>{s.emoji} {s.label}</span>
              <div style={{ flex:1, height:5, background:"#f1f5f9", borderRadius:99 }}>
                <div style={{ height:"100%", width:`${total?(s.count/total*100):0}%`, background:s.color, borderRadius:99 }} />
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:"#64748b", width:20, textAlign:"right" }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize:20, fontWeight:700, color:"#1e3a5f", marginBottom:20 }}>אנליטיקה 📊</h1>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 16px", flex:1, minWidth:100, textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:700, color:"#1e3a5f" }}>{avg}%</div>
          <div style={{ fontSize:11, color:"#64748b" }}>ממוצע כללי</div>
        </div>
        {Object.entries(STATUS_CONFIG).map(([k,c]) => {
          const t = active.reduce((s,st) => s + Object.values(records[st.id]||{}).filter(v=>v===k).length, 0);
          return <div key={k} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 16px", flex:1, minWidth:90, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color:c.color }}>{t}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{c.label}</div>
          </div>;
        })}
      </div>
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:18, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>מגמה יומית – 14 ימים</div>
        <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:110, background:"#f8fafc", borderRadius:8, padding:"12px 8px 6px" }}>
          {last14.map(d => {
            const tot = active.length;
            const pct = tot ? (d.on_time / tot * 100) : 0;
            return (
              <div key={d.key} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ fontSize:8, color:"#94a3b8", fontWeight:600 }}>{Math.round(pct)}%</div>
                <div style={{ width:"100%", height:72, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                  {["absent","very_late","late","on_time"].map(k => {
                    const h = tot ? (d[k] / tot * 100) : 0;
                    return h > 0 ? <div key={k} style={{ width:"100%", height:`${h}%`, background:STATUS_CONFIG[k].color }} /> : null;
                  })}
                </div>
                <div style={{ fontSize:8, color:"#94a3b8" }}>{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:18 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>דירוג בחורים</div>
        <div style={{ fontSize:12, color:"#94a3b8", marginBottom:12 }}>לחץ על בחור לפירוט ימים</div>
        {studentStats.map((s, i) => {
          const rec = getRec(s.pct);
          return (
            <div key={s.id} onClick={() => setSel(s)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer", background:i<3?"#f8fafc":"transparent", marginBottom:4, transition:"all .15s", border:"1px solid transparent" }}
              onMouseEnter={e => { e.currentTarget.style.background="#f0f7ff"; e.currentTarget.style.borderColor="#bfdbfe"; }}
              onMouseLeave={e => { e.currentTarget.style.background=i<3?"#f8fafc":"transparent"; e.currentTarget.style.borderColor="transparent"; }}>
              <span style={{ fontSize:13, width:22, textAlign:"center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
              <Avatar name={s.first_name} pct={s.pct} size={28} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{s.first_name} {s.last_name}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{s.aptName}</div>
              </div>
              <div style={{ width:80, height:5, background:"#f1f5f9", borderRadius:99 }}>
                <div style={{ height:"100%", width:`${s.pct}%`, background:avgColor(s.pct), borderRadius:99 }} />
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:rec.color, width:36, textAlign:"right" }}>{s.pct}%</span>
              <span style={{ color:"#94a3b8", fontSize:11 }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────────────────────
function AdminPage({ apartments, setApartments, counselors, setCounselors, floors, students, setStudents, setRecords, records }) {
  const [tab, setTab]   = useState("students");
  const [editItem, setEditItem]         = useState(null);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [showAptForm, setShowAptForm]   = useState(false);
  const [aptForm, setAptForm]           = useState({ name:"", floor_id:"", counselor_id:"" });
  const [editApt, setEditApt]           = useState(null);
const [showCnslForm, setShowCnslForm] = useState(false);
  const cnslRef   = useRef({ name:"", phone:"", floor_id:"" });
  const [cnslFloor, setCnslFloor]       = useState("");
  const [cnslApts, setCnslApts]         = useState([]);
  const [editCnsl, setEditCnsl]         = useState(null);

  function saveApt() {
    if (!aptForm.name) return;
    (async () => {
      try {
        if (editApt) {
          const { error } = await supabase.from("apartments").update({
            name: aptForm.name, floor_id: asUuidOrNull(aptForm.floor_id), counselor_id: asUuidOrNull(aptForm.counselor_id),
          }).eq("id", editApt.id);
          if (error) throw error;
          setApartments(p => p.map(a => a.id===editApt.id ? {...a,...aptForm} : a));
        } else {
          const { data, error } = await supabase.from("apartments").insert({
            name: aptForm.name, floor_id: asUuidOrNull(aptForm.floor_id), counselor_id: asUuidOrNull(aptForm.counselor_id),
          }).select().single();
          if (error) throw error;
          setApartments(p => [...p, { id:data.id, ...aptForm }]);
        }
      } catch (e) {
        console.error("שגיאה בשמירת דירה:", e.message);
        alert("שגיאה בשמירת דירה: " + e.message);
      }
    })();
    setAptForm({ name:"", floor_id:"", counselor_id:"" }); setShowAptForm(false); setEditApt(null);
  }
  function saveCnsl() {
    cnslRef.current.floor_id = cnslFloor;
    if (!cnslRef.current.name) return;
    (async () => {
      try {
        let newCounselorId;
        if (editCnsl) {
          const { error } = await supabase.from("counselors").update({
            name: cnslRef.current.name, phone: cnslRef.current.phone, floor_id: asUuidOrNull(cnslRef.current.floor_id),
          }).eq("id", editCnsl.id);
          if (error) throw error;
          setCounselors(p => p.map(c => c.id===editCnsl.id ? {...c,...cnslRef.current} : c));
          newCounselorId = editCnsl.id;
        } else {
          const { data, error } = await supabase.from("counselors").insert({
            name: cnslRef.current.name, phone: cnslRef.current.phone, floor_id: asUuidOrNull(cnslRef.current.floor_id),
          }).select().single();
          if (error) throw error;
          newCounselorId = data.id;
          setCounselors(p => [...p, { id:newCounselorId, ...cnslRef.current }]);
        }
        const aptsToAssign = cnslApts;
        const aptsToUnassign = apartments.filter(a => a.counselor_id === newCounselorId && !cnslApts.includes(a.id)).map(a => a.id);
        for (const aptId of aptsToAssign) {
          await supabase.from("apartments").update({ counselor_id: newCounselorId }).eq("id", aptId);
        }
        for (const aptId of aptsToUnassign) {
          await supabase.from("apartments").update({ counselor_id: null }).eq("id", aptId);
        }
        setApartments(p => p.map(a => {
          if (cnslApts.includes(a.id)) return { ...a, counselor_id: newCounselorId };
          if (a.counselor_id === newCounselorId && !cnslApts.includes(a.id)) return { ...a, counselor_id: "" };
          return a;
        }));
      } catch (e) {
        console.error("שגיאה בשמירת מדריך:", e.message);
        alert("שגיאה בשמירת מדריך: " + e.message);
      }
    })();
    cnslRef.current = { name:"", phone:"", floor_id:"" }; setCnslFloor(""); setCnslApts([]); setShowCnslForm(false); setEditCnsl(null);
  }
function doDelete() {
    if (!confirmDel) return;
    if (confirmDel.type === "apt") {
      (async () => {
        try {
          const { error } = await supabase.from("apartments").delete().eq("id", confirmDel.id);
          if (error) throw error;
        } catch (e) {
          console.error("שגיאה במחיקת דירה:", e.message);
          alert("שגיאה במחיקה: " + e.message);
        }
        setApartments(p => p.filter(a => a.id !== confirmDel.id));
      })();
    }
    if (confirmDel.type === "cnsl") {
      (async () => {
        try {
          const { error } = await supabase.from("counselors").delete().eq("id", confirmDel.id);
          if (error) throw error;
        } catch (e) {
          console.error("שגיאה במחיקת מדריך:", e.message);
          alert("שגיאה במחיקה: " + e.message);
        }
        setCounselors(p => p.filter(c => c.id !== confirmDel.id));
      })();
    }
    if (confirmDel.type === "student") {
      (async () => {
        try {
          const { error } = await supabase.from("students").delete().eq("id", confirmDel.id);
          if (error) throw error;
        } catch (e) {
          console.error("שגיאה במחיקת בחור:", e.message);
          alert("שגיאה במחיקה: " + e.message);
        }
        setStudents(p => p.filter(s => s.id !== confirmDel.id));
        setRecords(p => { const n={...p}; delete n[confirmDel.id]; return n; });
      })();
    }
    setConfirmDel(null);
  }

  const TH = ({ ch }) => <th style={{ padding:"9px 12px", textAlign:"right", background:"#f8fafc", color:"#64748b", fontSize:11, fontWeight:600, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" }}>{ch}</th>;

  return (
    <div>
      <h1 style={{ fontSize:20, fontWeight:700, color:"#1e3a5f", marginBottom:20 }}>ניהול מערכת ⚙️</h1>
      <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
        {[["students","בחורים 👥"],["apartments","דירות 🏠"],["counselors","מדריכים 👨‍🏫"],["floors","קומות 🏢"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding:"7px 16px", borderRadius:8, border:"1.5px solid", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:500, background:tab===k?"#1e3a5f":"#fff", color:tab===k?"#fff":"#64748b", borderColor:tab===k?"#1e3a5f":"#e2e8f0" }}>{l}</button>
        ))}
      </div>

      {tab === "students" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <h2 style={{ fontSize:15, fontWeight:600 }}>ניהול בחורים</h2>
            <Btn onClick={() => setEditItem({ _new:true })} variant="accent">+ הוספת בחור</Btn>
          </div>
          <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr><TH ch="שם"/><TH ch="דירה"/><TH ch="ותק"/><TH ch="תרופתי"/><TH ch="פעיל"/><TH ch=""/></tr></thead>
              <tbody>{students.map(s => {
                const apt = apartments.find(a => a.id === s.apartment_id);
                return <tr key={s.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"9px 12px", fontWeight:500 }}>{s.first_name} {s.last_name}</td>
                  <td style={{ padding:"9px 12px", color:"#64748b" }}>{aptLabel(apt, counselors) || "—"}</td>
                  <td style={{ padding:"9px 12px", color:"#64748b" }}>{s.seniority || "—"}</td>
                  <td style={{ padding:"9px 12px" }}>{s.medical_treatment ? <span style={{ color:"#ca8a04" }}>💊</span> : <span style={{ color:"#94a3b8" }}>—</span>}</td>
                  <td style={{ padding:"9px 12px" }}>{s.is_active ? "✅" : <span style={{ color:"#94a3b8" }}>—</span>}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={() => setEditItem(s)} size="sm" variant="ghost">✏️</Btn>
                      <Btn onClick={() => setConfirmDel({ type:"student", id:s.id, name:`${s.first_name} ${s.last_name}` })} size="sm" variant="danger">🗑</Btn>
                    </div>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "apartments" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <h2 style={{ fontSize:15, fontWeight:600 }}>ניהול דירות</h2>
            <Btn onClick={() => { setShowAptForm(true); setEditApt(null); setAptForm({ name:"", floor_id:"", counselor_id:"" }); }} variant="accent">+ הוספת דירה</Btn>
          </div>
          {(showAptForm || editApt) && (
            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:14, marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"flex-end" }}>
                <div><label style={{ fontSize:12, color:"#64748b", marginBottom:4, display:"block" }}>שם דירה</label><CInput value={aptForm.name} onChange={e => setAptForm(f=>({...f,name:e.target.value}))} placeholder="דירה 105"/></div>
                <div><label style={{ fontSize:12, color:"#64748b", marginBottom:4, display:"block" }}>קומה</label><Sel value={aptForm.floor_id} onChange={e=>setAptForm(f=>({...f,floor_id:e.target.value}))}><option value="">בחר</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</Sel></div>
                <div><label style={{ fontSize:12, color:"#64748b", marginBottom:4, display:"block" }}>מדריך</label><Sel value={aptForm.counselor_id} onChange={e=>setAptForm(f=>({...f,counselor_id:e.target.value}))}><option value="">בחר</option>{counselors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Sel></div>
                <div style={{ display:"flex", gap:6 }}><Btn onClick={saveApt} variant="primary">שמור</Btn><Btn onClick={()=>{setShowAptForm(false);setEditApt(null);}} variant="ghost">ביטול</Btn></div>
              </div>
            </div>
          )}
          <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr><TH ch="שם דירה"/><TH ch="קומה"/><TH ch="מדריך"/><TH ch=""/></tr></thead>
              <tbody>{apartments.map(a => {
                const flr  = floors.find(f=>f.id===a.floor_id);
                const cnsl = counselors.find(c=>c.id===a.counselor_id);
                return <tr key={a.id} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <td style={{ padding:"9px 12px", fontWeight:500 }}>{a.name}</td>
                  <td style={{ padding:"9px 12px", color:"#64748b" }}>{flr?.name||"—"}</td>
                  <td style={{ padding:"9px 12px", color:"#64748b" }}>{cnsl?.name||"—"}</td>
                  <td style={{ padding:"9px 12px" }}><div style={{ display:"flex", gap:4 }}>
                    <Btn onClick={()=>{setEditApt(a);setAptForm({name:a.name,floor_id:a.floor_id||"",counselor_id:a.counselor_id||""});setShowAptForm(true);}} size="sm" variant="ghost">✏️</Btn>
                    <Btn onClick={()=>setConfirmDel({type:"apt",id:a.id,name:a.name})} size="sm" variant="danger">🗑</Btn>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "counselors" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
            <h2 style={{ fontSize:15, fontWeight:600 }}>ניהול מדריכים</h2>
<Btn onClick={()=>{setShowCnslForm(true);setEditCnsl(null);cnslRef.current={name:"",phone:"",floor_id:""};setCnslFloor("");setCnslApts([]);}} variant="accent">+ הוספת מדריך</Btn>
          </div>
          {(showCnslForm||editCnsl)&&(
            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:14, marginBottom:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"flex-end", marginBottom:12 }}>
                <div><label style={{ fontSize:12,color:"#64748b",marginBottom:4,display:"block" }}>שם מדריך</label><UInput initValue={cnslRef.current.name} onBlur={v=>{cnslRef.current.name=v;}} placeholder="ר' אברהם כהן"/></div>
                <div><label style={{ fontSize:12,color:"#64748b",marginBottom:4,display:"block" }}>טלפון</label><UInput initValue={cnslRef.current.phone} onBlur={v=>{cnslRef.current.phone=v;}} placeholder="050-..." dir="ltr"/></div>
                <div><label style={{ fontSize:12,color:"#64748b",marginBottom:4,display:"block" }}>קומה</label><Sel value={cnslFloor} onChange={e=>setCnslFloor(e.target.value)}><option value="">בחר</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</Sel></div>
                <div style={{display:"flex",gap:6}}><Btn onClick={saveCnsl} variant="primary">שמור</Btn><Btn onClick={()=>{setShowCnslForm(false);setEditCnsl(null);}} variant="ghost">ביטול</Btn></div>
              </div>
              <div>
                <label style={{ fontSize:12,color:"#64748b",marginBottom:6,display:"block" }}>דירות באחריות המדריך (ניתן לבחור כמה)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {apartments.map(a => {
                    const checked = cnslApts.includes(a.id);
                    const takenByOther = a.counselor_id && a.counselor_id !== (editCnsl?.id || "");
                    return (
                      <label key={a.id} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, padding:"4px 9px", borderRadius:7, cursor:"pointer", background: checked?"#dbeafe":"#fff", border:"1px solid "+(checked?"#93c5fd":"#e2e8f0"), opacity: takenByOther && !checked ? 0.5 : 1 }}>
                        <input type="checkbox" checked={checked}
                          onChange={e=>{
                            if (e.target.checked) setCnslApts(p=>[...p,a.id]);
                            else setCnslApts(p=>p.filter(x=>x!==a.id));
                          }} />
                        {a.name}
                        {takenByOther && !checked && <span style={{ color:"#94a3b8" }}> (תפוסה)</span>}
                      </label>
                    );
                  })}
                  {apartments.length===0 && <span style={{ fontSize:12, color:"#94a3b8" }}>אין דירות עדיין - הוסף דירות בטאב "דירות" קודם</span>}
                </div>
              </div>
            </div>
          )}
                <label style={{ fontSize:12,color:"#64748b",marginBottom:6,display:"block" }}>דירות באחריות המדריך (ניתן לבחור כמה)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {apartments.map(a => {
                    const checked = cnslApts.includes(a.id);
                    const takenByOther = a.counselor_id && a.counselor_id !== (editCnsl?.id || "");
                    return (
                      <label key={a.id} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, padding:"4px 9px", borderRadius:7, cursor:"pointer", background: checked?"#dbeafe":"#fff", border:"1px solid "+(checked?"#93c5fd":"#e2e8f0"), opacity: takenByOther && !checked ? 0.5 : 1 }}>
                        <input type="checkbox" checked={checked}
                          onChange={e=>{
                            if (e.target.checked) setCnslApts(p=>[...p,a.id]);
                            else setCnslApts(p=>p.filter(x=>x!==a.id));
                          }} />
                        {a.name}
                        {takenByOther && !checked && <span style={{ color:"#94a3b8" }}> (תפוסה)</span>}
                      </label>
                    );
                  })}
                  {apartments.length===0 && <span style={{ fontSize:12, color:"#94a3b8" }}>אין דירות עדיין - הוסף דירות בטאב "דירות" קודם</span>}
                </div>
              </div>
            </div>
          )}
          <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr><TH ch="שם"/><TH ch="טלפון"/><TH ch="קומה"/><TH ch="דירות"/><TH ch=""/></tr></thead>
              <tbody>{counselors.map(c=>{
                const flr=floors.find(f=>f.id===c.floor_id);
                const apts=apartments.filter(a=>a.counselor_id===c.id);
                return <tr key={c.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                  <td style={{padding:"9px 12px",fontWeight:500}}>{c.name}</td>
                  <td style={{padding:"9px 12px",color:"#64748b"}}>{c.phone||"—"}</td>
                  <td style={{padding:"9px 12px",color:"#64748b"}}>{flr?.name||"—"}</td>
                  <td style={{padding:"9px 12px",color:"#64748b"}}>{apts.map(a=>a.name).join(", ")||"—"}</td>
                  <td style={{padding:"9px 12px"}}><div style={{display:"flex",gap:4}}>
<Btn onClick={()=>{setEditCnsl(c);cnslRef.current={...c};setCnslFloor(c.floor_id||"");setCnslApts(apartments.filter(a=>a.counselor_id===c.id).map(a=>a.id));setShowCnslForm(true);}} size="sm" variant="ghost">✏️</Btn>                    <Btn onClick={()=>setConfirmDel({type:"cnsl",id:c.id,name:c.name})} size="sm" variant="danger">🗑</Btn>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "floors" && (
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e2e8f0", background:"#fff" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr><TH ch="שם קומה"/><TH ch="מספר"/><TH ch="מדריכים"/></tr></thead>
            <tbody>{floors.map(f=>{
              const fc=counselors.filter(c=>c.floor_id===f.id);
              return <tr key={f.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                <td style={{padding:"9px 12px",fontWeight:500}}>{f.name}</td>
                <td style={{padding:"9px 12px",color:"#64748b"}}>{f.floor_number}</td>
                <td style={{padding:"9px 12px",color:"#64748b"}}>{fc.map(c=>c.name).join(", ")||"—"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}

      {editItem && (
        <StudentForm student={editItem._new ? null : editItem} apartments={apartments} counselors={counselors}
          onSave={async form=>{
            try {
              if (form.id) {
                const { error } = await supabase.from("students").update({
                  first_name: form.first_name, last_name: form.last_name, phone: form.phone,
                  father_name: form.father_name, father_phone: form.father_phone,
                  mother_name: form.mother_name, mother_phone: form.mother_phone,
                 apartment_id: asUuidOrNull(form.apartment_id), seniority: form.seniority,
                  medical_treatment: form.medical_treatment, notes: form.notes, is_active: form.is_active,
                }).eq("id", form.id);
                if (error) throw error;
                setStudents(p=>p.map(s=>s.id===form.id?{...s,...form}:s));
              } else {
                const { data, error } = await supabase.from("students").insert({
                  first_name: form.first_name, last_name: form.last_name, phone: form.phone,
                  father_name: form.father_name, father_phone: form.father_phone,
                  mother_name: form.mother_name, mother_phone: form.mother_phone,
                  apartment_id: asUuidOrNull(form.apartment_id), seniority: form.seniority,
                  medical_treatment: form.medical_treatment, notes: form.notes, is_active: form.is_active,
                }).select().single();
                if (error) throw error;
                const ns={...form,id:data.id};
                setStudents(p=>[...p,ns]);setRecords(p=>({...p,[ns.id]:{}}));
              }
            } catch (e) {
              console.error("שגיאה בשמירת בחור:", e.message);
              alert("שגיאה בשמירה: " + e.message);
            }
            setEditItem(null);
          }} onClose={()=>setEditItem(null)} />
      )}

      {confirmDel && (
        <Modal title="אישור מחיקה" onClose={()=>setConfirmDel(null)}
          footer={<><Btn onClick={()=>setConfirmDel(null)} variant="ghost">ביטול</Btn><Btn onClick={doDelete} variant="danger">🗑 מחק</Btn></>}>
          <p>האם למחוק את <strong>{confirmDel.name}</strong>? פעולה זו אינה ניתנת לביטול.</p>
        </Modal>
      )}
    </div>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, onSkip }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");

  function tryLogin() {
    if (!email || !pass) { setErr("יש למלא מייל וסיסמה"); return; }
    onLogin({ email, name: email.split("@")[0] });
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"linear-gradient(135deg,#1e3a5f,#2d5491)", padding:16,
      fontFamily:"'Heebo','Segoe UI',sans-serif", direction:"rtl" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:26, color:"white" }}>
          <div style={{ width:66, height:66, background:"rgba(255,255,255,0.15)", borderRadius:18,
            display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px",
            fontSize:30, backdropFilter:"blur(10px)", overflow:"hidden", padding:8 }}><Logo size={48} /></div>
          <h1 style={{ fontSize:21, fontWeight:700, marginBottom:4 }}>מערכת מעקב השכמה</h1>
          <p style={{ opacity:.65, fontSize:13 }}>Wake Tracking System</p>
        </div>
        <div style={{ background:"#fff", borderRadius:16, padding:26, boxShadow:"0 20px 50px rgba(0,0,0,0.2)" }}>
          <h2 style={{ fontSize:16, fontWeight:700, marginBottom:18, color:"#1e293b" }}>התחברות</h2>
          <div style={{ marginBottom:13 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#64748b", marginBottom:5 }}>כתובת מייל</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="user@example.com" dir="ltr"
              style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }}
              onKeyDown={e => e.key==="Enter" && tryLogin()} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:"#64748b", marginBottom:5 }}>סיסמה</label>
            <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="••••••••" dir="ltr"
              style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, fontFamily:"inherit", boxSizing:"border-box", outline:"none" }}
              onKeyDown={e => e.key==="Enter" && tryLogin()} />
          </div>
          {err && <div style={{ background:"#fee2e2", color:"#dc2626", borderRadius:8, padding:"8px 12px", fontSize:13, marginBottom:13 }}>{err}</div>}
          <button onClick={tryLogin}
            style={{ width:"100%", padding:"11px", background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginBottom:9 }}>
            התחבר
          </button>
          <button onClick={onSkip}
            style={{ width:"100%", padding:"9px", background:"transparent", color:"#64748b", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            ⚡ כניסה לבדיקה (ללא סיסמה)
          </button>
          <p style={{ textAlign:"center", marginTop:13, fontSize:12, color:"#94a3b8" }}>שכחת סיסמה? פנה למנהל המערכת</p>
        </div>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page,       setPage]       = useState("dashboard");
  const [students,   setStudents]   = useState(STUDENTS_INIT);
  const [records,    setRecords]    = useState(() => genRecords(STUDENTS_INIT));
  const [apartments, setApartments] = useState(APARTMENTS_INIT);
  const [counselors, setCounselors] = useState(COUNSELORS_INIT);
  const [floors,     setFloors]     = useState(FLOORS);
  const [viewStudent, setViewStudent] = useState(null);
  const [editStudent, setEditStudent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState("loading"); // loading | connected | demo

  // ניסיון לטעון בחורים מסופהבייס. אם נכשל - ממשיכים עם נתוני הדמו בלי לשבור את האתר.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadStudents() {
      try {
        const { data, error } = await supabase.from("students").select("*");
        if (error) throw error;
        if (cancelled) return;
        if (data && data.length > 0) {
          const mapped = data.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            phone: s.phone,
            father_name: s.father_name,
            father_phone: s.father_phone,
            mother_name: s.mother_name,
            mother_phone: s.mother_phone,
            apartment_id: s.apartment_id,
            seniority: s.seniority,
            medical_treatment: s.medical_treatment,
            notes: s.notes,
            is_active: s.is_active,
          }));
         setStudents(mapped);
          setDbStatus("connected");
          try {
            const { data: recData, error: recError } = await supabase.from("daily_records").select("*");
            if (recError) throw recError;
            const recordsMap = {};
            mapped.forEach(s => { recordsMap[s.id] = {}; });
            (recData || []).forEach(r => {
              if (!recordsMap[r.student_id]) recordsMap[r.student_id] = {};
              recordsMap[r.student_id][r.record_date] = r.status;
            });
            setRecords(recordsMap);
          } catch (e) {
            console.error("שגיאה בטעינת סטטוסים יומיים:", e.message);
            setRecords(genRecords(mapped));
          }
        } else {
          setDbStatus("demo");
        }
      } catch (e) {
        console.error("שגיאה בטעינה מסופהבייס, ממשיכים עם נתוני דמו:", e.message);
        if (!cancelled) setDbStatus("demo");
      }
    }
loadStudents

  // טעינת קומות, מדריכים ודירות מסופהבייס (בנפרד מבחורים, כדי שכשל באחד לא ישבור את השני)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadOrgData() {
      try {
        const [flrRes, cnslRes, aptRes] = await Promise.all([
          supabase.from("floors").select("*"),
          supabase.from("counselors").select("*"),
          supabase.from("apartments").select("*"),
        ]);
        if (cancelled) return;
        if (flrRes.error) throw flrRes.error;
        if (cnslRes.error) throw cnslRes.error;
        if (aptRes.error) throw aptRes.error;
        if (flrRes.data && flrRes.data.length > 0) {
          setFloors(flrRes.data.map(f => ({ id: f.id, name: f.name, floor_number: f.floor_number })));
        }
        if (cnslRes.data && cnslRes.data.length > 0) {
          setCounselors(cnslRes.data.map(c => ({ id: c.id, name: c.name, phone: c.phone, floor_id: c.floor_id })));
        }
        if (aptRes.data && aptRes.data.length > 0) {
          setApartments(aptRes.data.map(a => ({ id: a.id, name: a.name, floor_id: a.floor_id, counselor_id: a.counselor_id })));
        }
      } catch (e) {
        console.error("שגיאה בטעינת קומות/מדריכים/דירות:", e.message);
      }
    }
    loadOrgData();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return <LoginScreen onLogin={u => setUser(u)} onSkip={() => setUser({ email:"demo", name:"דמו" })} />;
  }

  const navItems = [
    { id:"dashboard", label:"לוח בקרה",  icon:"🏠" },
    { id:"analytics", label:"אנליטיקה",  icon:"📊" },
    { id:"admin",     label:"ניהול",      icon:"⚙️" },
  ];

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#f8fafc", direction:"rtl", fontFamily:"'Heebo','Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        .dt-menu-btn { display:none; }
        @media (max-width: 768px) {
          .dt-sidebar { transform: translateX(${sidebarOpen ? "0" : "100%"}) !important; transition: transform .25s ease; }
          .dt-main { margin-right: 0 !important; padding: 14px !important; }
          .dt-menu-btn { display: flex !important; }
          .card-grid-row { flex-direction: column !important; }
          table { font-size: 12px !important; }
          th, td { padding: 7px 8px !important; }
        }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr 1fr auto"],
          div[style*="gridTemplateColumns:1fr 1fr 1fr auto"] { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:15 }} />
      )}

      <aside className="dt-sidebar" style={{ width:210, background:"#1e3a5f", display:"flex", flexDirection:"column", position:"fixed", top:0, bottom:0, right:0, zIndex:20, boxShadow:"2px 0 12px rgba(0,0,0,0.15)" }}>
        <div style={{ padding:"18px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, color:"white" }}>
            <span style={{ fontSize:26 }}><Logo size={28} /></span>
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>מעקב השכמה</div>
              <div style={{ fontSize:10, opacity:.45 }}>Wake Tracker</div>
            </div>
          </div>
        </div>
        <nav style={{ flex:1, padding:"10px 6px" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, width:"100%",
                color:page===item.id?"white":"rgba(255,255,255,0.6)",
                background:page===item.id?"rgba(255,255,255,0.15)":"transparent",
                fontWeight:page===item.id?600:400, fontSize:13, border:"none", cursor:"pointer",
                fontFamily:"inherit", marginBottom:2, transition:"all .15s", textAlign:"right" }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>👤</div>
            <div style={{ flex:1, overflow:"hidden" }}>
              <div style={{ color:"white", fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</div>
            </div>
          </div>
          <button onClick={() => setUser(null)}
            style={{ width:"100%", padding:"6px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:7, color:"rgba(255,255,255,0.7)", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
          🚪 התנתקות
          </button>
          <div style={{ marginTop:8, fontSize:10, textAlign:"center", color: dbStatus==="connected" ? "#4ade80" : dbStatus==="loading" ? "rgba(255,255,255,0.4)" : "#fbbf24" }}>
            {dbStatus==="connected" ? "🟢 מחובר לסופהבייס" : dbStatus==="loading" ? "⏳ טוען..." : "🟡 נתוני דמו"}
          </div>
        </div>
      </aside>
      <main className="dt-main" style={{ flex:1, marginRight:210, padding:"20px", minWidth:0, animation:"fadeUp .2s ease" }}>
        <button className="dt-menu-btn" onClick={() => setSidebarOpen(true)}
          style={{ alignItems:"center", gap:6, background:"#1e3a5f", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:14 }}>
          ☰ תפריט
        </button>
        {page==="dashboard" && <Dashboard students={students} records={records} setRecords={setRecords} apartments={apartments} counselors={counselors} floors={floors} onViewStudent={setViewStudent} onEdit={setEditStudent} />}
        {page==="analytics" && <Analytics students={students} records={records} apartments={apartments} counselors={counselors} />}
        {page==="admin"     && <AdminPage apartments={apartments} setApartments={setApartments} counselors={counselors} setCounselors={setCounselors} floors={floors} students={students} setStudents={setStudents} setRecords={setRecords} records={records} />}
      </main>

      {viewStudent && !editStudent && (
        <StudentProfile student={viewStudent} records={records} apartments={apartments} counselors={counselors} floors={floors}
          onClose={() => setViewStudent(null)} onEdit={s => { setEditStudent(s); setViewStudent(null); }} />
      )}
   {editStudent && (
        <StudentForm student={editStudent} apartments={apartments} counselors={counselors}
          onSave={async form => {
            try {
              if (form.id) {
                const { error } = await supabase.from("students").update({
                  first_name: form.first_name, last_name: form.last_name, phone: form.phone,
                  father_name: form.father_name, father_phone: form.father_phone,
                  mother_name: form.mother_name, mother_phone: form.mother_phone,
                  apartment_id: asUuidOrNull(form.apartment_id), seniority: form.seniority,
                  medical_treatment: form.medical_treatment, notes: form.notes, is_active: form.is_active,
                }).eq("id", form.id);
                if (error) throw error;
                setStudents(p => p.map(s => s.id===form.id ? {...s,...form} : s));
              } else {
                const { data, error } = await supabase.from("students").insert({
                  first_name: form.first_name, last_name: form.last_name, phone: form.phone,
                  father_name: form.father_name, father_phone: form.father_phone,
                  mother_name: form.mother_name, mother_phone: form.mother_phone,
                  apartment_id: asUuidOrNull(form.apartment_id), seniority: form.seniority,
                  medical_treatment: form.medical_treatment, notes: form.notes, is_active: form.is_active,
                }).select().single();
                if (error) throw error;
                const ns={...form,id:data.id};
                setStudents(p=>[...p,ns]); setRecords(p=>({...p,[ns.id]:{}}));
              }
            } catch (e) {
              console.error("שגיאה בשמירת בחור:", e.message);
              alert("שגיאה בשמירה: " + e.message);
            }
            setEditStudent(null);
          }} onClose={() => setEditStudent(null)} />
      )}
    </div>
  );
}
