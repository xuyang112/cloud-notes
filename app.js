const STORAGE_KEY = "cloud-notes-data-v1";

const defaultCategories = ["Java", "数据库", "嵌入式", "嵌入式 OS", "电子电路", "数据结构", "设计模式", "网页前端", "产品经理"];
const starterNotes = [
  { id: "welcome", title: "欢迎来到云笔记", content: "这是你的个人知识空间。点击右上角的新建笔记，就可以开始记录灵感、学习笔记和待办事项。", category: "Java", createdAt: "2026-09-16T09:00:00.000Z", updatedAt: "2026-09-16T09:00:00.000Z" },
  { id: "java", title: "Java 集合框架", content: "List 保持元素顺序，Set 用于去重，Map 用键值对组织数据。选择集合时，先考虑访问方式和数据规模。", category: "Java", createdAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-15T10:00:00.000Z" },
  { id: "web", title: "网页排版的留白", content: "内容区域不是越满越好。清晰的层级、适度的行距和稳定的网格，会让信息更容易被阅读。", category: "网页前端", createdAt: "2026-09-14T11:30:00.000Z", updatedAt: "2026-09-14T11:30:00.000Z" }
];

let data = loadData();
let selectedCategory = data.categories[0];
let editingId = null;

const els = {
  sidebar: document.querySelector("#sidebar"), categoryList: document.querySelector("#categoryList"), categoryLabel: document.querySelector("#categoryLabel"), pageTitle: document.querySelector("#pageTitle"), noteCount: document.querySelector("#noteCount"), notesGrid: document.querySelector("#notesGrid"), emptyState: document.querySelector("#emptyState"), search: document.querySelector("#searchInput"), sort: document.querySelector("#sortSelect"), noteDialog: document.querySelector("#noteDialog"), noteForm: document.querySelector("#noteForm"), noteTitle: document.querySelector("#noteTitle"), noteCategory: document.querySelector("#noteCategory"), noteContent: document.querySelector("#noteContent"), formEyebrow: document.querySelector("#formEyebrow"), categoryDialog: document.querySelector("#categoryDialog"), categoryEditor: document.querySelector("#categoryEditor"), newCategoryName: document.querySelector("#newCategoryName")
};

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.categories) && Array.isArray(saved?.notes)) {
      saved.categories = saved.categories.filter(category => category !== "全部笔记");
      if (!saved.categories.length) saved.categories.push(defaultCategories[0]);
      saved.notes.forEach(note => {
        if (note.category === "全部笔记") note.category = saved.categories[0];
      });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) { /* Keep loaded notes available if storage is full. */ }
      return saved;
    }
  } catch (_) { /* Start clean if a malformed local entry exists. */ }
  return { categories: [...defaultCategories], notes: [...starterNotes] };
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function formatDate(iso) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso)); }
function escapeHTML(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

function renderCategories() {
  els.categoryList.innerHTML = "";
  data.categories.forEach(category => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = category;
    button.classList.toggle("active", category === selectedCategory);
    button.addEventListener("click", () => { selectedCategory = category; els.sidebar.classList.remove("open"); render(); });
    item.append(button); els.categoryList.append(item);
  });
  els.noteCategory.innerHTML = data.categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
}

function filteredNotes() {
  const query = els.search.value.trim().toLocaleLowerCase();
  const sort = els.sort.value;
  return data.notes.filter(note => {
    const categoryMatch = note.category === selectedCategory;
    return categoryMatch && (!query || `${note.title} ${note.content} ${note.category}`.toLocaleLowerCase().includes(query));
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title, "zh-CN") : new Date(b[sort === "created" ? "createdAt" : "updatedAt"]) - new Date(a[sort === "created" ? "createdAt" : "updatedAt"]));
}

