/*
  Lernlandschaft: Schweiz im Zweiten Weltkrieg
  Features:
  - Fragenbank aus assets/data/questions.js
  - Sofort-Feedback via Mindestlänge
  - Autosave (localStorage)
  - Fortschritt
  - Export: JSON, TXT, "PDF" via Druckdialog
*/

(function(){
  const STORAGE_KEY = "ch_ww2_answers_v1";
  const META_KEY = "ch_ww2_meta_v1";
  const $ = (sel, root=document) => root.querySelector(sel);

  function nowISO(){
    const d = new Date();
    return d.toISOString();
  }

  function loadState(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch(e){ return {}; }
  }
  function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function loadMeta(){
    try{ return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
    catch(e){ return {}; }
  }
  function saveMeta(meta){ localStorage.setItem(META_KEY, JSON.stringify(meta)); }

  function normalize(s){
    return (s || "")
      .toLowerCase()
      .replace(/[ä]/g,"ae").replace(/[ö]/g,"oe").replace(/[ü]/g,"ue")
      .replace(/[ß]/g,"ss")
      .replace(/[^a-z0-9\s\-]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function evaluateAnswer(q, text){
    const normalized = normalize(text);
    const charCount = normalized.length;
    const min = q.minChars || 0;

    const groups = Array.isArray(q.keywordGroups) && q.keywordGroups.length
      ? q.keywordGroups
      : (Array.isArray(q.keywords) && q.keywords.length ? [q.keywords] : []);

    let matchedGroups = 0;
    const missingGroups = [];
    for(const group of groups){
      const hit = group.some(k => normalized.includes(normalize(k)));
      if(hit) matchedGroups += 1;
      else missingGroups.push(group);
    }

    const minGroups = q.minGroups || Math.min(2, groups.length || 0);
    const hasEnoughGroups = groups.length === 0 ? true : (matchedGroups >= minGroups);
    const longEnough = charCount >= min;

    return {charCount, longEnough, matchedGroups, minGroups, hasEnoughGroups, missingGroups};
  }

  function progressFromState(state){
    let done = 0;
    for(const q of window.QUESTION_BANK){
      const a = (state[q.id]?.answer || "").trim();
      if(a.length > 0) done += 1;
    }
    return {done, total: window.QUESTION_BANK.length};
  }

  function downloadFile(filename, content, mime="text/plain;charset=utf-8"){
    const blob = new Blob([content], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }

  function buildExportObject(){
    const state = loadState();
    const meta = loadMeta();
    const out = {
      title: "Lernlandschaft: Schweiz im Zweiten Weltkrieg",
      exported_at: nowISO(),
      student: meta.student || "",
      class: meta.className || "",
      answers: []
    };
    for(const q of window.QUESTION_BANK){
      const entry = state[q.id] || {};
      out.answers.push({
        id: q.id,
        question: q.prompt,
        answer: entry.answer || "",
        last_saved: entry.lastSaved || null
      });
    }
    return out;
  }

  function exportTXT(){
    const obj = buildExportObject();
    const lines = [];
    lines.push(obj.title);
    lines.push(`Name: ${obj.student}`);
    lines.push(`Klasse: ${obj.class}`);
    lines.push(`Export: ${obj.exported_at}`);
    lines.push("");
    for(const a of obj.answers){
      lines.push(`Frage ${a.id}: ${a.question}`);
      lines.push("");
      lines.push((a.answer || "").trim() ? a.answer.trim() : "[keine Antwort]");
      lines.push("\n" + "-".repeat(72) + "\n");
    }
    const safeName = (obj.student || "Schueler").replace(/[^\w\-]+/g,"_");
    downloadFile(`Schweiz_WW2_Antworten_${safeName}.txt`, lines.join("\n"));
  }

  function exportJSON(){
    const obj = buildExportObject();
    const safeName = (obj.student || "Schueler").replace(/[^\w\-]+/g,"_");
    downloadFile(`Schweiz_WW2_Antworten_${safeName}.json`, JSON.stringify(obj, null, 2), "application/json;charset=utf-8");
  }

  function resetAll(){
    if(!confirm("Wirklich alles löschen? (Alle Antworten + Name/Klasse)")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    location.reload();
  }

  function render(){
    const state = loadState();
    const meta = loadMeta();

    // meta inputs
    const nameEl = $("#studentName");
    const classEl = $("#studentClass");
    nameEl.value = meta.student || "";
    classEl.value = meta.className || "";

    nameEl.addEventListener("input", ()=>{
      const m = loadMeta();
      m.student = nameEl.value;
      saveMeta(m);
    });
    classEl.addEventListener("input", ()=>{
      const m = loadMeta();
      m.className = classEl.value;
      saveMeta(m);
    });

    const list = $("#questionList");
    list.innerHTML = "";

    for(const q of window.QUESTION_BANK){
      const card = document.createElement("div");
      card.className = "section qcard";
      card.id = `q${q.id}`;

      const entry = state[q.id] || {};
      const answer = entry.answer || "";

      card.innerHTML = `
        <div class="qhead">
          <div>
            <h3>${q.title}</h3>
            <div class="small">${q.prompt}</div>
          </div>
          <div class="smallmono">min. ${q.minChars || 0} Zeichen</div>
        </div>

        <textarea aria-label="${q.title} Antwort" placeholder="Antwort schreiben …">${escapeHtml(answer)}</textarea>

        <div class="controls" style="margin-top:10px;">
          <button class="btnCheck">Antwort prüfen</button>
          <div class="smallmono attemptInfo">Versuche: ${entry.attempts || 0}/3</div>
        </div>

        <div class="feedback warn" role="status">
          Schreiben Sie Ihre Antwort und klicken Sie auf „Antwort prüfen“.
          ${entry.lastSaved ? `<div class="footer-note">Zuletzt gespeichert: <span class="smallmono">${escapeHtml(entry.lastSaved)}</span></div>` : ""}
        </div>

        <div class="model" style="display:none;"></div>
      `;

      const ta = $("textarea", card);
      const fbBox = $(".feedback", card);
      const modelBox = $(".model", card);
      const btnCheck = $(".btnCheck", card);
      const attemptInfo = $(".attemptInfo", card);
      const update = () => {
        const s = loadState();
        const txt = ta.value || "";

        // save
        const prev = s[q.id] || {};
        s[q.id] = {
          answer: txt,
          lastSaved: new Date().toLocaleString(),
          attempts: prev.attempts || 0,
          solved: prev.solved || false
        };
        saveState(s);

        updateProgressUI();
      };

      // Debounce typing
      let t = null;
      ta.addEventListener("input", ()=>{
        if(t) clearTimeout(t);
        t = setTimeout(update, 240);
      });

      btnCheck.addEventListener("click", ()=>{
        const s = loadState();
        const entryNow = s[q.id] || {answer:"", attempts:0, solved:false};
        const evalRes = evaluateAnswer(q, entryNow.answer || "");

        if(evalRes.longEnough && evalRes.hasEnoughGroups){
          entryNow.solved = true;
          s[q.id] = {...entryNow, lastSaved: entryNow.lastSaved || new Date().toLocaleString()};
          saveState(s);
          fbBox.classList.remove("warn","bad");
          fbBox.classList.add("good");
          fbBox.innerHTML = `Korrekt bzw. ausreichend ausgeführt. Prüfen Sie noch auf Präzision und roten Faden.`;
          modelBox.style.display = "none";
        }else{
          entryNow.attempts = (entryNow.attempts || 0) + 1;
          s[q.id] = {...entryNow, lastSaved: entryNow.lastSaved || new Date().toLocaleString()};
          saveState(s);

          attemptInfo.textContent = `Versuche: ${entryNow.attempts}/3`;
          fbBox.classList.remove("good","warn");
          fbBox.classList.add("bad");

          if(entryNow.attempts === 1){
            fbBox.innerHTML = `Falsch bzw. unvollständig. Bitte überarbeiten.`;
            modelBox.style.display = "none";
          }else if(entryNow.attempts === 2){
            fbBox.innerHTML = `Tipp: ${escapeHtml(q.hint || "Achten Sie auf zentrale Begriffe und klare Struktur.")}`;
            modelBox.style.display = "none";
          }else{
            fbBox.innerHTML = `Hier ist eine Modellantwort zur Orientierung.`;
            modelBox.style.display = "block";
            modelBox.textContent = q.model || "";
          }
        }

        attemptInfo.textContent = `Versuche: ${s[q.id].attempts || 0}/3`;
        updateProgressUI();
      });

      list.appendChild(card);
    }

    // buttons
    $("#btnExportJSON").addEventListener("click", exportJSON);
    $("#btnExportTXT").addEventListener("click", exportTXT);
    $("#btnPrint").addEventListener("click", ()=>window.print());
    $("#btnReset").addEventListener("click", resetAll);

    updateProgressUI();
  }

  function updateProgressUI(){
    const state = loadState();
    const {done, total} = progressFromState(state);
    const pct = total ? Math.round((done/total)*100) : 0;
    $("#progressText").textContent = `${done}/${total} bearbeitet (${pct}%)`;
    $("#progressFill").style.width = `${pct}%`;
  }

  function escapeHtml(str){
    return (str ?? "").toString()
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    if(!window.QUESTION_BANK){
      console.error("QUESTION_BANK missing. Check assets/data/questions.js");
      return;
    }
    render();
  });

})();
