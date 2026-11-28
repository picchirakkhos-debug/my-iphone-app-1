const DEFAULT_EXERCISES = {
  "Day-1": ["Pull Down (F)", "Cable Row", "Hyper Ex", "Barbell curl", "Machine curl", "Hammer curl", "Military press", "Side raise", "Dumb shurg"],
  "Day-2": ["Flat Dumbell press", "Decline Fly", "Incline machine press", "Press Down", "Tri.machine dips", "Kick back", "Squat", "Leg Ex", "Leg Curl"]
};
const DEFAULT_SETTINGS = { theme: "light", accent: "#9dbca5", highlight: "#b8d7bf", view: "month", exercises: DEFAULT_EXERCISES };
const STORAGE_KEY = "littleByLittle.v2";
const LEGACY_NOTE_KEY = "note";

let appData = loadData();
let selectedDate = dateKey(new Date());
let viewMode = appData.settings.view || "month";
let calendarCursor = new Date();
let currentRoutine = "Day-1";

const $ = (id) => document.getElementById(id);
const workoutDialog = $("workoutDialog");
const settingsDialog = $("settingsDialog");

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && saved.settings && saved.workouts) {
      saved.settings.exercises = saved.settings.exercises || DEFAULT_EXERCISES;
      return saved;
    }
  } catch (e) {}
  return { settings: structuredClone(DEFAULT_SETTINGS), workouts: {} };
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function fromKey(key) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y,m-1,d);
}
function prettyDate(date) {
  return date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
}
function startOfSaturdayWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (d.getDay()+1)%7;
  d.setDate(d.getDate()-back);
  return d;
}
function addDays(date, amount) {
  const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()+amount);
  return d;
}
function applyTheme() {
  const s=appData.settings;
  document.documentElement.style.setProperty("--accent",s.accent);
  document.documentElement.style.setProperty("--highlight",s.highlight);
  document.body.dataset.theme=s.theme;
  $("themeSelect").value=s.theme;
  $("accentColor").value=s.accent;
  $("highlightColor").value=s.highlight;
  $("settingsViewSelect").value=viewMode;
}
function getPeriodDates() {
  if(viewMode==="week"){
    const start=startOfSaturdayWeek(calendarCursor);
    return Array.from({length:7},(_,i)=>addDays(start,i));
  }
  const first=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
  const start=startOfSaturdayWeek(first);
  return Array.from({length:42},(_,i)=>addDays(start,i));
}
function periodRange() {
  if(viewMode==="week"){
    const s=startOfSaturdayWeek(calendarCursor), e=addDays(s,6);
    return {start:s,end:e,days:7};
  }
  const s=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
  const e=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,0);
  return {start:s,end:e,days:e.getDate()};
}
function renderCalendar() {
  const dates=getPeriodDates(), grid=$("calendarGrid");
  grid.innerHTML="";
  grid.classList.toggle("week-view",viewMode==="week");
  if(viewMode==="month"){
    $("calendarTitle").textContent=calendarCursor.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  } else {
    const start=startOfSaturdayWeek(calendarCursor), end=addDays(start,6);
    const fmt=(d)=>d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
    $("calendarTitle").textContent=`${fmt(start)} – ${fmt(end)}`;
  }
  dates.forEach(date=>{
    const key=dateKey(date), item=appData.workouts[key]||{};
    const cell=document.createElement("button");
    cell.className="date-cell";
    if(viewMode==="month" && date.getMonth()!==calendarCursor.getMonth()) cell.classList.add("outside-month");
    if(key===selectedDate) cell.classList.add("selected");
    if((item.checked||[]).length || Object.values(item.checkedByRoutine||{}).some(a=>Array.isArray(a)&&a.length)) cell.classList.add("workout-done");
    if(item.cardio>0) cell.classList.add("cardio-done");
    cell.textContent=date.getDate();
    cell.type="button";
    cell.setAttribute("aria-label",`${prettyDate(date)}${cell.classList.contains("workout-done")?" workout logged":""}`);
    cell.addEventListener("click",()=>selectDate(key,true));
    grid.appendChild(cell);
  });
  updateCardioSummary();
}
function selectDate(key, openWorkout=false) {
  selectedDate=key;
  calendarCursor=fromKey(key);
  renderCalendar();
  updateCardioEntry();
  if(openWorkout) openWorkoutForSelectedDate();
}
function updateCardioEntry() {
  const rec=appData.workouts[selectedDate]||{};
  const d=fromKey(selectedDate);
  $("cardioDateLabel").textContent=d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
  $("cardioInput").value=rec.cardio==null?"":rec.cardio;
  $("cardioSavedNote").textContent=rec.cardio!=null ? `Saved ${rec.cardio} minute(s) for ${d.toLocaleDateString(undefined,{month:"short",day:"numeric"})}.` : "Enter minutes and save for this date.";
}
function updateCardioSummary() {
  const {start,end,days}=periodRange();
  let total=0,logged=0;
  for(let d=new Date(start);d<=end;d=addDays(d,1)){
    const rec=appData.workouts[dateKey(d)];
    if(rec && Number(rec.cardio)>0){total+=Number(rec.cardio);logged++;}
  }
  const avg=(total/days).toFixed(1).replace(/\.0$/,"");
  $("totalMinutes").textContent=total;
  $("dailyAverage").textContent=`${avg} min`;
  $("loggedDays").textContent=`${logged} / ${days}`;
  $("summaryPeriod").textContent=viewMode==="week"?"THIS WEEK":"THIS MONTH";
  $("rangeLabel").textContent=viewMode==="week"?"Saturday – Friday":calendarCursor.toLocaleDateString(undefined,{month:"long"});
  // Ring uses a modest visual fill scale, with the number remaining the main focus.
  const circumference=2*Math.PI*74;
  const visualProgress=Math.min(total/300,1);
  $("ringFill").style.strokeDasharray=`${circumference*visualProgress} ${circumference}`;
}
function openWorkoutForSelectedDate() {
  const rec=appData.workouts[selectedDate]||{};
  currentRoutine=rec.routine||"Day-1";
  $("dialogDateTitle").textContent=prettyDate(fromKey(selectedDate));
  $("workoutComment").value=rec.comment||"";
  renderRoutineTabs();
  renderExerciseList();
  workoutDialog.showModal();
}
function renderRoutineTabs(){
  document.querySelectorAll(".routine-btn").forEach(btn=>btn.classList.toggle("active",btn.dataset.routine===currentRoutine));
}
function renderExerciseList() {
  const list=$("exerciseList");
  list.innerHTML="";
  const exercises=appData.settings.exercises[currentRoutine]||[];
  const rec=appData.workouts[selectedDate]||{};
  const checked=rec.checkedByRoutine?.[currentRoutine]|| (rec.routine===currentRoutine?rec.checked:[]) || [];
  exercises.forEach((name,index)=>{
    const row=document.createElement("label");
    row.className="exercise-row";
    const input=document.createElement("input");
    input.type="checkbox";
    input.checked=checked.includes(name);
    input.addEventListener("change",()=>{
      const existing=appData.workouts[selectedDate]||{};
      existing.routine=currentRoutine;
      existing.checkedByRoutine=existing.checkedByRoutine||{};
      existing.checkedByRoutine[currentRoutine]=exercises.filter((ex,i)=>i===index ? input.checked : (existing.checkedByRoutine[currentRoutine]||[]).includes(ex));
      existing.checked=existing.checkedByRoutine[currentRoutine];
      appData.workouts[selectedDate]=existing;
      saveData();
      renderCalendar();
    });
    const text=document.createElement("span");text.textContent=name;
    row.append(input,text);
    list.appendChild(row);
  });
}
function saveWorkout() {
  const rec=appData.workouts[selectedDate]||{};
  rec.routine=currentRoutine;
  rec.checkedByRoutine=rec.checkedByRoutine||{};
  const checkedNow=[...$("exerciseList").querySelectorAll("input[type=checkbox]:checked")].map((el)=>el.parentElement.querySelector("span").textContent);
  rec.checkedByRoutine[currentRoutine]=checkedNow;
  rec.checked=checkedNow;
  rec.comment=$("workoutComment").value.trim();
  appData.workouts[selectedDate]=rec;
  saveData();
  renderCalendar();
  workoutDialog.close();
}
function renderExerciseManager(routine, ulId) {
  const ul=$(ulId); ul.innerHTML="";
  appData.settings.exercises[routine].forEach((exercise,idx)=>{
    const li=document.createElement("li");
    const label=document.createElement("span");label.textContent=exercise;
    const del=document.createElement("button");del.className="delete-exercise";del.type="button";del.textContent="×";del.title="Remove exercise";
    del.addEventListener("click",()=>{
      if(!confirm(`Remove “${exercise}” from ${routine}?`))return;
      appData.settings.exercises[routine].splice(idx,1);
      // Remove the exercise from every saved workout selection for this routine.
      Object.values(appData.workouts).forEach(rec=>{
        if(rec.checkedByRoutine?.[routine]) rec.checkedByRoutine[routine]=rec.checkedByRoutine[routine].filter(x=>x!==exercise);
        if(rec.routine===routine && Array.isArray(rec.checked)) rec.checked=rec.checked.filter(x=>x!==exercise);
      });
      saveData();renderExerciseManager(routine,ulId);renderExerciseList();
    });
    li.append(label,del);ul.appendChild(li);
  });
}
function addExercise(routine,inputId,managerId){
  const input=$(inputId), value=input.value.trim();
  if(!value)return;
  if(appData.settings.exercises[routine].some(x=>x.toLowerCase()===value.toLowerCase())){input.value="";return;}
  appData.settings.exercises[routine].push(value);
  saveData();input.value="";renderExerciseManager(routine,managerId);renderExerciseList();
}
function openSettings(){
  renderExerciseManager("Day-1","day1Manager");
  renderExerciseManager("Day-2","day2Manager");
  settingsDialog.showModal();
}
function shiftPeriod(direction){
  if(viewMode==="week") calendarCursor=addDays(calendarCursor,direction*7);
  else calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+direction,1);
  renderCalendar();updateCardioEntry();
}
function setView(view){
  viewMode=view;appData.settings.view=view;saveData();
  document.querySelectorAll(".view-btn").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===view));
  renderCalendar();updateCardioEntry();
}
$("prevBtn").addEventListener("click",()=>shiftPeriod(-1));
$("nextBtn").addEventListener("click",()=>shiftPeriod(1));
$("settingsBtn").addEventListener("click",openSettings);
$("closeSettingsBtn").addEventListener("click",()=>settingsDialog.close());
$("closeWorkoutBtn").addEventListener("click",()=>workoutDialog.close());
$("saveWorkoutBtn").addEventListener("click",saveWorkout);
$("saveCardioBtn").addEventListener("click",()=>{
  const raw=$("cardioInput").value;
  if(raw.trim()===""||Number(raw)<0||!Number.isFinite(Number(raw)))return;
  const rec=appData.workouts[selectedDate]||{};
  rec.cardio=Number(raw);
  appData.workouts[selectedDate]=rec;
  saveData();renderCalendar();updateCardioEntry();
});
document.querySelectorAll(".view-btn").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
document.querySelectorAll(".routine-btn").forEach(btn=>btn.addEventListener("click",()=>{
  currentRoutine=btn.dataset.routine;renderRoutineTabs();renderExerciseList();
}));
$("themeSelect").addEventListener("change",e=>{appData.settings.theme=e.target.value;saveData();applyTheme();});
$("accentColor").addEventListener("input",e=>{appData.settings.accent=e.target.value;saveData();applyTheme();});
$("highlightColor").addEventListener("input",e=>{appData.settings.highlight=e.target.value;saveData();applyTheme();});
$("settingsViewSelect").addEventListener("change",e=>{setView(e.target.value);});
$("addDay1Btn").addEventListener("click",()=>addExercise("Day-1","newDay1Exercise","day1Manager"));
$("addDay2Btn").addEventListener("click",()=>addExercise("Day-2","newDay2Exercise","day2Manager"));
$("newDay1Exercise").addEventListener("keydown",e=>{if(e.key==="Enter")addExercise("Day-1","newDay1Exercise","day1Manager");});
$("newDay2Exercise").addEventListener("keydown",e=>{if(e.key==="Enter")addExercise("Day-2","newDay2Exercise","day2Manager");});
workoutDialog.addEventListener("click",e=>{if(e.target===workoutDialog)workoutDialog.close();});
settingsDialog.addEventListener("click",e=>{if(e.target===settingsDialog)settingsDialog.close();});

applyTheme();
document.querySelectorAll(".view-btn").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===viewMode));
renderCalendar();updateCardioEntry();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