function renderNotes() {
  const notes = filteredNotes();
  els.noteCount.textContent = `${notes.length} 篇笔记`;
  els.notesGrid.innerHTML = "";
  els.emptyState.hidden = notes.length > 0;
  notes.forEach(note => {
    const card = document.querySelector("#noteTemplate").content.firstElementChild.cloneNode(true);
    card.querySelector(".note-category").textContent = note.category;
    card.querySelector("h2").textContent = note.title;
    card.querySelector(".note-excerpt").textContent = note.content;
    card.querySelector("time").textContent = `更新于 ${formatDate(note.updatedAt)}`;
    const menu = card.querySelector(".note-menu");
    card.querySelector(".more-button").addEventListener("click", event => { event.stopPropagation(); document.querySelectorAll(".note-menu").forEach(item => item.hidden = true); menu.hidden = !menu.hidden; });
    card.querySelector(".edit-note").addEventListener("click", () => openNoteDialog(note));
    card.querySelector(".delete-note").addEventListener("click", () => deleteNote(note.id));
    card.addEventListener("dblclick", () => openNoteDialog(note));
    els.notesGrid.append(card);
  });
}

function render() {
  els.categoryLabel.textContent = selectedCategory;
  els.pageTitle.textContent = selectedCategory;
  renderCategories(); renderNotes();
}

function openNoteDialog(note) {
  editingId = note?.id ?? null;
  els.formEyebrow.textContent = note ? "编辑笔记" : "新建笔记";
  els.noteTitle.value = note?.title ?? "";
  els.noteContent.value = note?.content ?? "";
  els.noteCategory.value = note?.category ?? selectedCategory;
  els.noteDialog.showModal();
  els.noteTitle.focus();
}

function closeNoteDialog() { els.noteDialog.close(); editingId = null; }
function deleteNote(id) { if (!confirm("删除这篇笔记？")) return; data.notes = data.notes.filter(note => note.id !== id); saveData(); render(); }

function renderCategoryEditor() {
  els.categoryEditor.innerHTML = data.categories.map(category => `<div class="category-row"><span>${escapeHTML(category)}</span><button type="button" data-category="${escapeHTML(category)}">删除</button></div>`).join("");
  els.categoryEditor.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.category;
    if (data.categories.length === 1) { alert("请至少保留一个分类。"); return; }
    if (data.notes.some(note => note.category === category)) { alert("该分类中还有笔记，请先将笔记移动到其他分类。"); return; }
    data.categories = data.categories.filter(item => item !== category);
    if (selectedCategory === category) selectedCategory = data.categories[0];
    saveData(); renderCategoryEditor(); render();
  }));
}

document.querySelector("#newNote").addEventListener("click", () => openNoteDialog());
document.querySelector("#emptyNewNote").addEventListener("click", () => openNoteDialog());
document.querySelector("#closeDialog").addEventListener("click", closeNoteDialog);
document.querySelector("#cancelDialog").addEventListener("click", closeNoteDialog);
document.querySelector("#menuButton").addEventListener("click", () => els.sidebar.classList.toggle("open"));
document.querySelector("#manageCategories").addEventListener("click", () => { renderCategoryEditor(); els.categoryDialog.showModal(); });
document.querySelector("#closeCategoryDialog").addEventListener("click", () => els.categoryDialog.close());
els.search.addEventListener("input", renderNotes); els.sort.addEventListener("change", renderNotes);
els.noteForm.addEventListener("submit", event => {
  event.preventDefault();
  const now = new Date().toISOString();
  const values = { title: els.noteTitle.value.trim(), content: els.noteContent.value.trim(), category: els.noteCategory.value };
  if (!values.title || !values.content) return;
  if (editingId) { const note = data.notes.find(item => item.id === editingId); Object.assign(note, values, { updatedAt: now }); }
  else data.notes.unshift({ id: crypto.randomUUID(), ...values, createdAt: now, updatedAt: now });
  saveData(); closeNoteDialog(); render();
});
document.querySelector("#addCategory").addEventListener("click", () => {
  const name = els.newCategoryName.value.trim();
  if (!name || data.categories.includes(name)) return;
  data.categories.push(name); els.newCategoryName.value = ""; saveData(); renderCategoryEditor(); render();
});
document.addEventListener("click", () => document.querySelectorAll(".note-menu").forEach(item => item.hidden = true));

render();
